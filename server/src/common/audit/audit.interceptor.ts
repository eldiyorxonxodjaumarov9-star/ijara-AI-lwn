import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { AuditService } from './audit.service';

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();

    if (!MUTATING_METHODS.includes(request.method)) {
      return next.handle();
    }

    const entity = request.path.split('/').filter(Boolean)[1] ?? 'unknown';

    return next.handle().pipe(
      tap(() => {
        void this.auditService.log({
          userId: request.user?.id ?? null,
          action: request.method,
          entity,
          entityId: (request.params?.id as string) ?? null,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }),
    );
  }
}
