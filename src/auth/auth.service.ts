import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, isValidRole } from './roles.enum';

try {
  process.loadEnvFile?.();
} catch {
  // .env file is optional when environment variables are already provided
}

export interface AuthUserResponse {
  id: string;
  email: string | null;
  role: UserRole;
  email_confirmed_at: Date | string | null;
  banned_until?: Date | string | null;
  created_at: Date | string;
  updated_at?: Date | string | null;
}

@Injectable()
export class AuthService {
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      supabaseUrl &&
      supabaseServiceRoleKey &&
      !supabaseServiceRoleKey.includes('placeholder')
    ) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  /**
   * Returns the count of registered users in the system.
   */
  async getUserCount(): Promise<number> {
    try {
      const result = await this.prisma.$queryRawUnsafe<Array<{ count: number | string }>>(
        'SELECT COUNT(*)::int as count FROM auth.users;',
      );
      return Number(result[0]?.count ?? 0);
    } catch {
      const users = await this.getAllUsers().catch(() => []);
      return users.length;
    }
  }

  /**
   * Creates a new user with the specified role using Supabase Admin API
   * or falls back to direct Prisma SQL upsert if needed.
   */
  async createUserWithRole(
    email: string,
    password: string,
    role: UserRole,
  ): Promise<AuthUserResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidRole(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    if (this.supabaseAdmin) {
      try {
        const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { role },
          app_metadata: { role },
        });

        if (!error && data?.user) {
          const u = data.user;
          return {
            id: u.id,
            email: u.email ?? normalizedEmail,
            role,
            email_confirmed_at: u.email_confirmed_at ?? new Date().toISOString(),
            banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
            created_at: u.created_at,
            updated_at: u.updated_at,
          };
        }

        // If error is not a service key or network configuration issue, throw
        if (
          error &&
          !error.message?.toLowerCase().includes('invalid api key') &&
          !error.message?.toLowerCase().includes('jwt')
        ) {
          throw new BadRequestException(error.message);
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        // Otherwise proceed to Prisma fallback
      }
    }

    // Prisma Fallback
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          email: string | null;
          role: string;
          email_confirmed_at: Date | string | null;
          raw_user_meta_data: Record<string, unknown> | null;
          raw_app_meta_data: Record<string, unknown> | null;
          banned_until: Date | string | null;
          created_at: Date | string;
          updated_at: Date | string | null;
        }>
      >(
        `
        WITH upserted_user AS (
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            phone_change,
            phone_change_token,
            email_change_token_current,
            email_change_confirm_status,
            reauthentication_token,
            raw_app_meta_data,
            raw_user_meta_data,
            is_sso_user,
            is_anonymous,
            created_at,
            updated_at
          )
          VALUES (
            '00000000-0000-0000-0000-000000000000'::uuid,
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            $1,
            extensions.crypt($2, extensions.gen_salt('bf', 10)),
            now(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            0,
            '',
            jsonb_build_object('provider', 'email', 'providers', json_build_array('email'), 'role', $3::text),
            jsonb_build_object('email', $1, 'email_verified', true, 'phone_verified', false, 'role', $3::text),
            false,
            false,
            now(),
            now()
          )
          ON CONFLICT (email) WHERE (is_sso_user = false)
          DO UPDATE SET
            encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
            raw_app_meta_data = COALESCE(auth.users.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('provider', 'email', 'providers', json_build_array('email'), 'role', $3::text),
            raw_user_meta_data = COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', $1, 'email_verified', true, 'role', $3::text),
            updated_at = now()
          RETURNING id, email, role, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, banned_until, created_at, updated_at
        ),
        inserted_identity AS (
          INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
          )
          SELECT
            gen_random_uuid(),
            u.id,
            u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
            'email',
            now(),
            now(),
            now()
          FROM upserted_user u
          WHERE NOT EXISTS (
            SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
          )
        )
        SELECT * FROM upserted_user;
        `,
        normalizedEmail,
        password,
        role,
      );

      const created = rows[0];
      return {
        id: created.id,
        email: created.email,
        role,
        email_confirmed_at: created.email_confirmed_at,
        banned_until: created.banned_until,
        created_at: created.created_at,
        updated_at: created.updated_at,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating user via database';
      throw new InternalServerErrorException(msg);
    }
  }

  /**
   * Updates user role in Supabase auth metadata and database.
   */
  async updateUserRole(userId: string, role: UserRole): Promise<AuthUserResponse> {
    if (!isValidRole(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    if (this.supabaseAdmin) {
      try {
        const { data, error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
          app_metadata: { role },
          user_metadata: { role },
        });

        if (!error && data?.user) {
          const u = data.user;
          return {
            id: u.id,
            email: u.email ?? null,
            role,
            email_confirmed_at: u.email_confirmed_at ?? null,
            banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
            created_at: u.created_at,
            updated_at: u.updated_at,
          };
        }
      } catch {
        // Fallback to Prisma below
      }
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          email: string | null;
          email_confirmed_at: Date | string | null;
          raw_app_meta_data: Record<string, unknown> | null;
          raw_user_meta_data: Record<string, unknown> | null;
          banned_until: Date | string | null;
          created_at: Date | string;
          updated_at: Date | string | null;
        }>
      >(
        `
        UPDATE auth.users
        SET
          raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', $2::text),
          raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', $2::text),
          updated_at = now()
        WHERE id = $1::uuid
        RETURNING id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at;
        `,
        userId,
        role,
      );

      if (!rows || rows.length === 0) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const u = rows[0];
      return {
        id: u.id,
        email: u.email,
        role,
        email_confirmed_at: u.email_confirmed_at,
        banned_until: u.banned_until,
        created_at: u.created_at,
        updated_at: u.updated_at,
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) throw err;
      const msg = err instanceof Error ? err.message : 'Error updating user role';
      throw new InternalServerErrorException(msg);
    }
  }

  /**
   * Suspends / bans a user.
   */
  async disableUser(userId: string): Promise<{ ok: boolean; message: string }> {
    if (this.supabaseAdmin) {
      try {
        const { error } = await this.supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h',
        });
        if (!error) {
          return { ok: true, message: 'User suspended successfully' };
        }
      } catch {
        // Fallback to Prisma below
      }
    }

    try {
      await this.prisma.$queryRawUnsafe(
        `
        UPDATE auth.users
        SET banned_until = now() + interval '100 years', updated_at = now()
        WHERE id = $1::uuid;
        `,
        userId,
      );
      return { ok: true, message: 'User suspended successfully' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error suspending user';
      throw new InternalServerErrorException(msg);
    }
  }

  /**
   * Completely removes a user.
   */
  async deleteUser(userId: string): Promise<{ ok: boolean; message: string }> {
    if (this.supabaseAdmin) {
      try {
        const { error } = await this.supabaseAdmin.auth.admin.deleteUser(userId);
        if (!error) {
          return { ok: true, message: 'User deleted successfully' };
        }
      } catch {
        // Fallback to Prisma below
      }
    }

    try {
      await this.prisma.$queryRawUnsafe(
        `DELETE FROM auth.identities WHERE user_id = $1::uuid;`,
        userId,
      );
      await this.prisma.$queryRawUnsafe(
        `DELETE FROM auth.users WHERE id = $1::uuid;`,
        userId,
      );
      return { ok: true, message: 'User deleted successfully' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting user';
      throw new InternalServerErrorException(msg);
    }
  }

  /**
   * Lists all users with extracted role and status.
   */
  async getAllUsers(): Promise<AuthUserResponse[]> {
    if (this.supabaseAdmin) {
      try {
        const { data, error } = await this.supabaseAdmin.auth.admin.listUsers();
        if (!error && data?.users) {
          return data.users.map((u) => {
            const rawRole =
              (u.app_metadata?.role as string | undefined) ||
              (u.user_metadata?.role as string | undefined) ||
              'cliente';
            const role = isValidRole(rawRole) ? rawRole : 'cliente';

            return {
              id: u.id,
              email: u.email ?? null,
              role,
              email_confirmed_at: u.email_confirmed_at ?? null,
              banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
              created_at: u.created_at,
              updated_at: u.updated_at,
            };
          });
        }
      } catch {
        // Fallback to Prisma below
      }
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          email: string | null;
          email_confirmed_at: Date | string | null;
          raw_app_meta_data: Record<string, unknown> | null;
          raw_user_meta_data: Record<string, unknown> | null;
          banned_until: Date | string | null;
          created_at: Date | string;
          updated_at: Date | string | null;
        }>
      >(
        `
        SELECT id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at
        FROM auth.users
        ORDER BY created_at DESC;
        `,
      );

      return rows.map((u) => {
        const rawRole =
          ((u.raw_app_meta_data as Record<string, unknown> | null)?.role as string | undefined) ||
          ((u.raw_user_meta_data as Record<string, unknown> | null)?.role as string | undefined) ||
          'cliente';
        const role = isValidRole(rawRole) ? rawRole : 'cliente';

        return {
          id: u.id,
          email: u.email,
          role,
          email_confirmed_at: u.email_confirmed_at,
          banned_until: u.banned_until,
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching users list';
      throw new InternalServerErrorException(msg);
    }
  }

  /**
   * Fetches a specific user by id.
   */
  async getUserById(userId: string): Promise<AuthUserResponse> {
    if (this.supabaseAdmin) {
      try {
        const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(userId);
        if (!error && data?.user) {
          const u = data.user;
          const rawRole =
            (u.app_metadata?.role as string | undefined) ||
            (u.user_metadata?.role as string | undefined) ||
            'cliente';
          const role = isValidRole(rawRole) ? rawRole : 'cliente';

          return {
            id: u.id,
            email: u.email ?? null,
            role,
            email_confirmed_at: u.email_confirmed_at ?? null,
            banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
            created_at: u.created_at,
            updated_at: u.updated_at,
          };
        }
      } catch {
        // Fallback to Prisma below
      }
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          email: string | null;
          email_confirmed_at: Date | string | null;
          raw_app_meta_data: Record<string, unknown> | null;
          raw_user_meta_data: Record<string, unknown> | null;
          banned_until: Date | string | null;
          created_at: Date | string;
          updated_at: Date | string | null;
        }>
      >(
        `
        SELECT id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, banned_until, created_at, updated_at
        FROM auth.users
        WHERE id = $1::uuid
        LIMIT 1;
        `,
        userId,
      );

      if (!rows || rows.length === 0) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const u = rows[0];
      const rawRole =
        ((u.raw_app_meta_data as Record<string, unknown> | null)?.role as string | undefined) ||
        ((u.raw_user_meta_data as Record<string, unknown> | null)?.role as string | undefined) ||
        'cliente';
      const role = isValidRole(rawRole) ? rawRole : 'cliente';

      return {
        id: u.id,
        email: u.email,
        role,
        email_confirmed_at: u.email_confirmed_at,
        banned_until: u.banned_until,
        created_at: u.created_at,
        updated_at: u.updated_at,
      };
    } catch (err: unknown) {
      if (err instanceof NotFoundException) throw err;
      const msg = err instanceof Error ? err.message : 'Error fetching user';
      throw new InternalServerErrorException(msg);
    }
  }
}
