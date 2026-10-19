import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../admin-suite/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../admin-suite/dashboard/dashboard.module';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, DashboardModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
