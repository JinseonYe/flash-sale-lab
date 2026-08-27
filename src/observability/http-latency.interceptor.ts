import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

import { httpRequestDurationSeconds } from './metrics';
import { getActiveTraceContext } from './trace-context';

const SLOW_REQUEST_THRESHOLD_MS = 500;

@Injectable()
export class HttpLatencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLatencyInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startedAt = Date.now();
    let errorStatusCode: number | undefined;

    return next.handle().pipe(
      tap({
        error: (error: unknown) => {
          errorStatusCode =
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
        },
      }),

      finalize(() => {
        const latencyMs = Date.now() - startedAt;
        const latencySeconds = latencyMs / 1000;
        const statusCode = errorStatusCode ?? response.statusCode;
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
            status_code: statusCode,
          },
          latencySeconds,
        );

        const isServerError = statusCode >= 500;
        const isSlowRequest = latencyMs >= SLOW_REQUEST_THRESHOLD_MS;

        if (!isServerError && !isSlowRequest) {
          return;
        }

        const logContext = {
          requestId: request.requestId,
          ...getActiveTraceContext(),
          method: request.method,
          route: routePath,
          statusCode,
          latencyMs,
        };

        if (isServerError) {
          this.logger.error({
            event: 'http_request_failed',
            ...logContext,
          });

          return;
        }

        this.logger.warn({
          event: 'http_request_slow',
          ...logContext,
        });
      }),
    );
  }
}
