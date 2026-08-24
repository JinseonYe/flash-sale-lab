import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { httpRequestDurationSeconds } from './metrics';

@Injectable()
export class HttpLatencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const latencyMs = Date.now() - startedAt;
        const latencySeconds = latencyMs / 1000;
        const route = request.route as unknown;

        const routePath =
          typeof route === 'object' &&
          route !== null &&
          'path' in route &&
          typeof route.path === 'string'
            ? route.path
            : request.path;

        httpRequestDurationSeconds.observe(
          {
            method: request.method,
            route: routePath,
            status_code: response.statusCode,
          },
          latencySeconds,
        );

        console.log(`${request.method} ${request.url} ${latencyMs}ms`);
      }),
    );
  }
}
