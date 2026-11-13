import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';
import { CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto';
import { AuthenticatedUser } from '../auth/auth.middleware';

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
      throw new NotFoundException('No hay talleres activos registrados.');
    }

    return tenant;
  }

  async getTenant(user?: AuthenticatedUser) {
    if (user?.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { catalog: true },
      });
      if (tenant) return tenant;
    }
    return this.getFirstTenant();
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

  /**
   * Lists repair tickets with strict tenant isolation:
   * - Superadmin sees all tickets (or filtered by tenant if desired).
   * - Workshop roles (taller, tecnico, operador) ONLY see tickets of their own tenant.
   */
  async getTickets(user?: AuthenticatedUser, status?: TicketStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    // Tenant isolation: workshop users only see their own workshop's tickets
    if (user && user.role !== 'admin') {
      if (!user.tenantId) {
        throw new ForbiddenException('El usuario no tiene un taller asignado.');
      }
      where.tenantId = user.tenantId;
    }

    return this.prisma.repairTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, name: true, phone: true } } },
    });
  }

  /**
   * Retrieves a ticket by ID, verifying tenant isolation:
   * - Returns 403 Forbidden if a workshop user attempts to read a ticket from another workshop.
   */
  async getTicketById(id: string, user?: AuthenticatedUser) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { id },
      include: { tenant: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado.`);
    }

    if (
      user &&
      user.role !== 'admin' &&
      user.tenantId &&
      ticket.tenantId !== user.tenantId
    ) {
      throw new ForbiddenException(
        'Acceso denegado: este registro pertenece a otro taller.',
      );
    }

    return ticket;
  }

  /**
   * Public tracking by unique token.
   */
  async getTicketByToken(trackingToken: string) {
    const ticket = await this.prisma.repairTicket.findUnique({
      where: { trackingToken },
      include: { tenant: true },
    });
    if (!ticket) {
      throw new NotFoundException(
        `Ticket con token ${trackingToken} no encontrado.`,
      );
    }
    return ticket;
  }

  /**
   * Searches tickets by customer DNI with tenant filtering.
   */
  async getTicketsByDni(customerDni: string, user?: AuthenticatedUser) {
    const cleanDni = customerDni.trim().replace(/\D/g, '');
    const where: any = {
      customerDni: {
        contains: cleanDni,
      },
    };

    if (user && user.role !== 'admin' && user.tenantId) {
      where.tenantId = user.tenantId;
    }

    return this.prisma.repairTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tenant: true },
    });
  }

  async searchTickets(dni?: string, token?: string, user?: AuthenticatedUser) {
    if (token) {
      const ticket = await this.prisma.repairTicket.findUnique({
        where: { trackingToken: token.trim() },
        include: { tenant: true },
      });
      if (!ticket) return [];
      if (
        user &&
        user.role !== 'admin' &&
        user.tenantId &&
        ticket.tenantId !== user.tenantId
      ) {
        return [];
      }
      return [ticket];
    }

    if (dni) {
      return this.getTicketsByDni(dni, user);
    }

    return this.getTickets(user);
  }

  /**
   * Creates a ticket deriving tenantId strictly from validated session:
   * - If user belongs to a tenant, forces user.tenantId.
   */
  async createTicket(dto: CreateTicketDto, user?: AuthenticatedUser) {
    let tenantId = user?.tenantId || dto.tenantId;

    if (!tenantId) {
      const defaultTenant = await this.prisma.tenant.findFirst();
      if (!defaultTenant) {
        throw new NotFoundException(
          'No se puede crear el ticket: no hay talleres registrados.',
        );
      }
      tenantId = defaultTenant.id;
    }

    // Auto-calculate incremental orderNumber for SQLite
    const lastTicket = await this.prisma.repairTicket.findFirst({
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber =
      lastTicket?.orderNumber && lastTicket.orderNumber >= 1000
        ? lastTicket.orderNumber + 1
        : 1001;

    return this.prisma.repairTicket.create({
      data: {
        tenantId,
        orderNumber,
        customerName: dto.customerName,
        customerDni: dto.customerDni.trim().replace(/\D/g, ''),
        customerPhone: dto.customerPhone,
        deviceType: dto.deviceType,
        brandModel: dto.brandModel,
        serialOrImei: dto.serialOrImei || null,
        reportedIssue: dto.reportedIssue,
        liquidDamageRisk: dto.liquidDamageRisk ?? false,
        estimatedCost:
          dto.estimatedCost !== undefined ? dto.estimatedCost : null,
        status: TicketStatus.RECEIVED,
      },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Updates a ticket with tenant verification:
   * - Blocks cross-tenant updates by rejecting when currentTicket.tenantId !== user.tenantId.
   */
  async updateTicket(
    id: string,
    dto: UpdateTicketDto,
    user?: AuthenticatedUser,
  ) {
    const currentTicket = await this.prisma.repairTicket.findUnique({
      where: { id },
    });

    if (!currentTicket) {
      throw new NotFoundException(`Ticket con ID ${id} no encontrado.`);
    }

    if (
      user &&
      user.role !== 'admin' &&
      user.tenantId &&
      currentTicket.tenantId !== user.tenantId
    ) {
      throw new ForbiddenException(
        'Acceso denegado: no podés modificar reparaciones de otro taller.',
      );
    }

    // Quality Control requirement check:
    // If moving to READY_FOR_PICKUP, qcPassed must either be passed as true or already be true.
    if (dto.status === TicketStatus.READY_FOR_PICKUP) {
      const qcPassed =
        dto.qcPassed !== undefined ? dto.qcPassed : currentTicket.qcPassed;
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
        ...(dto.technicalDiagnosis !== undefined && {
          technicalDiagnosis: dto.technicalDiagnosis,
        }),
        ...(dto.qcPassed !== undefined && { qcPassed: dto.qcPassed }),
        ...(dto.finalCost !== undefined && { finalCost: dto.finalCost }),
        ...(dto.estimatedCost !== undefined && {
          estimatedCost: dto.estimatedCost,
        }),
        ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
      },
      include: {
        tenant: true,
      },
    });
  }

  async approveBudget(identifier: string) {
    const clean = identifier.trim();
    const ticket = await this.prisma.repairTicket.findFirst({
      where: {
        OR: [{ id: clean }, { trackingToken: clean }],
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${clean}" no encontrado.`);
    }

    return this.prisma.repairTicket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.IN_REPAIR },
      include: {
        tenant: true,
      },
    });
  }
}
