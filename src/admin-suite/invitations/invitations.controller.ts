import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../auth/auth.middleware';

@Controller(['admin-suite/invitations', 'invitations'])
@UseGuards(RolesGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get()
  @Roles('admin', 'taller')
  async listInvitations() {
    return this.invitationsService.listInvitations();
  }

  @Post()
  @Roles('admin', 'taller')
  async createInvitation(
    @Body() body: { email: string; role: string },
    @Req() req: Request,
  ) {
    if (!body?.email || !body?.role) {
      throw new BadRequestException('Email y rol son requeridos');
    }

    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    const creatorUserId = user?.id;
    const creatorRole =
      user?.role ||
      (user?.app_metadata?.role as string | undefined) ||
      (user?.user_metadata?.role as string | undefined);

    return this.invitationsService.createInvitation(
      body.email,
      body.role,
      creatorUserId,
      creatorRole,
    );
  }

  @Get(':token')
  async validateToken(@Param('token') token: string) {
    const res = await this.invitationsService.validateToken(token);
    if (!res.valid) {
      throw new BadRequestException(res.reason || 'Token inválido o expirado');
    }
    return res;
  }

  @Post('accept')
  async acceptInvitation(
    @Body() body: { token: string; password: string },
  ) {
    if (!body?.token || !body?.password) {
      throw new BadRequestException('Token y contraseña son requeridos');
    }
    return this.invitationsService.acceptInvitation(body.token, body.password);
  }
}
