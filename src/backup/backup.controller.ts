import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { BackupService } from './backup.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('backup')
@UseGuards(RolesGuard)
@Roles('admin', 'taller')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('all')
  async exportAll(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportAllJson(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-full-backup-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('zip')
  async exportZip(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const zipBuffer = await this.backupService.exportAllZip(user);
    const dateStr = new Date().toISOString().split('T')[0];

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="electrofix-backup-${dateStr}.zip"`,
      'Content-Length': zipBuffer.length.toString(),
    });

    res.end(zipBuffer);
  }

  @Get('tickets')
  async exportTickets(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportTickets(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-tickets-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('users')
  async exportUsers(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportUsers(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-users-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('payments')
  async exportPayments(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportPayments(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-payments-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('invoices')
  async exportInvoices(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportInvoices(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-invoices-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('audit')
  async exportAudit(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportAuditLogs(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-audit-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('invitations')
  async exportInvitations(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportInvitations(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-invitations-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('dashboard')
  async exportDashboard(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportDashboardMetrics(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-dashboard-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('config')
  async exportConfig(
    @Query('download') download: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as unknown as { user?: any }).user;
    const data = await this.backupService.exportSystemConfig(user);

    if (download === 'true' || download === '1') {
      const dateStr = new Date().toISOString().split('T')[0];
      res.set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="electrofix-config-${dateStr}.json"`,
      });
    }

    return data;
  }

  @Get('history')
  async getHistory() {
    return this.backupService.getBackupHistory();
  }
}
