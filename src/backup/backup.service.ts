import { Injectable, Logger } from '@nestjs/common';
import JSZip from 'jszip';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../admin-suite/audit/audit.service';
import { DashboardService } from '../admin-suite/dashboard/dashboard.service';

export interface BackupHistoryItem {
  id: string;
  user_id: string | null;
  role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly dashboardService: DashboardService,
  ) {}

  /**
   * Helper to log backup actions in AuditLog table via AuditService.
   */
  private async logExport(
    module: string,
    format: 'zip' | 'json',
    sizeBytes: number,
    recordCount: number,
    user?: any,
  ) {
    try {
      await this.auditService.logAction({
        userId: user?.id ?? null,
        role: user?.role ?? 'admin',
        action: 'BACKUP_EXPORT',
        entity: 'backup',
        entityId: module,
        metadata: {
          module,
          format,
          sizeBytes,
          recordCount,
          exportedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.warn(`Could not log backup export event to audit logs: ${(err as Error).message}`);
    }
  }

  /**
   * Export all repair tickets, device data, and notes.
   */
  async exportTickets(user?: any, recordAudit = true) {
    const tickets = await this.prisma.repairTicket.findMany({
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(tickets));
      await this.logExport('tickets', 'json', sizeBytes, tickets.length, user);
    }

    return tickets;
  }

  /**
   * Export user directory sanitized (no passwords/hashes).
   */
  async exportUsers(user?: any, recordAudit = true) {
    const users = await this.authService.getAllUsers();
    const sanitized = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      email_confirmed_at: u.email_confirmed_at,
      banned_until: u.banned_until ?? null,
      created_at: u.created_at,
      updated_at: u.updated_at ?? null,
    }));

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(sanitized));
      await this.logExport('users', 'json', sizeBytes, sanitized.length, user);
    }

    return sanitized;
  }

  /**
   * Export all registered payments.
   */
  async exportPayments(user?: any, recordAudit = true) {
    const payments = await this.prisma.payment.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(payments));
      await this.logExport('payments', 'json', sizeBytes, payments.length, user);
    }

    return payments;
  }

  /**
   * Export all registered invoices.
   */
  async exportInvoices(user?: any, recordAudit = true) {
    const invoices = await this.prisma.invoice.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(invoices));
      await this.logExport('invoices', 'json', sizeBytes, invoices.length, user);
    }

    return invoices;
  }

  /**
   * Export audit log entries.
   */
  async exportAuditLogs(user?: any, recordAudit = true) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 5000,
    });

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(logs));
      await this.logExport('audit', 'json', sizeBytes, logs.length, user);
    }

    return logs;
  }

  /**
   * Export staff invitations.
   */
  async exportInvitations(user?: any, recordAudit = true) {
    const invitations = await this.prisma.invitation.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(invitations));
      await this.logExport('invitations', 'json', sizeBytes, invitations.length, user);
    }

    return invitations;
  }

  /**
   * Export operational dashboard metrics snapshot.
   */
  async exportDashboardMetrics(user?: any, recordAudit = true) {
    const metrics = await this.dashboardService.getMetrics();

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(metrics));
      await this.logExport('dashboard', 'json', sizeBytes, 1, user);
    }

    return metrics;
  }

  /**
   * Export system configuration, tenant information and runtime metadata.
   */
  async exportSystemConfig(user?: any, recordAudit = true) {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        catalog: true,
      },
    });

    const config = {
      appName: 'ElectroFix OS',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      databaseEngine: 'PostgreSQL',
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      tenants,
    };

    if (recordAudit) {
      const sizeBytes = Buffer.byteLength(JSON.stringify(config));
      await this.logExport('config', 'json', sizeBytes, tenants.length, user);
    }

    return config;
  }

  /**
   * Combines all data collections into a structured master JSON object.
   */
  async exportAllJson(user?: any) {
    const [tickets, users, payments, invoices, auditLogs, invitations, dashboard, config] =
      await Promise.all([
        this.exportTickets(user, false),
        this.exportUsers(user, false),
        this.exportPayments(user, false),
        this.exportInvoices(user, false),
        this.exportAuditLogs(user, false),
        this.exportInvitations(user, false),
        this.exportDashboardMetrics(user, false),
        this.exportSystemConfig(user, false),
      ]);

    const masterBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      system: config,
      data: {
        tickets,
        users,
        payments,
        invoices,
        audit_logs: auditLogs,
        invitations,
        dashboard,
      },
    };

    const jsonStr = JSON.stringify(masterBackup);
    const sizeBytes = Buffer.byteLength(jsonStr);
    const recordCount =
      tickets.length +
      users.length +
      payments.length +
      invoices.length +
      auditLogs.length +
      invitations.length;

    await this.logExport('all', 'json', sizeBytes, recordCount, user);

    return masterBackup;
  }

  /**
   * Generates a multi-file compressed ZIP archive containing all collections in JSON format.
   */
  async exportAllZip(user?: any): Promise<Buffer> {
    const [tickets, users, payments, invoices, auditLogs, invitations, dashboard, config] =
      await Promise.all([
        this.exportTickets(user, false),
        this.exportUsers(user, false),
        this.exportPayments(user, false),
        this.exportInvoices(user, false),
        this.exportAuditLogs(user, false),
        this.exportInvitations(user, false),
        this.exportDashboardMetrics(user, false),
        this.exportSystemConfig(user, false),
      ]);

    const manifest = {
      application: 'ElectroFix OS',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      system: {
        databaseEngine: 'PostgreSQL',
        nodeVersion: process.version,
        platform: process.platform,
      },
      counts: {
        tickets: tickets.length,
        users: users.length,
        payments: payments.length,
        invoices: invoices.length,
        audit_logs: auditLogs.length,
        invitations: invitations.length,
        dashboard: 1,
      },
      files: [
        'manifest.json',
        'tickets.json',
        'users.json',
        'payments.json',
        'invoices.json',
        'audit_logs.json',
        'invitations.json',
        'dashboard.json',
        'system_config.json',
      ],
    };

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('tickets.json', JSON.stringify(tickets, null, 2));
    zip.file('users.json', JSON.stringify(users, null, 2));
    zip.file('payments.json', JSON.stringify(payments, null, 2));
    zip.file('invoices.json', JSON.stringify(invoices, null, 2));
    zip.file('audit_logs.json', JSON.stringify(auditLogs, null, 2));
    zip.file('invitations.json', JSON.stringify(invitations, null, 2));
    zip.file('dashboard.json', JSON.stringify(dashboard, null, 2));
    zip.file('system_config.json', JSON.stringify(config, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const totalRecords =
      tickets.length +
      users.length +
      payments.length +
      invoices.length +
      auditLogs.length +
      invitations.length;

    await this.logExport('all', 'zip', zipBuffer.length, totalRecords, user);

    return zipBuffer;
  }

  /**
   * Retrieves recent backup activities from the audit logs.
   */
  async getBackupHistory(): Promise<any[]> {
    try {
      const logs = await this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entity: 'backup' },
            { action: 'BACKUP_EXPORT' },
          ],
        },
        orderBy: { created_at: 'desc' },
        take: 100,
      });

      return logs;
    } catch (err) {
      this.logger.warn(`Could not fetch backup history from Prisma: ${(err as Error).message}`);
      return [];
    }
  }
}
