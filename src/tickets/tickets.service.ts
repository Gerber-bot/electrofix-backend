import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import { CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFirstTenant() {
    const tenant = await this.prisma.tenant.findFirst({
      include: {
        catalog: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('No active tenant found.');
    }

    return tenant;
  }

  async getCatalog(tenantId?: string) {
    if (tenantId) {
      return this.prisma.priceCatalog.findMany({
        where: { tenantId },
        orderBy: [{ brandModel: 'asc' }, { serviceName: 'asc' }],
      });
    }
    return this.prisma.priceCatalog.findMany({
      orderBy: [{ brandModel: 'asc' }, { serviceName: 'asc' }],
    });
  }

  async getTickets(status?: TicketStatus) {
    return this.prisma.repairTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { name: true, phone: true } } },
    });
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async getTicketByToken(trackingToken: string) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { trackingToken },
      include: { tenant: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with token ${trackingToken} not found`);
    }
    return ticket;
  }

  async getTicketsByDni(customerDni: string) {
    const cleanDni = customerDni.trim().replace(/\D/g, '');
    return this.prisma.repairTicket.findMany({
      where: {
        customerDni: {
          contains: cleanDni,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { tenant: true },
    });
  }

  async searchTickets(dni?: string, token?: string) {
    if (token) {
      const ticket = await this.prisma.repairTicket.findUnique({
        where: { trackingToken: token.trim() },
        include: { tenant: true },
      });
      return ticket ? [ticket] : [];
    }

    if (dni) {
      return this.getTicketsByDni(dni);
    }

    return this.getTickets();
  }

  async createTicket(dto: CreateTicketDto) {
    let tenantId = dto.tenantId;

    if (!tenantId) {
      const defaultTenant = await this.prisma.tenant.findFirst();
      if (!defaultTenant) {
        throw new NotFoundException('Cannot create ticket: No tenant registered.');
      }
      tenantId = defaultTenant.id;
    }

    return this.prisma.repairTicket.create({
      data: {
        tenantId,
        customerName: dto.customerName,
        customerDni: dto.customerDni.trim().replace(/\D/g, ''),
        customerPhone: dto.customerPhone,
        deviceType: dto.deviceType,
        brandModel: dto.brandModel,
        serialOrImei: dto.serialOrImei || null,
        reportedIssue: dto.reportedIssue,
        liquidDamageRisk: dto.liquidDamageRisk ?? false,
        estimatedCost: dto.estimatedCost !== undefined ? dto.estimatedCost : null,
        status: TicketStatus.RECEIVED,
      },
      include: {
        tenant: true,
      },
    });
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    const currentTicket = await this.prisma.repairTicket.findUnique({
      where: { id },
    });

    if (!currentTicket) {
      throw new NotFoundException(`Ticket with ID ${id} not found.`);
    }

    // Quality Control requirement check:
    // If moving to READY_FOR_PICKUP, qcPassed must either be passed as true or already be true.
    if (dto.status === TicketStatus.READY_FOR_PICKUP) {
      const qcPassed = dto.qcPassed !== undefined ? dto.qcPassed : currentTicket.qcPassed;
      if (!qcPassed) {
        throw new BadRequestException(
          'No se puede marcar como "Listo para retirar" sin haber completado y aprobado el Control de Calidad de 5 puntos (qcPassed: true).',
        );
      }
    }

    return this.prisma.repairTicket.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.technicalDiagnosis !== undefined && { technicalDiagnosis: dto.technicalDiagnosis }),
        ...(dto.qcPassed !== undefined && { qcPassed: dto.qcPassed }),
        ...(dto.finalCost !== undefined && { finalCost: dto.finalCost }),
        ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
        ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
      },
      include: {
        tenant: true,
      },
    });
  }
}
