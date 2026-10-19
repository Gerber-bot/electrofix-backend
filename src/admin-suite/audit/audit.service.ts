import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
  metadata: Record<string, any> | null;
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
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureTableExists();
  }

  private async ensureTableExists() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "audit_logs" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT,
          "role" TEXT,
          "action" TEXT NOT NULL,
          "entity" TEXT NOT NULL,
          "entity_id" TEXT,
          "metadata" JSONB,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");
        CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs"("entity", "entity_id");
        CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
      `);
    } catch (err: unknown) {
      this.logger.warn(`Could not ensure audit_logs table via SQL (might already exist or read-only): ${(err as Error).message}`);
    }
  }

  async logAction(dto: CreateAuditLogDto): Promise<AuditLogItem> {
    const id = randomUUID();
    const now = new Date();

    try {
      // Try Prisma Client delegate first if available
      const prismaDelegate = (this.prisma as any).auditLog;
      if (prismaDelegate?.create) {
        return await prismaDelegate.create({
          data: {
            id,
            user_id: dto.userId ?? null,
            role: dto.role ?? null,
            action: dto.action,
            entity: dto.entity,
            entity_id: dto.entityId ?? null,
            metadata: dto.metadata ?? null,
            created_at: now,
          },
        });
      }
    } catch {
      // Fallback to raw SQL below
    }

    // Direct SQL fallback
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "audit_logs" ("id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        id,
        dto.userId ?? null,
        dto.role ?? null,
        dto.action,
        dto.entity,
        dto.entityId ?? null,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        now,
      );
    } catch (sqlErr) {
      this.logger.error(`Failed to insert audit log: ${(sqlErr as Error).message}`);
    }

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

  async findAll(filters: AuditQueryFilters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    try {
      const prismaDelegate = (this.prisma as any).auditLog;
      if (prismaDelegate?.findMany) {
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
          prismaDelegate.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
          }),
          prismaDelegate.count({ where }),
        ]);

        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        };
      }
    } catch {
      // Fallback to raw SQL below
    }

    // SQL Fallback query
    try {
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let pIdx = 1;

      if (filters.user_id) {
        conditions.push(`"user_id" = $${pIdx++}`);
        params.push(filters.user_id);
      }
      if (filters.role) {
        conditions.push(`LOWER("role") = LOWER($${pIdx++})`);
        params.push(filters.role);
      }
      if (filters.action) {
        conditions.push(`"action" ILIKE $${pIdx++}`);
        params.push(`%${filters.action}%`);
      }
      if (filters.startDate) {
        conditions.push(`"created_at" >= $${pIdx++}`);
        params.push(new Date(filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(`"created_at" <= $${pIdx++}`);
        params.push(new Date(filters.endDate));
      }

      const whereClause = conditions.join(' AND ');

      const totalResult: any = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "audit_logs" WHERE ${whereClause}`,
        ...params,
      );
      const total = Number(totalResult[0]?.count || 0);

      const dataResult: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at"
         FROM "audit_logs"
         WHERE ${whereClause}
         ORDER BY "created_at" DESC
         LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        ...params,
        limit,
        skip,
      );

      return {
        data: dataResult || [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    } catch (sqlErr) {
      this.logger.error(`Error querying audit logs via SQL: ${(sqlErr as Error).message}`);
      return { data: [], total: 0, page, limit, totalPages: 1 };
    }
  }

  async getById(id: string): Promise<AuditLogItem | null> {
    try {
      const prismaDelegate = (this.prisma as any).auditLog;
      if (prismaDelegate?.findUnique) {
        const item = await prismaDelegate.findUnique({ where: { id } });
        if (item) return item;
      }
    } catch {
      // Fallback
    }

    try {
      const res: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at"
         FROM "audit_logs" WHERE "id" = $1 LIMIT 1`,
        id,
      );
      return res && res.length > 0 ? res[0] : null;
    } catch {
      return null;
    }
  }

  async getByUserId(userId: string): Promise<AuditLogItem[]> {
    try {
      const prismaDelegate = (this.prisma as any).auditLog;
      if (prismaDelegate?.findMany) {
        return await prismaDelegate.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: 50,
        });
      }
    } catch {
      // Fallback
    }

    try {
      const res: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at"
         FROM "audit_logs" WHERE "user_id" = $1
         ORDER BY "created_at" DESC LIMIT 50`,
        userId,
      );
      return res || [];
    } catch {
      return [];
    }
  }

  async getByEntity(entity: string, entityId?: string): Promise<AuditLogItem[]> {
    try {
      const prismaDelegate = (this.prisma as any).auditLog;
      if (prismaDelegate?.findMany) {
        const where: any = { entity };
        if (entityId) where.entity_id = entityId;
        return await prismaDelegate.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: 50,
        });
      }
    } catch {
      // Fallback
    }

    try {
      if (entityId) {
        const res: any = await this.prisma.$queryRawUnsafe(
          `SELECT "id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at"
           FROM "audit_logs" WHERE "entity" = $1 AND "entity_id" = $2
           ORDER BY "created_at" DESC LIMIT 50`,
          entity,
          entityId,
        );
        return res || [];
      } else {
        const res: any = await this.prisma.$queryRawUnsafe(
          `SELECT "id", "user_id", "role", "action", "entity", "entity_id", "metadata", "created_at"
           FROM "audit_logs" WHERE "entity" = $1
           ORDER BY "created_at" DESC LIMIT 50`,
          entity,
        );
        return res || [];
      }
    } catch {
      return [];
    }
  }
}
