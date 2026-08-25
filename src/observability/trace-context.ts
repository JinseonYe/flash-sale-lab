import { trace } from '@opentelemetry/api';

export function getActiveTraceContext(): {
  traceId?: string;
  spanId?: string;
} {
  const span = trace.getActiveSpan();

  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
