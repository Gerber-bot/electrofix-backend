import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto';
import { TicketStatus } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('tenant')
  async getTenant() {
    return this.ticketsService.getFirstTenant();
  }

  @Get('catalog')
  async getCatalog(@Query('tenantId') tenantId?: string) {
    return this.ticketsService.getCatalog(tenantId);
  }

  @Get('search')
  async search(@Query('dni') dni?: string, @Query('token') token?: string) {
    return this.ticketsService.searchTickets(dni, token);
  }

  @Get('track/:token')
  async getByToken(@Param('token') token: string) {
    return this.ticketsService.getTicketByToken(token);
  }

  @Get('by-dni/:dni')
  async getByDni(@Param('dni') dni: string) {
    return this.ticketsService.getTicketsByDni(dni);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }

  @Get()
  async getAll(@Query('status') status?: TicketStatus) {
    return this.ticketsService.getTickets(status);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.createTicket(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.updateTicket(id, dto);
  }

  @Patch(':id/*')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async updateNested(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.updateTicket(id, dto);
  }
}
