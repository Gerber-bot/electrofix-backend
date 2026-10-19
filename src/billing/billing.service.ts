import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../admin-suite/audit/audit.service';
import { randomUUID } from 'crypto';

export class RegisterPaymentDto {
  ticketId?: string;
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'CARD' | string;
  status?: 'APPROVED' | 'PENDING' | 'REJECTED';
  reference?: string;
  notes?: string;
}

export class CreateInvoiceDto {
  ticketId?: string;
  customerName: string;
  customerTaxId?: string;
  totalAmount: number;
}

export interface CashClosingSummary {
  date: string;
  totalCollectedToday: number;
  byMethod: {
    cash: number;
    transfer: number;
    card: number;
    mercadopago: number;
  };
  todayTransactionsCount: number;
  monthlyTotal: number;
  invoicesIssuedCount: number;
}

export class MercadoPagoPreferenceDto {
  ticketId?: string;
  title: string;
  amount: number;
  customerEmail?: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async registerPayment(dto: RegisterPaymentDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }
    if (!dto.method) {
      throw new BadRequestException('El método de pago es requerido');
    }

    const id = randomUUID();
    const status = dto.status || 'APPROVED';
    const now = new Date();

    let paymentRecord: any;

    try {
      paymentRecord = await this.prisma.payment.create({
        data: {
          id,
          ticket_id: dto.ticketId ?? null,
          amount: Number(dto.amount),
          method: dto.method.toUpperCase(),
          status,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          created_at: now,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to insert payment: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo registrar el pago');
    }

    // Update ticket isPaid if approved and ticketId provided
    if (dto.ticketId && status === 'APPROVED') {
      try {
        await this.prisma.repairTicket.update({
          where: { id: dto.ticketId },
          data: { isPaid: true },
        });
      } catch (err) {
        this.logger.warn(`Could not update ticket isPaid for ticket ${dto.ticketId}: ${(err as Error).message}`);
      }
    }

    // Audit log
    await this.auditService.logAction({
      action: 'PAYMENT_REGISTERED',
      entity: 'PAYMENT',
      entityId: id,
      metadata: {
        ticketId: dto.ticketId,
        amount: dto.amount,
        method: dto.method,
        status,
        reference: dto.reference,
      },
    });

    return paymentRecord;
  }

  async getPayments(filters?: { ticketId?: string; status?: string; method?: string }) {
    try {
      const where: any = {};
      if (filters?.ticketId) where.ticket_id = filters.ticketId;
      if (filters?.status) where.status = filters.status.toUpperCase();
      if (filters?.method) where.method = filters.method.toUpperCase();

      return await this.prisma.payment.findMany({
        where,
        orderBy: { created_at: 'desc' },
      });
    } catch (err) {
      this.logger.error(`Error querying payments: ${(err as Error).message}`);
      return [];
    }
  }

  async getPaymentById(id: string) {
    try {
      const p = await this.prisma.payment.findUnique({ where: { id } });
      if (!p) {
        throw new NotFoundException(`Pago con ID ${id} no encontrado`);
      }
      return p;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }
  }

  async createInvoice(dto: CreateInvoiceDto) {
    if (!dto.customerName || dto.customerName.trim().length === 0) {
      throw new BadRequestException('El nombre del cliente es obligatorio');
    }
    if (!dto.totalAmount || dto.totalAmount <= 0) {
      throw new BadRequestException('El monto total debe ser mayor a 0');
    }

    const id = randomUUID();
    const year = new Date().getFullYear();

    // Generate unique sequential invoice number
    let count = 1;
    try {
      const existingInvoices = await this.getInvoices();
      count = existingInvoices.length + 1;
    } catch {
      count = Math.floor(1000 + Math.random() * 9000);
    }

    const invoiceNumber = `INV-${year}-${String(count).padStart(4, '0')}`;
    const now = new Date();
    const pdfUrl = `/reports/payment/${id}/pdf`;

    let invoiceRecord: any;

    try {
      invoiceRecord = await this.prisma.invoice.create({
        data: {
          id,
          ticket_id: dto.ticketId ?? null,
          customer_name: dto.customerName,
          customer_tax_id: dto.customerTaxId ?? null,
          total_amount: Number(dto.totalAmount),
          status: 'ISSUED',
          invoice_number: invoiceNumber,
          pdf_url: pdfUrl,
          created_at: now,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to insert invoice: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo generar la factura');
    }

    await this.auditService.logAction({
      action: 'INVOICE_ISSUED',
      entity: 'INVOICE',
      entityId: id,
      metadata: {
        invoiceNumber,
        customerName: dto.customerName,
        totalAmount: dto.totalAmount,
        ticketId: dto.ticketId,
      },
    });

    return invoiceRecord;
  }

  async getInvoices() {
    try {
      return await this.prisma.invoice.findMany({
        orderBy: { created_at: 'desc' },
      });
    } catch (err) {
      this.logger.error(`Error querying invoices: ${(err as Error).message}`);
      return [];
    }
  }

  async getInvoiceById(id: string) {
    try {
      const inv = await this.prisma.invoice.findFirst({
        where: {
          OR: [{ id }, { invoice_number: id }],
        },
      });
      if (!inv) {
        throw new NotFoundException(`Factura con ID o número ${id} no encontrada`);
      }
      return inv;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Factura con ID o número ${id} no encontrada`);
    }
  }

  async getDailyCashClosing(): Promise<CashClosingSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const payments = await this.getPayments();
    const invoices = await this.getInvoices();

    let totalCollectedToday = 0;
    const byMethod = {
      cash: 0,
      transfer: 0,
      card: 0,
      mercadopago: 0,
    };
    let todayTransactionsCount = 0;
    let monthlyTotal = 0;

    for (const p of payments) {
      const pDate = new Date(p.created_at);
      const amount = Number(p.amount) || 0;
      const isApproved = (p.status || 'APPROVED').toUpperCase() === 'APPROVED';

      if (!isApproved) continue;

      if (pDate >= firstDayOfMonth) {
        monthlyTotal += amount;
      }

      if (pDate >= today) {
        totalCollectedToday += amount;
        todayTransactionsCount += 1;

        const method = (p.method || '').toUpperCase();
        if (method === 'CASH' || method === 'EFECTIVO') {
          byMethod.cash += amount;
        } else if (method === 'TRANSFER' || method === 'TRANSFERENCIA') {
          byMethod.transfer += amount;
        } else if (method === 'CARD' || method === 'DEBITO' || method === 'CREDITO') {
          byMethod.card += amount;
        } else if (method === 'MERCADOPAGO' || method === 'MP') {
          byMethod.mercadopago += amount;
        } else {
          byMethod.cash += amount;
        }
      }
    }

    return {
      date: new Date().toISOString().split('T')[0],
      totalCollectedToday,
      byMethod,
      todayTransactionsCount,
      monthlyTotal,
      invoicesIssuedCount: invoices.length,
    };
  }

  async createMercadoPagoPreference(dto: MercadoPagoPreferenceDto) {
    const amount = Number(dto.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Monto inválido para preferencia de pago');
    }

    const title = dto.title || `Reparación ElectroFix - Ticket #${dto.ticketId || 'TKT'}`;
    const preferenceId = `MP-PREF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Build simulated or production checkout link
    const sandboxUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`;

    return {
      id: preferenceId,
      ticketId: dto.ticketId,
      title,
      unitPrice: amount,
      currencyId: 'ARS',
      initPoint: sandboxUrl,
      sandboxInitPoint: sandboxUrl,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };
  }
}
