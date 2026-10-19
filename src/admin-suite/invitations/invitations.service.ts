import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { UserRole, isValidRole } from '../../auth/roles.enum';
import { randomBytes, randomUUID } from 'crypto';

export interface InvitationItem {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
  status?: 'active' | 'used' | 'expired';
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async createInvitation(
    email: string,
    role: string,
    creatorUserId?: string,
    creatorRole?: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidRole(role)) {
      throw new BadRequestException(`Rol no válido: ${role}`);
    }

    const id = randomUUID();
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const now = new Date();

    try {
      await this.prisma.invitation.create({
        data: {
          id,
          email: normalizedEmail,
          role,
          token,
          expires_at: expiresAt,
          used: false,
          created_at: now,
        },
      });
    } catch (err) {
      this.logger.error(`Error inserting invitation: ${(err as Error).message}`);
      throw new BadRequestException('No se pudo generar la invitación.');
    }

    // Log to AuditLog
    await this.auditService.logAction({
      userId: creatorUserId || null,
      role: creatorRole || null,
      action: 'INVITATION_CREATED',
      entity: 'invitation',
      entityId: id,
      metadata: {
        email: normalizedEmail,
        role,
        expiresAt: expiresAt.toISOString(),
      },
    });

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${appUrl}/auth/invite/${token}`;

    return {
      id,
      email: normalizedEmail,
      role,
      token,
      expires_at: expiresAt,
      inviteUrl,
    };
  }

  async validateToken(token: string): Promise<{ valid: boolean; invitation?: InvitationItem; reason?: string }> {
    if (!token) {
      throw new BadRequestException('Token de invitación requerido');
    }

    let invitation: InvitationItem | null = null;

    try {
      invitation = await this.prisma.invitation.findUnique({ where: { token } });
    } catch (err) {
      this.logger.error(`Error querying invitation by token: ${(err as Error).message}`);
    }

    if (!invitation) {
      return { valid: false, reason: 'Invitación no encontrada' };
    }

    if (invitation.used) {
      return { valid: false, reason: 'Esta invitación ya ha sido utilizada' };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return { valid: false, reason: 'La invitación ha expirado' };
    }

    return {
      valid: true,
      invitation: {
        ...invitation,
        status: 'active',
      },
    };
  }

  async acceptInvitation(token: string, password: string) {
    const validation = await this.validateToken(token);
    if (!validation.valid || !validation.invitation) {
      throw new BadRequestException(validation.reason || 'Invitación inválida');
    }

    const inv = validation.invitation;

    if (!password || password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    // 1. Create or register user in AuthService
    const user = await this.authService.createUserWithRole(
      inv.email,
      password,
      inv.role as UserRole,
    );

    // 2. Mark invitation as used
    try {
      await this.prisma.invitation.update({
        where: { token },
        data: { used: true },
      });
    } catch (err) {
      this.logger.error(`Error marking invitation used: ${(err as Error).message}`);
    }

    // 3. Log to AuditLog
    await this.auditService.logAction({
      userId: user.id,
      role: inv.role,
      action: 'INVITATION_ACCEPTED',
      entity: 'invitation',
      entityId: inv.id,
      metadata: {
        email: inv.email,
        role: inv.role,
        userId: user.id,
      },
    });

    return {
      ok: true,
      message: 'Invitación aceptada con éxito. Ya puedes iniciar sesión.',
      user,
    };
  }

  async listInvitations(): Promise<InvitationItem[]> {
    let rows: InvitationItem[] = [];

    try {
      rows = await this.prisma.invitation.findMany({
        orderBy: { created_at: 'desc' },
      });
    } catch (err) {
      this.logger.error(`Error querying invitations: ${(err as Error).message}`);
      rows = [];
    }

    const now = new Date();
    return rows.map((inv) => {
      let status: 'active' | 'used' | 'expired' = 'active';
      if (inv.used) {
        status = 'used';
      } else if (new Date(inv.expires_at) < now) {
        status = 'expired';
      }

      return {
        ...inv,
        status,
      };
    });
  }
}
