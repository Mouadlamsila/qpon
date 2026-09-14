import { Injectable } from '@nestjs/common';

type RateLimitEntry = { count: number; resetAt: number };

/**
 * In-process adapter for public request throttling. Replace this storage with
 * Redis for multi-instance deployments without changing callers.
 */
@Injectable()
export class RateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();

  consume(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (current.count >= maxAttempts) return false;
    current.count += 1;
    return true;
  }
}
