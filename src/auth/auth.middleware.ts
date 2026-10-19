import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserRole, isValidRole } from './roles.enum';

export interface AuthenticatedUser extends User {
  role?: UserRole;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private supabase: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const devRoleHeader = req.headers['x-dev-role'] as string | undefined;

    // Optional dev token/header for local development testing
    if (process.env.NODE_ENV !== 'production' && devRoleHeader && isValidRole(devRoleHeader)) {
      (req as unknown as { user: AuthenticatedUser })['user'] = {
        id: 'dev-user-id',
        app_metadata: { role: devRoleHeader },
        user_metadata: { role: devRoleHeader },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        role: devRoleHeader,
        email: 'dev@electrofix.local',
      } as AuthenticatedUser;
      return next();
    }

    if (!authHeader || typeof authHeader !== 'string') {
      return next();
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return next();
    }

    const token = parts[1];

    if (!this.supabase) {
      return next();
    }

    try {
      const { data, error } = await this.supabase.auth.getUser(token);
      if (!error && data?.user) {
        const user = data.user as AuthenticatedUser;
        const role =
          (user.app_metadata?.role as string | undefined) ||
          (user.user_metadata?.role as string | undefined);

        if (role && isValidRole(role)) {
          user.role = role;
        }

        (req as unknown as { user: AuthenticatedUser })['user'] = user;
      }
    } catch {
      // In case of parsing/network error, allow request to proceed so public routes are not blocked
    }

    next();
  }
}
