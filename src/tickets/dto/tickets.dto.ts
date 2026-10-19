import { TicketStatus } from '@prisma/client';

export class CreateTicketDto {
  tenantId?: string;
  customerName: string;
  customerDni: string;
  customerPhone: string;
  deviceType: string;
  brandModel: string;
  serialOrImei?: string;
  reportedIssue: string;
  liquidDamageRisk?: boolean;
  estimatedCost?: number;
}

export class UpdateTicketDto {
  status?: TicketStatus;
  technicalDiagnosis?: string;
  qcPassed?: boolean;
  finalCost?: number;
  estimatedCost?: number;
  isPaid?: boolean;
}
