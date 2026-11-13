import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, isValidRole } from './roles.enum';

export interface AuthUserResponse {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  tenantId?: string | null;
  tenant?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  email_confirmed_at?: Date | string | null;
  banned_until?: Date | string | null;
  created_at: Date | string;
  updated_at?: Date | string | null;
}

export interface LoginResult {
  ok: boolean;
  access_token: string;
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(private readonly prisma: PrismaService) {
    this.jwtSecret =
      process.env.JWT_SECRET || 'electrofix-super-secret-local-jwt-key-32chars';
  }

  private mapUser(user: any): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name || null,
      role: user.role as UserRole,
      tenantId: user.tenantId || null,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            phone: user.tenant.phone,
          }
        : null,
      email_confirmed_at: user.createdAt,
      banned_until: user.bannedUntil ? user.bannedUntil.toISOString() : null,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  private generateToken(user: AuthUserResponse): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
      this.jwtSecret,
      { expiresIn: '7d' },
    );
  }

  /**
   * Authenticates user against local SQLite database using bcrypt.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifica tu email y contraseña.',
      );
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new ForbiddenException('La cuenta ha sido suspendida.');
    }

    const passwordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException(
        'Credenciales inválidas. Verifica tu email y contraseña.',
      );
    }

    const mapped = this.mapUser(user);
    const token = this.generateToken(mapped);

    return {
      ok: true,
      access_token: token,
      user: mapped,
    };
  }

  /**
   * Returns count of registered users.
   */
  async getUserCount(): Promise<number> {
    try {
      return await this.prisma.user.count();
    } catch {
      return 0;
    }
  }

  /**
   * Creates a new user with the specified role in local SQLite database.
   */
  async createUserWithRole(
    email: string,
    password: string,
    role: UserRole,
    name?: string,
    tenantId?: string,
  ): Promise<AuthUserResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidRole(role)) {
      throw new BadRequestException(`Rol no válido: ${String(role)}`);
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un usuario con el email ${normalizedEmail}.`,
      );
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // If tenantId not provided and role is workshop-based, assign first tenant by default
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && role !== 'admin') {
      const defaultTenant = await this.prisma.tenant.findFirst();
      resolvedTenantId = defaultTenant?.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name || normalizedEmail.split('@')[0],
        role,
        tenantId: resolvedTenantId || null,
      },
      include: { tenant: true },
    });

    return this.mapUser(created);
  }

  /**
   * Updates user role in database.
   */
  async updateUserRole(
    userId: string,
    newRole: UserRole,
  ): Promise<AuthUserResponse> {
    if (!isValidRole(newRole)) {
      throw new BadRequestException(`Rol no válido: ${String(newRole)}`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      include: { tenant: true },
    });

    return this.mapUser(updated);
  }

  /**
   * Suspends / bans a user.
   */
  async disableUser(userId: string): Promise<{ ok: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    // Ban until 100 years in future
    const bannedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { bannedUntil },
    });

    return {
      ok: true,
      message: `Usuario ${userId} deshabilitado exitosamente.`,
    };
  }

  /**
   * Permanently deletes a user.
   */
  async deleteUser(userId: string): Promise<{ ok: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true, message: `Usuario ${userId} eliminado exitosamente.` };
  }

  /**
   * Lists all users.
   */
  async getAllUsers(): Promise<AuthUserResponse[]> {
    const users = await this.prisma.user.findMany({
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.mapUser(u));
  }

  /**
   * Fetches user by ID.
   */
  async getUserById(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado.`);
    }
    return this.mapUser(user);
  }
}
