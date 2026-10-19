import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { InvitationsModule } from './invitations/invitations.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [AuditModule, InvitationsModule, DashboardModule],
  exports: [AuditModule, InvitationsModule, DashboardModule],
})
export class AdminSuiteModule {}
