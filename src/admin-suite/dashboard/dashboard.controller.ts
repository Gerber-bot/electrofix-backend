import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';

@Controller('admin-suite/dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @Roles('admin', 'taller')
  async getMetrics() {
    return this.dashboardService.getMetrics();
  }

  @Get('charts')
  @Roles('admin', 'taller')
  async getCharts() {
    return this.dashboardService.getCharts();
  }
}
