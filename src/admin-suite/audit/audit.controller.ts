import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';

@Controller(['admin-suite/audit', 'audit'])
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin')
  async listLogs(
    @Query('user_id') userId?: string,
    @Query('role') role?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll({
      user_id: userId,
      role,
      action,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles('admin')
  async getById(@Param('id') id: string) {
    const item = await this.auditService.getById(id);
    if (!item) {
      throw new NotFoundException(`Audit log with id ${id} not found`);
    }
    return item;
  }

  @Get('user/:userId')
  @Roles('admin')
  async getByUserId(@Param('userId') userId: string) {
    return this.auditService.getByUserId(userId);
  }

  @Get('entity/:entity/:entityId')
  @Roles('admin')
  async getByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getByEntity(entity, entityId);
  }
}
