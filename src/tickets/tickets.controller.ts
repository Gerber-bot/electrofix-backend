import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TicketsService } from './tickets.service';
import { CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto';
import { TicketStatus } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser } from '../auth/auth.middleware';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('tenant')
  async getTenant(@Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.getTenant(user);
  }

  @Get('catalog')
  async getCatalog(@Query('tenantId') tenantId?: string) {
    return this.ticketsService.getCatalog(tenantId);
  }

  @Get('search')
  async search(
    @Query('dni') dni?: string,
    @Query('token') token?: string,
    @Req() req?: Request,
  ) {
    const user = (req as unknown as { user?: AuthenticatedUser })?.['user'];
    return this.ticketsService.searchTickets(dni, token, user);
  }

  @Get('track/:token')
  async getByToken(@Param('token') token: string) {
    return this.ticketsService.getTicketByToken(token);
  }

  @Get('by-dni/:dni')
  async getByDni(@Param('dni') dni: string, @Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.getTicketsByDni(dni, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async getAll(@Query('status') status?: TicketStatus, @Req() req?: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })?.['user'];
    return this.ticketsService.getTickets(user, status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.getTicketById(id, user);
  }

  @Patch([':id/approve', 'track/:token/approve', 'approve/:id'])
  async approveBudget(
    @Param('id') id?: string,
    @Param('token') token?: string,
  ) {
    return this.ticketsService.approveBudget(id || token || '');
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async create(@Body() dto: CreateTicketDto, @Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.createTicket(dto, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.updateTicket(id, dto, user);
  }

  @Patch(':id/*')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico', 'operador')
  async updateNested(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    return this.ticketsService.updateTicket(id, dto, user);
  }
}
