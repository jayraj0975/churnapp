import model from './model.json';
import {
  CustomerProfile,
  PredictionResult,
  RiskFactorContribution,
  RetentionStrategyResponse,
  RiskLevel,
  WhatIfAdjustments,
} from '../types';

/**
 * Scoring engine.
 *
 * The model is a logistic regression trained offline by `scripts/train_model.py`
 * on IBM's Telco Customer Churn data and exported to `model.json` in raw units,
 * so scoring is just `sigmoid(intercept + sum(coefficient * value))`. Nothing
 * here is hand-tuned. `tests/engine.test.ts` checks these predictions against
 * scikit-learn's to 1e-9.
 */

type Model = typeof model;
const M: Model = model;

/** Risk bands on the predicted probability, in percent. The base rate is ~27%. */
export const RISK_BANDS = { moderateFrom: 20, highFrom: 50 };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** A profile as the model's numeric feature vector. */
export function featureVector(p: CustomerProfile): Record<string, number> {
  return {
    tenure: p.tenure,
    monthlyCharges: p.monthlyCharges,
    seniorCitizen: +p.seniorCitizen,
    partner: +p.partner,
    dependents: +p.dependents,
    phoneService: +p.phoneService,
    multipleLines: +p.multipleLines,
    onlineSecurity: +p.onlineSecurity,
    onlineBackup: +p.onlineBackup,
    deviceProtection: +p.deviceProtection,
    techSupport: +p.techSupport,
    streamingTV: +p.streamingTV,
    streamingMovies: +p.streamingMovies,
    paperlessBilling: +p.paperlessBilling,
    contractOneYear: +(p.contract === 'One year'),
    contractTwoYear: +(p.contract === 'Two year'),
    internetFiber: +(p.internetService === 'Fiber optic'),
    internetNone: +(p.internetService === 'No'),
    payMailedCheck: +(p.paymentMethod === 'Mailed check'),
    payBankTransfer: +(p.paymentMethod === 'Bank transfer (automatic)'),
    payCreditCard: +(p.paymentMethod === 'Credit card (automatic)'),
  };
}

/** Raw model probability in [0, 1]. */
export function churnProbability(p: CustomerProfile): number {
  const x = featureVector(p);
  let z = M.intercept;
  for (const [k, w] of Object.entries(M.coefficients)) z += w * x[k];
  return sigmoid(z);
}

/**
 * Features that are one categorical choice in the UI are shown as one factor.
 * Everything else is its own factor.
 */
const GROUPS: Record<string, { label: string; category: RiskFactorContribution['category']; keys: string[] }> = {
  contract: { label: 'Contract', category: 'Contract', keys: ['contractOneYear', 'contractTwoYear'] },
  internet: { label: 'Internet service', category: 'Services', keys: ['internetFiber', 'internetNone'] },
  payment: { label: 'Payment method', category: 'Billing', keys: ['payMailedCheck', 'payBankTransfer', 'payCreditCard'] },
};
const GROUPED_KEYS = new Set(Object.values(GROUPS).flatMap((g) => g.keys));

function levelName(p: CustomerProfile, group: string): string {
  if (group === 'contract') return p.contract;
  if (group === 'internet') return p.internetService === 'No' ? 'No internet' : p.internetService;
  return p.paymentMethod;
}

/**
 * How much each factor moves this customer's predicted churn relative to a
 * customer with the dataset-average value of that factor. Reported in
 * percentage points of probability (a log-odds contribution is passed through
 * the sigmoid around the customer's own score, so the pieces are interpretable
 * and roughly, not exactly, additive).
 *
 * This is association, not causation: it describes what the model has learned
 * from past customers.
 */
export function explain(p: CustomerProfile): RiskFactorContribution[] {
  const x = featureVector(p);
  const z = M.intercept + Object.entries(M.coefficients).reduce((s, [k, w]) => s + w * x[k], 0);
  const pts = (c: number) => (sigmoid(z) - sigmoid(z - c)) * 100;
  const out: RiskFactorContribution[] = [];

  const push = (label: string, category: RiskFactorContribution['category'], c: number, note: string) => {
    const impact = Math.round(pts(c) * 10) / 10;
    if (Math.abs(impact) < 0.5) return;
    out.push({
      featureName: label,
      category,
      impactPercentage: impact,
      direction: impact > 0 ? 'increases_risk' : 'reduces_risk',
      description: `${impact > 0 ? 'Raises' : 'Lowers'} predicted churn by about ${Math.abs(impact).toFixed(1)} points ` +
        `compared with a customer at the average for this factor. ${note}`,
    });
  };

  for (const [key, g] of Object.entries(GROUPS)) {
    const c = g.keys.reduce((s, k) => s + (M.coefficients as Record<string, number>)[k] * (x[k] - (M.means as Record<string, number>)[k]), 0);
    push(`${g.label}: ${levelName(p, key)}`, g.category, c, 'Learned from past customers, not a proven cause.');
  }
  for (const [k, w] of Object.entries(M.coefficients)) {
    if (GROUPED_KEYS.has(k)) continue;
    const feat = (M.features as Record<string, { label: string; category: RiskFactorContribution['category'] }>)[k];
    const c = w * (x[k] - (M.means as Record<string, number>)[k]);
    const value = k === 'tenure' ? `${p.tenure} months` : k === 'monthlyCharges' ? `$${p.monthlyCharges.toFixed(2)}/mo` : x[k] ? 'yes' : 'no';
    push(`${feat.label.replace(/ \(.*\)/, '')}: ${value}`, feat.category, c, 'Learned from past customers, not a proven cause.');
  }
  return out;
}

export function calculateChurnPrediction(profile: CustomerProfile, threshold: number = 0.5): PredictionResult {
  const z = M.intercept + Object.entries(M.coefficients).reduce((s, [k, w]) => s + w * featureVector(profile)[k], 0);
  const probability = churnProbability(profile);
  const percent = Math.round(probability * 1000) / 10; // e.g. 74.2

  const riskLevel: RiskLevel =
    percent >= RISK_BANDS.highFrom ? 'High' : percent >= RISK_BANDS.moderateFrom ? 'Moderate' : 'Low';

  const factors = explain(profile);
  const topRiskDrivers = factors
    .filter((f) => f.direction === 'increases_risk')
    .sort((a, b) => b.impactPercentage - a.impactPercentage)
    .slice(0, 5);
  const topProtectiveFactors = factors
    .filter((f) => f.direction === 'reduces_risk')
    .sort((a, b) => a.impactPercentage - b.impactPercentage)
    .slice(0, 5);

  // Billing exposed over a year, and the probability-weighted share of it.
  // Deliberately not a lifetime-value estimate: the data has no revenue history.
  const monthlyRevenueAtRisk = profile.monthlyCharges;
  const annualRevenueAtRisk = Math.round(monthlyRevenueAtRisk * 12);
  const expectedAnnualLoss = Math.round(annualRevenueAtRisk * probability);

  // Playbook suggestions are plain rules keyed off the profile, not model output.
  let retentionRecommendation = 'Low predicted risk. Keep the regular check-in cadence.';
  if (riskLevel === 'High') {
    if (profile.contract === 'Month-to-month' && !profile.techSupport) {
      retentionRecommendation =
        'High risk: offer a 1-year contract upgrade with tech support included, and confirm the price is competitive.';
    } else if (profile.paymentMethod === 'Electronic check') {
      retentionRecommendation =
        'High risk: offer a small credit for moving to automatic payment, paired with a contract-term discount.';
    } else {
      retentionRecommendation =
        'High risk: proactive outreach from customer success, with a plan review and loyalty pricing.';
    }
  } else if (riskLevel === 'Moderate') {
    if (profile.contract === 'Month-to-month') {
      retentionRecommendation = 'Moderate risk: offer an annual-plan discount.';
    } else if (!profile.onlineSecurity && profile.internetService !== 'No') {
      retentionRecommendation = 'Moderate risk: bundle online security and backup to deepen usage.';
    } else {
      retentionRecommendation = 'Moderate risk: send a satisfaction survey and check recent support tickets were resolved.';
    }
  }

  return {
    churnProbability: percent,
    riskLevel,
    willChurn: probability >= threshold,
    threshold,
    logit: Math.round(z * 100) / 100,
    expectedAnnualLoss,
    monthlyRevenueAtRisk,
    annualRevenueAtRisk,
    topRiskDrivers,
    topProtectiveFactors,
    retentionRecommendation,
  };
}

/**
 * What-if: re-score a modified profile and report the change.
 *
 * This is the model's counterfactual, not a causal estimate. The data is
 * observational, so "adding tech support" here means "a customer who looks like
 * this one but has tech support", which need not match what an offer would do.
 */
export function simulateWhatIf(
  baselineProfile: CustomerProfile,
  adjustments: WhatIfAdjustments,
): {
  baselineResult: PredictionResult;
  simulatedResult: PredictionResult;
  probabilityDelta: number;
  annualRevenueSaved: number;
  newRiskLevel: RiskLevel;
} {
  const baselineResult = calculateChurnPrediction(baselineProfile);

  const modified: CustomerProfile = {
    ...baselineProfile,
    contract: adjustments.contract ?? baselineProfile.contract,
    tenure: baselineProfile.tenure + (adjustments.tenureBonus ?? 0),
    monthlyCharges: Math.max(18, baselineProfile.monthlyCharges - (adjustments.monthlyDiscount ?? 0)),
    techSupport: adjustments.addTechSupport ?? baselineProfile.techSupport,
    onlineSecurity: adjustments.addOnlineSecurity ?? baselineProfile.onlineSecurity,
    paymentMethod: adjustments.switchPaymentMethod ?? baselineProfile.paymentMethod,
  };

  const simulatedResult = calculateChurnPrediction(modified);
  const probabilityDelta = Math.round((simulatedResult.churnProbability - baselineResult.churnProbability) * 10) / 10;

  // Expected annual billing kept if the change lowers the predicted risk.
  const reduction = Math.max(0, (baselineResult.churnProbability - simulatedResult.churnProbability) / 100);
  const annualRevenueSaved = Math.round(baselineResult.annualRevenueAtRisk * reduction);

  return { baselineResult, simulatedResult, probabilityDelta, annualRevenueSaved, newRiskLevel: simulatedResult.riskLevel };
}

export interface Lever {
  title: string;
  adjustments: WhatIfAdjustments;
  /** Change in predicted churn probability, in points (negative is better). */
  delta: number;
  /** Illustrative cost, an assumption and not something the data can tell us. */
  cost: string;
}

/**
 * The standard retention levers that apply to this customer, each scored by the
 * model, best first. Only levers the model predicts will lower risk are kept.
 */
export function standardLevers(profile: CustomerProfile): Lever[] {
  const candidates: Array<Omit<Lever, 'delta'> & { applies: boolean }> = [
    { title: '1-year contract offer', adjustments: { contract: 'One year' }, cost: 'e.g. $10/mo credit for 6 months', applies: profile.contract === 'Month-to-month' },
    { title: '2-year contract offer', adjustments: { contract: 'Two year' }, cost: 'e.g. $15/mo credit for 6 months', applies: profile.contract !== 'Two year' },
    { title: 'Include tech support', adjustments: { addTechSupport: true }, cost: 'e.g. cost of providing the service', applies: !profile.techSupport && profile.internetService !== 'No' },
    { title: 'Include online security', adjustments: { addOnlineSecurity: true }, cost: 'e.g. cost of providing the service', applies: !profile.onlineSecurity && profile.internetService !== 'No' },
    { title: 'Move to automatic payment', adjustments: { switchPaymentMethod: 'Credit card (automatic)' }, cost: 'e.g. one-time $20 credit', applies: profile.paymentMethod === 'Electronic check' || profile.paymentMethod === 'Mailed check' },
  ];
  return candidates
    .filter((c) => c.applies)
    .map(({ applies, ...c }) => ({ ...c, delta: simulateWhatIf(profile, c.adjustments).probabilityDelta }))
    .filter((l) => l.delta < 0)
    .sort((a, b) => a.delta - b.delta);
}

/**
 * Retention plan built without an LLM. The impact figures are the model's own
 * what-if results for this customer, never invented; costs are labelled examples.
 */
export function buildFallbackStrategy(profile: CustomerProfile, prediction: PredictionResult): RetentionStrategyResponse {
  const levers = standardLevers(profile).slice(0, 3);
  const first = profile.name.split(' ')[0];
  const topDriver = prediction.topRiskDrivers[0]?.featureName;
  const call = prediction.churnProbability >= 50;
  return {
    customerName: profile.name,
    riskSummary:
      `${profile.name} has a predicted ${prediction.churnProbability}% chance of leaving` +
      (topDriver ? `, driven mainly by: ${topDriver}.` : '.'),
    recommendedIncentives: levers.length
      ? levers.map((l) => ({
          title: l.title,
          impactEstimate: `${l.delta.toFixed(1)} points predicted churn (model what-if)`,
          costToBusiness: l.cost,
          roiVerdict: `Expected annual billing retained: $${Math.round(prediction.annualRevenueAtRisk * (-l.delta / 100))} (association, not a guarantee).`,
        }))
      : [{
          title: 'No model-backed lever found',
          impactEstimate: 'The model predicts none of the standard offers would lower this risk',
          costToBusiness: 'n/a',
          roiVerdict: 'Consider a personal check-in instead.',
        }],
    actionScript: {
      channel: call ? 'Phone Call' : 'Email',
      subjectOrOpener: call
        ? `Hi ${first}, this is your account specialist checking in on how your service is going.`
        : `A note on your plan, ${first}`,
      messageBody:
        `Dear ${profile.name},\n\nThank you for being with us for ${profile.tenure} months. ` +
        `We would like to make sure your ${profile.contract.toLowerCase()} ${profile.internetService === 'No' ? 'phone' : profile.internetService} plan is still the right fit, ` +
        `and we have a few options that could help. Would you like us to walk through them?`,
    },
    timingRecommendation: 'Reach out before the next billing cycle.',
    aiGenerated: false,
  };
}

/**
 * Synthetic example customers for instant testing. Names and IDs are made up;
 * every risk figure shown for them is computed by the model, not written here.
 */
const PRESET_DEFS: Array<{ id: string; label: string; profile: CustomerProfile }> = [
  {
    id: 'preset_high_risk',
    label: 'At-Risk New Fiber User',
    profile: {
      id: 'CUST-8921',
      name: 'Elena Rostova',
      tenure: 3,
      monthlyCharges: 96.50,
      totalCharges: 289.50,
      contract: 'Month-to-month',
      internetService: 'Fiber optic',
      onlineSecurity: false,
      onlineBackup: false,
      deviceProtection: false,
      techSupport: false,
      streamingTV: true,
      streamingMovies: true,
      paperlessBilling: true,
      paymentMethod: 'Electronic check',
      seniorCitizen: false,
      partner: false,
      dependents: false,
      phoneService: true,
      multipleLines: false,
    },
  },
  {
    id: 'preset_mod_risk',
    label: 'Mid-Tenure DSL Streamer',
    profile: {
      id: 'CUST-4109',
      name: 'Marcus Chen',
      tenure: 16,
      monthlyCharges: 68.00,
      totalCharges: 1088.00,
      contract: 'Month-to-month',
      internetService: 'DSL',
      onlineSecurity: false,
      onlineBackup: true,
      deviceProtection: true,
      techSupport: false,
      streamingTV: true,
      streamingMovies: false,
      paperlessBilling: true,
      paymentMethod: 'Credit card (automatic)',
      seniorCitizen: false,
      partner: true,
      dependents: false,
      phoneService: true,
      multipleLines: true,
    },
  },
  {
    id: 'preset_loyal_family',
    label: 'Long-term Family Plan',
    profile: {
      id: 'CUST-1044',
      name: 'Sarah & David Miller',
      tenure: 62,
      monthlyCharges: 104.50,
      totalCharges: 6479.00,
      contract: 'Two year',
      internetService: 'Fiber optic',
      onlineSecurity: true,
      onlineBackup: true,
      deviceProtection: true,
      techSupport: true,
      streamingTV: true,
      streamingMovies: true,
      paperlessBilling: false,
      paymentMethod: 'Bank transfer (automatic)',
      seniorCitizen: false,
      partner: true,
      dependents: true,
      phoneService: true,
      multipleLines: true,
    },
  },
  {
    id: 'preset_senior_saver',
    label: 'Senior Budget Landline',
    profile: {
      id: 'CUST-3382',
      name: 'Arthur Pendelton',
      tenure: 48,
      monthlyCharges: 24.80,
      totalCharges: 1190.40,
      contract: 'One year',
      internetService: 'No',
      onlineSecurity: false,
      onlineBackup: false,
      deviceProtection: false,
      techSupport: false,
      streamingTV: false,
      streamingMovies: false,
      paperlessBilling: false,
      paymentMethod: 'Mailed check',
      seniorCitizen: true,
      partner: false,
      dependents: false,
      phoneService: true,
      multipleLines: false,
    },
  },
];

/**
 * Pre-loaded example cohort for the portfolio view (synthetic customers).
 */
export const SAMPLE_PORTFOLIO: CustomerProfile[] = [
  ...PRESET_DEFS.map((p) => p.profile),
  {
    id: 'CUST-5512',
    name: 'Samantha Vance',
    tenure: 1,
    monthlyCharges: 89.20,
    contract: 'Month-to-month',
    internetService: 'Fiber optic',
    onlineSecurity: false,
    onlineBackup: false,
    deviceProtection: false,
    techSupport: false,
    streamingTV: false,
    streamingMovies: false,
    paperlessBilling: true,
    paymentMethod: 'Electronic check',
    seniorCitizen: false,
    partner: false,
    dependents: false,
    phoneService: true,
    multipleLines: false,
  },
  {
    id: 'CUST-7741',
    name: 'Robert Garcia',
    tenure: 29,
    monthlyCharges: 54.10,
    contract: 'One year',
    internetService: 'DSL',
    onlineSecurity: true,
    onlineBackup: true,
    deviceProtection: false,
    techSupport: true,
    streamingTV: false,
    streamingMovies: false,
    paperlessBilling: true,
    paymentMethod: 'Bank transfer (automatic)',
    seniorCitizen: false,
    partner: true,
    dependents: true,
    phoneService: true,
    multipleLines: false,
  },
  {
    id: 'CUST-9014',
    name: 'Devon Washington',
    tenure: 8,
    monthlyCharges: 112.40,
    contract: 'Month-to-month',
    internetService: 'Fiber optic',
    onlineSecurity: false,
    onlineBackup: false,
    deviceProtection: true,
    techSupport: false,
    streamingTV: true,
    streamingMovies: true,
    paperlessBilling: true,
    paymentMethod: 'Electronic check',
    seniorCitizen: true,
    partner: false,
    dependents: false,
    phoneService: true,
    multipleLines: true,
  },
  {
    id: 'CUST-2239',
    name: 'Chloe Tremblay',
    tenure: 38,
    monthlyCharges: 74.50,
    contract: 'Two year',
    internetService: 'DSL',
    onlineSecurity: true,
    onlineBackup: false,
    deviceProtection: true,
    techSupport: true,
    streamingTV: true,
    streamingMovies: false,
    paperlessBilling: false,
    paymentMethod: 'Credit card (automatic)',
    seniorCitizen: false,
    partner: true,
    dependents: false,
    phoneService: true,
    multipleLines: false,
  },
  {
    id: 'CUST-6110',
    name: 'Liam Gallagher',
    tenure: 4,
    monthlyCharges: 79.90,
    contract: 'Month-to-month',
    internetService: 'Fiber optic',
    onlineSecurity: false,
    onlineBackup: false,
    deviceProtection: false,
    techSupport: false,
    streamingTV: false,
    streamingMovies: true,
    paperlessBilling: true,
    paymentMethod: 'Electronic check',
    seniorCitizen: false,
    partner: false,
    dependents: false,
    phoneService: true,
    multipleLines: false,
  },
  {
    id: 'CUST-4903',
    name: 'Priya Patel',
    tenure: 54,
    monthlyCharges: 91.00,
    contract: 'Two year',
    internetService: 'Fiber optic',
    onlineSecurity: true,
    onlineBackup: true,
    deviceProtection: true,
    techSupport: true,
    streamingTV: false,
    streamingMovies: true,
    paperlessBilling: true,
    paymentMethod: 'Credit card (automatic)',
    seniorCitizen: false,
    partner: true,
    dependents: true,
    phoneService: true,
    multipleLines: true,
  },
];

export const CUSTOMER_PRESETS = PRESET_DEFS.map((p) => {
  const pct = Math.round(churnProbability(p.profile) * 100);
  const band = pct >= RISK_BANDS.highFrom ? 'High' : pct >= RISK_BANDS.moderateFrom ? 'Moderate' : 'Low';
  return { ...p, badge: `${band} risk (${pct}%)` };
});

/** Metrics measured on the held-out test set, at the given decision threshold. */
export function metricsAt(threshold: number) {
  const row = M.byThreshold.reduce((best, r) =>
    Math.abs(r.threshold - threshold) < Math.abs(best.threshold - threshold) ? r : best);
  return { ...row, total: row.tn + row.fp + row.fn + row.tp };
}

/** Everything the diagnostics page shows about the model, all from `model.json`. */
export const MODEL_METRICS = {
  algorithm: M.algorithm,
  dataset: `${M.trainedOn} (${(M.nTrain + M.nTest).toLocaleString()} customers)`,
  split: `${M.nTrain.toLocaleString()} train / ${M.nTest.toLocaleString()} held-out test`,
  trainedDate: M.trainedDate,
  baseRate: M.baseRate,
  bestF1Threshold: M.bestF1Threshold,
  thresholds: M.byThreshold.map((r) => r.threshold),
  rocAuc: M.metrics.rocAuc,
  rocAucCi95: M.metrics.rocAucCi95,
  prAuc: M.metrics.prAuc,
  brier: M.metrics.brier,
  brierNoSkill: M.metrics.brierNoSkill,
  testChurnRate: M.metrics.testChurnRate,
  globalFeatureImportance: M.globalImportance,
};
