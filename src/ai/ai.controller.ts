import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiAgentService } from './ai.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

export class CleanNoteDto {
  rawNotes?: string;
  rawNote?: string;
  device?: string;
}

export class ChatDto {
  message: string;
  customerDni?: string;
  tenantId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiAgentService) {}

  @Post('clean-note')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller', 'tecnico')
  async cleanNote(@Body() body: CleanNoteDto) {
    const raw = body?.rawNotes || body?.rawNote || '';
    const device = body?.device || 'Dispositivo';
    return this.aiService.formatTechNoteForCustomer(raw, device);
  }

  @Post('chat')
  async chat(@Body() body: ChatDto) {
    return this.aiService.handleCustomerMessage(body?.tenantId, body?.message || '', body?.customerDni);
  }
}
