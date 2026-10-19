import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import {
  BillingService,
  RegisterPaymentDto,
  CreateInvoiceDto,
  MercadoPagoPreferenceDto,
} from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('payments')
  async getPayments(
    @Query('ticketId') ticketId?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    return this.billingService.getPayments({ ticketId, status, method });
  }

  @Post('payments')
  async registerPayment(@Body() dto: RegisterPaymentDto) {
    return this.billingService.registerPayment(dto);
  }

  @Get('payments/:id')
  async getPaymentById(@Param('id') id: string) {
    return this.billingService.getPaymentById(id);
  }

  @Get('invoices')
  async getInvoices() {
    return this.billingService.getInvoices();
  }

  @Post('invoices')
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices/:id')
  async getInvoiceById(@Param('id') id: string) {
    return this.billingService.getInvoiceById(id);
  }

  @Get('summary')
  async getDailyCashClosing() {
    return this.billingService.getDailyCashClosing();
  }

  @Post('mercadopago/preference')
  async createMercadoPagoPreference(@Body() dto: MercadoPagoPreferenceDto) {
    return this.billingService.createMercadoPagoPreference(dto);
  }
}
