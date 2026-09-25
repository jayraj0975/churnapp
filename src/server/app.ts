import { randomUUID } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { buildFallbackStrategy, calculateChurnPrediction, simulateWhatIf, standardLevers, MODEL_METRICS, MODEL_PROVENANCE } from '../lib/churnEngine.ts';
import { validateAdjustments, validateProfile } from '../lib/validate.ts';
import type { CustomerProfile, WhatIfAdjustments } from '../types.ts';
import { buildPrompt, redact, requestGeminiStrategy } from './gemini.ts';
import type { GeminiLike } from './gemini.ts';
import { createRateLimiter } from './rateLimit.ts';

export interface AppOptions {
  /** Returns the Gemini client, or null when no key is configured. */
  getGeminiClient?: () => GeminiLike | null;
  /** The configured key, only so it can be scrubbed from log lines. Never sent anywhere. */
  geminiKey?: string;
  now?: () => number;
  /** General limit for every /api route, per client address. */
  apiLimit?: { windowMs: number; max: number };
  /** Limit for everything else (the app, its files, the PWA routes), per client address. A page load
   *  fetches dozens of files, so this is far more generous than the API limit. */
  pageLimit?: { windowMs: number; max: number };
  /** Stricter limit on the route that can spend Gemini quota, per client address. */
  geminiLimit?: { windowMs: number; max: number };
  /** Ceiling on Gemini calls across all clients, so one instance has a bounded bill. */
  geminiHourlyCap?: number;
  geminiTimeoutMs?: number;
  logger?: { warn: (msg: string) => void };
  /** Passed to Express `trust proxy`. Leave unset unless a reverse proxy sits in front. */
  trustProxy?: boolean | number | string;
}

const envInt = (name: string, dflt: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

/** The JSON API. Static files, the PWA routes and Vite are added by server.ts around it. */
export function createApp(opts: AppOptions = {}) {
  const app = express();
  const now = opts.now ?? Date.now;
  const log = opts.logger ?? console;
  const timeoutMs = opts.geminiTimeoutMs ?? envInt('GEMINI_TIMEOUT_MS', 12_000);

  if (opts.trustProxy !== undefined) app.set('trust proxy', opts.trustProxy);
  app.disable('x-powered-by');

  const apiLimiter = createRateLimiter({ ...(opts.apiLimit ?? { windowMs: 60_000, max: envInt('API_RATE_LIMIT_PER_MIN', 120) }), now });
  const pageLimiter = createRateLimiter({ ...(opts.pageLimit ?? { windowMs: 60_000, max: envInt('PAGE_RATE_LIMIT_PER_MIN', 600) }), now });
  const geminiLimiter = createRateLimiter({ ...(opts.geminiLimit ?? { windowMs: 60_000, max: envInt('GEMINI_RATE_LIMIT_PER_MIN', 5) }), now });
  const geminiHourly = createRateLimiter({ windowMs: 3_600_000, max: opts.geminiHourlyCap ?? envInt('GEMINI_MAX_CALLS_PER_HOUR', 100), now });

  // A request id on every response, and in every log line, so one request can be followed.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get('x-request-id');
    const id = incoming && /^[A-Za-z0-9._-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
  });

  app.use('/api', apiLimiter.middleware);
  // Static files, the service worker and the single-page-app fallback are served by routes added after this
  // app is created, and they read the file system, so they are rate-limited too (the API has its own limit above).
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/api') ? next() : pageLimiter.middleware(req, res, next));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), geminiConfigured: Boolean(opts.getGeminiClient?.()) });
  });

  app.post('/api/predict', (req, res) => {
    const error = validateProfile(req.body);
    if (error) return res.status(400).json({ error });
    const threshold = req.body.threshold === undefined ? 0.5 : Number(req.body.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      return res.status(400).json({ error: 'threshold must be a number between 0 and 1' });
    }
    return res.json(calculateChurnPrediction(req.body as CustomerProfile, threshold));
  });

  app.post(['/api/simulate-what-if', '/api/simulate'], (req, res) => {
    const { profile, adjustments } = req.body ?? {};
    const error = validateProfile(profile) ?? validateAdjustments(adjustments);
    if (error) return res.status(400).json({ error });
    return res.json(simulateWhatIf(profile as CustomerProfile, adjustments as WhatIfAdjustments));
  });

  app.get(['/api/model-info', '/api/metrics'], (_req, res) => {
    res.json({ ...MODEL_METRICS, provenance: MODEL_PROVENANCE });
  });

  // Retention plan: Gemini writes the wording when a key is configured, otherwise (or whenever Gemini
  // is rate-limited, slow, down or answers badly) a deterministic plan built from the model's own
  // what-if results is returned. The prediction and impact figures always come from the model, never
  // from the client and never from Gemini, and the endpoint never fails because Gemini did.
  app.post('/api/retention-strategy', async (req, res) => {
    const profile = req.body?.profile;
    const error = validateProfile(profile);
    if (error) return res.status(400).json({ error });

    const customer = profile as CustomerProfile;
    const prediction = calculateChurnPrediction(customer);
    const levers = standardLevers(customer).slice(0, 3);

    let plan = null;
    let source = 'deterministic';
    const client = opts.getGeminiClient?.() ?? null;
    if (client) {
      const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      if (!geminiLimiter.consume(key).allowed || !geminiHourly.consume('all-clients').allowed) {
        source = 'deterministic (Gemini rate-limited)';
      } else {
        try {
          plan = await requestGeminiStrategy(client, buildPrompt(customer, prediction, levers), timeoutMs);
          source = 'gemini';
        } catch (err) {
          source = 'deterministic (Gemini unavailable)';
          const msg = err instanceof Error ? err.message : String(err);
          log.warn(`[${res.locals.requestId}] Gemini call failed, using the deterministic plan: ${redact(msg, opts.geminiKey)}`);
        }
      }
    }
    res.setHeader('X-Retention-Source', source);
    return res.json(plan ?? buildFallbackStrategy(customer, prediction));
  });

  // JSON errors (malformed or oversized body) instead of Express's default HTML page.
  app.use('/api', (err: { status?: number; type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large (limit 50 kB)' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    return res.status(err.status && err.status >= 400 && err.status < 500 ? err.status : 500).json({ error: 'Request failed' });
  });

  return app;
}
