import { Module } from '@nestjs/common';
import { AiAgentService } from './ai.service';
import { AiController } from './ai.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [PrismaModule, AuthModule, CatalogModule],
  controllers: [AiController],
  providers: [AiAgentService],
  exports: [AiAgentService],
})
export class AiModule {}
