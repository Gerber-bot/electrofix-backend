import { Controller, Get, Param, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuditService } from '../admin-suite/audit/audit.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('ticket/:id/pdf')
  async getTicketPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateTicketPdf(id);

    await this.auditService.logAction({
      action: 'GENERATE_TICKET_PDF',
      entity: 'REPORT',
      entityId: id,
      metadata: { type: 'WORK_ORDER_PDF' },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orden-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.status(HttpStatus.OK).send(pdfBuffer);
  }

  @Get('diagnostic/:id/pdf')
  async getDiagnosticPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generateDiagnosticPdf(id);

    await this.auditService.logAction({
      action: 'GENERATE_DIAGNOSTIC_PDF',
      entity: 'REPORT',
      entityId: id,
      metadata: { type: 'TECHNICAL_DIAGNOSTIC_PDF' },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="diagnostico-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.status(HttpStatus.OK).send(pdfBuffer);
  }

  @Get('payment/:id/pdf')
  async getPaymentPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generatePaymentReceiptPdf(id);

    await this.auditService.logAction({
      action: 'GENERATE_PAYMENT_RECEIPT_PDF',
      entity: 'REPORT',
      entityId: id,
      metadata: { type: 'PAYMENT_RECEIPT_PDF' },
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="recibo-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.status(HttpStatus.OK).send(pdfBuffer);
  }
}
