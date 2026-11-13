import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UserRole, isValidRole } from './roles.enum';
import { AuthenticatedUser } from './auth.middleware';

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateAdminDto {
  email: string;
  password: string;
  name?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
  tenantId?: string;
}

export interface UpdateRoleDto {
  role: UserRole;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Local demo login endpoint.
   */
  @Post('login')
  async login(@Body() body: LoginDto) {
    const email = body?.email;
    const password = body?.password;

    if (!email || !password) {
      throw new BadRequestException('Se requieren email y contraseña.');
    }

    return this.authService.login(email, password);
  }

  /**
   * Returns current authenticated user and session info.
   */
  @Get('me')
  async me(@Req() req: Request) {
    const user = (req as unknown as { user?: AuthenticatedUser })['user'];
    if (!user) {
      throw new UnauthorizedException('No hay sesión activa.');
    }
    return { ok: true, user };
  }

  /**
   * Logs out user (stateless JWT confirmation).
   */
  @Post('logout')
  async logout() {
    return { ok: true, message: 'Sesión finalizada exitosamente.' };
  }

  /**
   * Bootstrapping endpoint to initialize the first admin user.
   * If users already exist in the system, requires caller to have 'admin' role.
   */
  @Post('create-admin')
  async createAdmin(@Body() body: CreateAdminDto, @Req() req: Request) {
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
      throw new BadRequestException(
        'Fields "email" and "password" are required.',
      );
    }

    const totalUsers = await this.authService.getUserCount();
    if (totalUsers > 0) {
      const user = (req as unknown as { user?: AuthenticatedUser })['user'];
      const userRole = user?.role;

      if (userRole !== 'admin') {
        throw new ForbiddenException(
          'El sistema ya cuenta con usuarios registrados. Se requieren permisos de administrador para crear administradores.',
        );
      }
    }

    try {
      const user = await this.authService.createUserWithRole(
        email,
        password,
        'admin',
        body.name,
      );
      return { ok: true, user };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error creating admin';
      throw new BadRequestException(message);
    }
  }

  /**
   * Creates a user with any valid role. Requires admin role.
   */
  @Post('create-user')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createUser(@Body() body: CreateUserDto) {
    const email = body?.email?.trim();
    const password = body?.password;
    const role = body?.role;

    if (!email || !password || !role) {
      throw new BadRequestException(
        'Fields "email", "password" and "role" are required.',
      );
    }

    if (!isValidRole(role)) {
      throw new BadRequestException(`Invalid role: ${String(role)}`);
    }

    const user = await this.authService.createUserWithRole(
      email,
      password,
      role,
      body.name,
      body.tenantId,
    );
    return { ok: true, user };
  }

  /**
   * Updates an existing user's role. Requires admin role.
   */
  @Patch('update-role/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    const role = body?.role;

    if (!role || !isValidRole(role)) {
      throw new BadRequestException(
        `Valid role is required (admin, taller, tecnico, operador, cliente).`,
      );
    }

    const user = await this.authService.updateUserRole(id, role);
    return { ok: true, user };
  }

  /**
   * Suspends / bans a user. Requires admin role.
   */
  @Delete('disable/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async disableUser(@Param('id') id: string) {
    return this.authService.disableUser(id);
  }

  /**
   * Permanently deletes a user. Requires admin role.
   */
  @Delete('delete/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  /**
   * Lists all users. Accessible to admin and workshop managers.
   */
  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller')
  async getAllUsers() {
    const users = await this.authService.getAllUsers();
    return { ok: true, users };
  }

  /**
   * Fetches user by ID. Accessible to admin and workshop managers.
   */
  @Get('users/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'taller')
  async getUserById(@Param('id') id: string) {
    const user = await this.authService.getUserById(id);
    return { ok: true, user };
  }
}
