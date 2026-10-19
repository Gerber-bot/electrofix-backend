import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/auth.middleware';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request>();
    const method = request.method;

    // Only auto-audit mutating requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    if (!isMutating) {
      return next.handle();
    }

    const url = request.originalUrl || request.url;

    // Skip health checks, ai chats, or track queries if desired
    if (url.includes('/ai/chat') || url.includes('/health')) {
      return next.handle();
    }

    const user = (request as unknown as { user?: AuthenticatedUser })['user'];
    const userId = user?.id || null;
    const role =
      user?.role ||
      (user?.app_metadata?.role as string | undefined) ||
      (user?.user_metadata?.role as string | undefined) ||
      null;

    const action = `${method} ${url}`;
    const segments = url.split('/').filter(Boolean);
    const entity = segments.length > 0 ? segments[segments.length - 1] : 'unknown';

    // Mask passwords or sensitive tokens from payload
    const bodyCopy = { ...(request.body || {}) };
    if (bodyCopy.password) bodyCopy.password = '***';
    if (bodyCopy.token) bodyCopy.token = '***';

    const extractEntityId = (): string | null => {
      const idVal = request.params?.id;
      if (typeof idVal === 'string') return idVal;
      if (Array.isArray(idVal) && idVal.length > 0) return idVal[0];
      return null;
    };

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          this.auditService
            .logAction({
              userId,
              role,
              action,
              entity,
              entityId: extractEntityId(),
              metadata: {
                method,
                url,
                params: request.params,
                query: request.query,
                body: bodyCopy,
                status: 'SUCCESS',
              },
            })
            .catch(() => {});
        },
        error: (error) => {
          this.auditService
            .logAction({
              userId,
              role,
              action: `${action} [FAILED]`,
              entity,
              entityId: extractEntityId(),
              metadata: {
                method,
                url,
                params: request.params,
                query: request.query,
                body: bodyCopy,
                error: error?.message || 'Error occurred',
                status: 'ERROR',
              },
            })
            .catch(() => {});
        },
      }),
    );
  }
}
