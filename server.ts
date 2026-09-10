import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { calculateChurnPrediction, simulateWhatIf, MODEL_METRICS } from './src/lib/churnEngine.ts';
import { CustomerProfile, WhatIfAdjustments } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

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
  try {
    const profile = req.body as CustomerProfile;
    const threshold = req.body.threshold !== undefined ? Number(req.body.threshold) : 0.50;
    if (!profile) {
      return res.status(400).json({ error: 'Customer profile required' });
    }
    const result = calculateChurnPrediction(profile, threshold);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Prediction failed' });
  }
});

// What-If Simulation API
app.post('/api/simulate-what-if', (req, res) => {
  try {
    const { profile, adjustments } = req.body as {
      profile: CustomerProfile;
      adjustments: WhatIfAdjustments;
    };
    if (!profile || !adjustments) {
      return res.status(400).json({ error: 'Profile and adjustments required' });
    }
    const simulation = simulateWhatIf(profile, adjustments);
    return res.json(simulation);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

// Model Metadata & Diagnostics API
app.get('/api/model-info', (req, res) => {
  res.json(MODEL_METRICS);
});

// Retention Strategy Generator (Gemini AI with Intelligent Fallback)
app.post('/api/retention-strategy', async (req, res) => {
  try {
    const { profile, prediction } = req.body;
    if (!profile || !prediction) {
      return res.status(400).json({ error: 'Profile and prediction data are required' });
    }

    const ai = getGenAIClient();
    if (ai) {
      try {
        const prompt = `You are an elite Customer Retention Data Science and Customer Success strategist.
Analyze this at-risk customer from our Churn Prediction Model:
Customer Name: ${profile.name} (ID: ${profile.id})
Tenure: ${profile.tenure} months
Contract: ${profile.contract}
Internet Service: ${profile.internetService}
Tech Support: ${profile.techSupport ? 'Yes' : 'No'}
Online Security: ${profile.onlineSecurity ? 'Yes' : 'No'}
Monthly Charges: $${profile.monthlyCharges}
Payment Method: ${profile.paymentMethod}
Churn Probability: ${prediction.churnProbability}% (${prediction.riskLevel} Risk)
Top Risk Drivers: ${prediction.topRiskDrivers.map((d: any) => d.featureName).join(', ')}

Return a JSON object ONLY with the following schema:
{
  "customerName": "${profile.name}",
  "riskSummary": "Concise 1-2 sentence executive summary of why this customer is in jeopardy",
  "recommendedIncentives": [
    {
      "title": "Short title of offer",
      "impactEstimate": "e.g. -25% churn risk reduction",
      "costToBusiness": "e.g. $10/month for 3 months or $0 software cost",
      "roiVerdict": "High ROI / Immediate positive payback"
    }
  ],
  "actionScript": {
    "channel": "Email" or "Phone Call",
    "subjectOrOpener": "Compelling subject line or opening phone hook",
    "messageBody": "Polite, empathetic, value-packed outreach message tailored specifically to their situation and contract/tech support setup."
  },
  "timingRecommendation": "e.g. Initiate within 24-48 hours before next billing cycle",
  "aiGenerated": true
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to heuristic playbook:', geminiErr);
      }
    }

    // Heuristic playbook fallback (instant, zero failure)
    const isFiber = profile.internetService === 'Fiber optic';
    const isMonthToMonth = profile.contract === 'Month-to-month';
    const fallbackResponse = {
      customerName: profile.name,
      riskSummary: `${profile.name} exhibits a ${prediction.churnProbability}% churn likelihood due to ${
        isMonthToMonth ? 'month-to-month flexibility' : 'pricing sensitivity'
      } and ${!profile.techSupport ? 'unmonitored technical friction' : 'early tenure volatility'}.`,
      recommendedIncentives: [
        {
          title: isMonthToMonth ? '1-Year Annual Commitment Promotion' : 'Loyalty Renewal Credit',
          impactEstimate: isMonthToMonth ? '-28% Churn Probability' : '-18% Churn Probability',
          costToBusiness: '$10/mo credit for 6 months ($60 total investment)',
          roiVerdict: `High ROI: Protects $${prediction.annualRevenueAtRisk}/yr in recurring revenue.`,
        },
        {
          title: !profile.techSupport ? 'Complimentary 24/7 Tech Support Bundle' : 'Complimentary Security & Cloud Backup Suite',
          impactEstimate: '-14% Churn Probability',
          costToBusiness: '$0 incremental operational cost (software provisioning)',
          roiVerdict: 'Immediate Value Lock-in: Deepens device ecosystem integration.',
        },
        {
          title: 'Automated Billing Transition Incentive',
          impactEstimate: '-10% Involuntary Payment Churn',
          costToBusiness: 'One-time $20 statement billing credit',
          roiVerdict: 'Permanent friction reduction for monthly renewals.',
        },
      ],
      actionScript: {
        channel: prediction.churnProbability > 70 ? 'Phone Call' : 'Email',
        subjectOrOpener:
          prediction.churnProbability > 70
            ? `Hi ${profile.name.split(' ')[0]}, this is your dedicated Account Specialist checking in on your connection experience.`
            : `Exclusive VIP Loyalty Renewal: Upgrade your plan with premium perks for ${profile.name}`,
        messageBody: `Dear ${profile.name},\n\nThank you for being with us over the past ${profile.tenure} months. We noticed you're currently on our ${profile.contract} plan with ${profile.internetService} service. We value your membership and want to ensure you are getting optimal performance.\n\nToday, we'd like to offer you an exclusive renewal package: lock in a discounted rate guarantee for the next 12 months with complimentary 24/7 priority technical support included.\n\nPlease let us know if you'd like us to apply this directly to your next invoice.`,
      },
      timingRecommendation: 'Reach out within 48 hours prior to next monthly billing cycle.',
      aiGenerated: false,
    };

    return res.json(fallbackResponse);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to generate retention strategy' });
  }
});

// PWA Manifest and Service Worker routes with CORS for PWABuilder & external scanners
app.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  res.sendFile(manifestPath);
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  res.sendFile(swPath);
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Churn Predictor server running on http://0.0.0.0:${PORT}`);
  });
}

start();
