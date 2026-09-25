import type { NextFunction, Request, Response } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Injectable clock, for tests. */
  now?: () => number;
  /** Upper bound on tracked keys, so a flood of distinct addresses cannot exhaust memory. */
  maxKeys?: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * A small fixed-window limiter keyed by string (normally the client address). No dependency,
 * in-memory and per process: enough to stop one client hammering an endpoint, not a distributed
 * flood (put a proxy or CDN limit in front of a public deployment for that).
 */
export function createRateLimiter(opts: RateLimiterOptions) {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  function sweep(t: number) {
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    // Still too many live keys: drop the oldest until there is room.
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
  }

  function consume(key: string): ConsumeResult {
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      if (hits.size >= maxKeys) sweep(t);
      entry = { count: 0, resetAt: t + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= opts.max;
    return {
      allowed,
      remaining: Math.max(0, opts.max - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)),
    };
  }

  function middleware(req: Request, res: Response, next: NextFunction) {
    const r = consume(req.ip ?? req.socket.remoteAddress ?? 'unknown');
    res.setHeader('RateLimit-Limit', String(opts.max));
    res.setHeader('RateLimit-Remaining', String(r.remaining));
    if (!r.allowed) {
      res.setHeader('Retry-After', String(r.retryAfterSec));
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    return next();
  }

  return { consume, middleware, size: () => hits.size };
}
