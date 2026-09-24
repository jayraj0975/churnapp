import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { buildFallbackStrategy, calculateChurnPrediction, simulateWhatIf, standardLevers, MODEL_METRICS } from './src/lib/churnEngine.ts';
import { validateAdjustments, validateProfile } from './src/lib/validate.ts';
import { CustomerProfile, WhatIfAdjustments } from './src/types.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50kb' }));

// Lazy-initialized Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI | null {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    genAIClient = new GoogleGenAI({ apiKey });
    return genAIClient;
  }
  return null;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Model Prediction API
app.post('/api/predict', (req, res) => {
  const error = validateProfile(req.body);
  if (error) return res.status(400).json({ error });
  const threshold = req.body.threshold === undefined ? 0.5 : Number(req.body.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    return res.status(400).json({ error: 'threshold must be a number between 0 and 1' });
  }
  return res.json(calculateChurnPrediction(req.body as CustomerProfile, threshold));
});

// What-If Simulation API
app.post(['/api/simulate-what-if', '/api/simulate'], (req, res) => {
  const { profile, adjustments } = req.body ?? {};
  const error = validateProfile(profile) ?? validateAdjustments(adjustments);
  if (error) return res.status(400).json({ error });
  return res.json(simulateWhatIf(profile as CustomerProfile, adjustments as WhatIfAdjustments));
});

// Model Metadata & Diagnostics API
app.get(['/api/model-info', '/api/metrics'], (req, res) => {
  res.json(MODEL_METRICS);
});

// Retention Strategy Generator (Gemini, with a deterministic fallback).
// The prediction and the impact figures are computed here from the model, never
// taken from the client and never invented by the LLM.
app.post('/api/retention-strategy', async (req, res) => {
  const profile = req.body?.profile;
  const error = validateProfile(profile);
  if (error) return res.status(400).json({ error });

  const customer = profile as CustomerProfile;
  const prediction = calculateChurnPrediction(customer);
  const levers = standardLevers(customer).slice(0, 3);

  const ai = getGenAIClient();
  if (ai) {
    try {
      const prompt = `You are a customer-retention strategist. Write a retention plan for one customer.
Use ONLY the numbers given below. Do not invent statistics, percentages or prices.

Customer: ${customer.name}, tenure ${customer.tenure} months, ${customer.contract} contract, ${customer.internetService} internet,
tech support ${customer.techSupport ? 'yes' : 'no'}, online security ${customer.onlineSecurity ? 'yes' : 'no'},
$${customer.monthlyCharges}/month, pays by ${customer.paymentMethod}.
Model-predicted churn probability: ${prediction.churnProbability}% (${prediction.riskLevel} risk).
Top risk drivers: ${prediction.topRiskDrivers.map((d) => d.featureName).join('; ') || 'none'}.
Model what-if results (change in predicted churn, in points): ${
        levers.map((l) => `${l.title}: ${l.delta.toFixed(1)}`).join('; ') || 'no lever lowers the risk'
      }.

Return JSON only, with this shape:
{"customerName": string, "riskSummary": string (1-2 sentences),
 "recommendedIncentives": [{"title": string, "impactEstimate": string (quote the what-if number above), "costToBusiness": string (say it is an example), "roiVerdict": string}],
 "actionScript": {"channel": "Email" | "Phone Call", "subjectOrOpener": string, "messageBody": string},
 "timingRecommendation": string, "aiGenerated": true}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      if (response.text) return res.json(JSON.parse(response.text));
    } catch (geminiErr) {
      console.warn('Gemini call failed, using the deterministic plan:', geminiErr);
    }
  }
  return res.json(buildFallbackStrategy(customer, prediction));
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Churn Predictor server running on http://0.0.0.0:${PORT}`);
  });
}

start();
