import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface CreateAuditLogDto {
  userId?: string | null;
  role?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AuditLogItem {
  id: string;
  user_id: string | null;
  role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: any;
  created_at: Date;
}

export interface AuditQueryFilters {
  user_id?: string;
  role?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(dto: CreateAuditLogDto): Promise<AuditLogItem> {
    const id = randomUUID();
    const now = new Date();

    try {
      return await this.prisma.auditLog.create({
        data: {
          id,
          user_id: dto.userId ?? null,
          role: dto.role ?? null,
          action: dto.action,
          entity: dto.entity,
          entity_id: dto.entityId ?? null,
          metadata: (dto.metadata as any) ?? undefined,
          created_at: now,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to insert audit log: ${(err as Error).message}`);
      return {
        id,
        user_id: dto.userId ?? null,
        role: dto.role ?? null,
        action: dto.action,
        entity: dto.entity,
        entity_id: dto.entityId ?? null,
        metadata: dto.metadata ?? null,
        created_at: now,
      };
    }
  }

  async findAll(filters: AuditQueryFilters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    try {
      const where: any = {};
      if (filters.user_id) where.user_id = filters.user_id;
      if (filters.role) where.role = { equals: filters.role, mode: 'insensitive' };
      if (filters.action) where.action = { contains: filters.action, mode: 'insensitive' };
      if (filters.startDate || filters.endDate) {
        where.created_at = {};
        if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
        if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
      }

      const [data, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    } catch (err) {
      this.logger.error(`Error querying audit logs: ${(err as Error).message}`);
      return { data: [], total: 0, page, limit, totalPages: 1 };
    }
  }

  async getById(id: string): Promise<AuditLogItem | null> {
    try {
      return await this.prisma.auditLog.findUnique({ where: { id } });
    } catch (err) {
      this.logger.error(`Error getting audit log by id: ${(err as Error).message}`);
      return null;
    }
  }

  async getByUserId(userId: string): Promise<AuditLogItem[]> {
    try {
      return await this.prisma.auditLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    } catch (err) {
      this.logger.error(`Error getting audit logs by user id: ${(err as Error).message}`);
      return [];
    }
  }

  async getByEntity(entity: string, entityId?: string): Promise<AuditLogItem[]> {
    try {
      const where: any = { entity };
      if (entityId) where.entity_id = entityId;
      return await this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    } catch (err) {
      this.logger.error(`Error getting audit logs by entity: ${(err as Error).message}`);
      return [];
    }
  }
}
