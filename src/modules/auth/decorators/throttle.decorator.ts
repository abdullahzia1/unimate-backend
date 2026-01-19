// Throttle decorator helpers to avoid code duplication
// Package is installed: @nestjs/throttler@6.5.0
import { Throttle } from '@nestjs/throttler';

/**
 * Throttle decorator for auth endpoints
 * Uses the 'auth' throttler configured in app.module.ts
 * Limits to 100 requests per 15 minutes
 */
export function ThrottleAuth() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return Throttle({ auth: { limit: 100, ttl: 900000 } });
}

/**
 * Throttle decorator for refresh token endpoint
 * Uses the 'default' throttler with custom limits
 * Limits to 10 requests per minute
 */
export function ThrottleRefresh() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return Throttle({ default: { limit: 10, ttl: 60000 } });
}
