import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TicketsModule } from './tickets/tickets.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AdminSuiteModule } from './admin-suite/admin-suite.module';
import { CacheModule } from './common/cache/cache.module';
import { ReportsModule } from './reports/reports.module';
import { BillingModule } from './billing/billing.module';
import { BackupModule } from './backup/backup.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    CacheModule,
    PrismaModule,
    TicketsModule,
    AiModule,
    AuthModule,
    AdminSuiteModule,
    ReportsModule,
    BillingModule,
    BackupModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
