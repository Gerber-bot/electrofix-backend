import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './roles.enum';
import { AuthenticatedUser } from './auth.middleware';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as { user?: AuthenticatedUser })['user'];
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];

    // Local dev / bootstrapping fallback:
    // If running in non-production and no authorization header is provided,
    // allow access to prevent blocking initial local development and bootstrapping.
    const isNonProduction = process.env.NODE_ENV !== 'production';
    if (isNonProduction && !authHeader) {
      return true;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const userRole =
      user.role ||
      (user.app_metadata?.role as UserRole | undefined) ||
      (user.user_metadata?.role as UserRole | undefined);

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
