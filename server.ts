import 'dotenv/config';
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createApp } from './src/server/app.ts';
import type { GeminiLike } from './src/server/gemini.ts';

const PORT = Number(process.env.PORT) || 3000;
const PLACEHOLDER = 'MY_GEMINI_API_KEY';

// Lazy-initialized Gemini client. The key is read from the environment (or a local .env file) on the
// server only; it is never sent to the browser and never logged.
const geminiKey = process.env.GEMINI_API_KEY;
let genAIClient: GoogleGenAI | null = null;
function getGenAIClient(): GeminiLike | null {
  if (genAIClient) return genAIClient as unknown as GeminiLike;
  if (geminiKey && geminiKey !== PLACEHOLDER) {
    genAIClient = new GoogleGenAI({ apiKey: geminiKey });
    return genAIClient as unknown as GeminiLike;
  }
  return null;
}

// Only trust X-Forwarded-For when told a reverse proxy is in front (TRUST_PROXY=1 for one hop).
const trust = process.env.TRUST_PROXY;
const app = createApp({
  getGeminiClient: getGenAIClient,
  geminiKey,
  trustProxy: trust === undefined ? undefined : /^\d+$/.test(trust) ? Number(trust) : trust === 'true',
});

// PWA Manifest and Service Worker routes with CORS for PWABuilder & external scanners
app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  // An explicit root keeps this working when the app lives under a dot-directory (Express 5 refuses those).
  res.sendFile('manifest.json', { root: path.join(process.cwd(), 'public') });
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile('sw.js', { root: path.join(process.cwd(), 'public') });
});

// Enable CORS for static PWA assets
app.use((req, res, next) => {
  if (req.path.match(/\.(png|svg|ico|jpg|webp)$/)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  next();
});
app.use(express.static(path.join(process.cwd(), 'public')));

// Vite middleware and static serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (req, res) => {
      res.sendFile('index.html', { root: distPath });
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Churn Predictor server running on http://0.0.0.0:${PORT}`);
  });
  // Bounded timeouts, so a slow or stalled client cannot hold a connection open indefinitely.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
}

start();
