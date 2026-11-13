import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { UserRole, isValidRole } from './roles.enum';

export interface AuthenticatedUser {
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
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly jwtSecret: string;

  constructor() {
    this.jwtSecret =
      process.env.JWT_SECRET || 'electrofix-super-secret-local-jwt-key-32chars';
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      return next();
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (decoded && decoded.id && decoded.role && isValidRole(decoded.role)) {
        const user: AuthenticatedUser = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name || null,
          role: decoded.role,
          tenantId: decoded.tenantId || null,
          tenant: decoded.tenant || null,
        };
        (req as unknown as { user: AuthenticatedUser })['user'] = user;
      }
    } catch {
      // Invalid or expired token; req.user remains undefined
    }

    next();
  }
}
