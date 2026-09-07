import { randomUUID } from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';
type Fields = Record<string, string | number | boolean | null | undefined>;

export function requestCorrelationId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && /^[a-zA-Z0-9._-]{8,100}$/.test(candidate) ? candidate : randomUUID();
}

export function serverLog(level: LogLevel, event: string, fields: Fields = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}

export function correlationHeaders(requestId: string): HeadersInit {
  return { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' };
}
