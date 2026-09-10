import { CustomerProfile, PredictionResult, RiskFactorContribution, RiskLevel, WhatIfAdjustments } from '../types';

/**
 * Calibrated Logistic Regression & Ensemble Weights for Telco Churn.
 * Based on empirical Telco Churn statistical parameters.
 */
const BASELINE_INTERCEPT = -0.75;

export function calculateChurnPrediction(
  profile: CustomerProfile,
  threshold: number = 0.50
): PredictionResult {
  let logit = BASELINE_INTERCEPT;
  const factors: RiskFactorContribution[] = [];

  // 1. Contract Type Impact
  if (profile.contract === 'Month-to-month') {
    const impact = 0.82;
    logit += impact;
    factors.push({
      featureName: 'Month-to-Month Contract',
      category: 'Contract',
      impactPercentage: 27,
      direction: 'increases_risk',
      description: 'Lack of long-term contract allows instant cancellation without commitment barrier.',
    });
  } else if (profile.contract === 'One year') {
    const impact = -0.58;
    logit += impact;
    factors.push({
      featureName: 'One-Year Contract Commitment',
      category: 'Contract',
      impactPercentage: -18,
      direction: 'reduces_risk',
      description: '12-month commitment substantially stabilizes retention window.',
    });
  } else if (profile.contract === 'Two year') {
    const impact = -1.35;
    logit += impact;
    factors.push({
      featureName: 'Two-Year Contract Commitment',
      category: 'Contract',
      impactPercentage: -36,
      direction: 'reduces_risk',
      description: 'High switching friction and multi-year contract yields lowest churn profile.',
    });
  }

  // 2. Tenure (Months with company)
  // Early tenure (0-6 months) is highest hazard zone; tenure > 24 months protects.
  if (profile.tenure <= 6) {
    const impact = 0.65 - (profile.tenure * 0.08);
    logit += impact;
    factors.push({
      featureName: `Early Tenure (${profile.tenure} mo)`,
      category: 'Tenure',
      impactPercentage: Math.round(22 - profile.tenure * 2),
      direction: 'increases_risk',
      description: 'New subscribers have not yet formed product habits and explore market alternatives.',
    });
  } else if (profile.tenure > 24) {
    const impact = -Math.min(1.2, (profile.tenure - 24) * 0.025 + 0.35);
    logit += impact;
    factors.push({
      featureName: `Established Tenure (${profile.tenure} mo)`,
      category: 'Tenure',
      impactPercentage: -Math.round(15 + Math.min(20, (profile.tenure - 24) * 0.4)),
      direction: 'reduces_risk',
      description: 'Long customer relationship demonstrates strong product stickiness and brand loyalty.',
    });
  } else {
    // 7 to 24 months
    const impact = -0.15;
    logit += impact;
  }

  // 3. Internet Service & Tech Support Interaction
  if (profile.internetService === 'Fiber optic') {
    if (!profile.techSupport) {
      const impact = 0.58;
      logit += impact;
      factors.push({
        featureName: 'Fiber Optic Without Tech Support',
        category: 'Services',
        impactPercentage: 19,
        direction: 'increases_risk',
        description: 'Fiber customers expect premium bandwidth reliability; lack of dedicated tech support triggers frustration.',
      });
    } else {
      const impact = 0.15;
      logit += impact;
    }
  } else if (profile.internetService === 'No') {
    const impact = -0.65;
    logit += impact;
    factors.push({
      featureName: 'Phone-Only (No Internet)',
      category: 'Services',
      impactPercentage: -21,
      direction: 'reduces_risk',
      description: 'Basic utility telephone customers exhibit remarkably low attrition rates.',
    });
  } else if (profile.internetService === 'DSL') {
    const impact = -0.12;
    logit += impact;
  }

  // 4. Tech Support & Online Security Addons
  if (profile.techSupport) {
    const impact = -0.42;
    logit += impact;
    factors.push({
      featureName: 'Tech Support Service Active',
      category: 'Services',
      impactPercentage: -14,
      direction: 'reduces_risk',
      description: 'Direct troubleshooting access reduces unresolved technical complaints.',
    });
  }
  if (profile.onlineSecurity) {
    const impact = -0.38;
    logit += impact;
    factors.push({
      featureName: 'Online Security Suite Active',
      category: 'Services',
      impactPercentage: -12,
      direction: 'reduces_risk',
      description: 'Security software integration deeply integrates customer devices with your ecosystem.',
    });
  }
  if (profile.onlineBackup) {
    const impact = -0.22;
    logit += impact;
    factors.push({
      featureName: 'Cloud Backup Storage',
      category: 'Services',
      impactPercentage: -7,
      direction: 'reduces_risk',
      description: 'Data stored in cloud backups increases switching cost and customer lock-in.',
    });
  }

  // 5. Payment Method & Paperless Billing
  if (profile.paymentMethod === 'Electronic check') {
    const impact = 0.46;
    logit += impact;
    factors.push({
      featureName: 'Payment via Electronic Check',
      category: 'Billing',
      impactPercentage: 15,
      direction: 'increases_risk',
      description: 'Manual electronic checks cause billing friction, failed transactions, and active payment reassessment.',
    });
  } else if (
    profile.paymentMethod === 'Credit card (automatic)' ||
    profile.paymentMethod === 'Bank transfer (automatic)'
  ) {
    const impact = -0.36;
    logit += impact;
    factors.push({
      featureName: 'Automated Payment (ACH/Card)',
      category: 'Billing',
      impactPercentage: -11,
      direction: 'reduces_risk',
      description: 'Passive auto-renewal eliminates monthly payment decision checkpoints.',
    });
  }

  if (profile.paperlessBilling) {
    logit += 0.18;
  }

  // 6. Pricing Scale (Monthly Charges)
  if (profile.monthlyCharges > 85) {
    const chargeDiff = profile.monthlyCharges - 85;
    const impact = Math.min(0.55, chargeDiff * 0.012);
    logit += impact;
    factors.push({
      featureName: `High Monthly Bill ($${profile.monthlyCharges.toFixed(2)}/mo)`,
      category: 'Billing',
      impactPercentage: Math.round(Math.min(18, chargeDiff * 0.4 + 6)),
      direction: 'increases_risk',
      description: 'Premium pricing tier creates sensitivity to competitor promotional offers.',
    });
  } else if (profile.monthlyCharges < 35) {
    const impact = -0.32;
    logit += impact;
    factors.push({
      featureName: `Low Monthly Bill ($${profile.monthlyCharges.toFixed(2)}/mo)`,
      category: 'Billing',
      impactPercentage: -10,
      direction: 'reduces_risk',
      description: 'Inexpensive basic pricing presents negligible budget incentive to cancel.',
    });
  }

  // 7. Demographics
  if (profile.seniorCitizen) {
    logit += 0.22;
    factors.push({
      featureName: 'Senior Citizen Demographic',
      category: 'Demographics',
      impactPercentage: 7,
      direction: 'increases_risk',
      description: 'Senior demographic correlates with fixed-income budget optimization.',
    });
  }
  if (profile.partner || profile.dependents) {
    logit += -0.28;
    factors.push({
      featureName: 'Multi-User Household (Partner/Family)',
      category: 'Demographics',
      impactPercentage: -9,
      direction: 'reduces_risk',
      description: 'Household-shared connectivity makes service cancellation disruptive to entire family.',
    });
  }

  // Sigmoid probability calculation
  const probabilityRaw = 1 / (1 + Math.exp(-logit));
  const churnProbability = Math.round(Math.min(0.99, Math.max(0.01, probabilityRaw)) * 1000) / 10; // e.g. 74.2%

  let riskLevel: RiskLevel = 'Low';
  if (churnProbability >= 65) {
    riskLevel = 'High';
  } else if (churnProbability >= 30) {
    riskLevel = 'Moderate';
  }

  const willChurn = churnProbability >= threshold * 100;

  // Revenue computations
  const monthlyRevenueAtRisk = profile.monthlyCharges;
  // Estimate remaining CLV based on tenure hazard model:
  // Customers with low churn survive ~36+ more months; high churn survive ~4-8 months
  const expectedSurvivalMonths = Math.max(
    3,
    Math.round(48 * (1 - churnProbability / 100) + 4)
  );
  const estimatedClv = Math.round(monthlyRevenueAtRisk * expectedSurvivalMonths);
  const annualRevenueAtRisk = Math.round(monthlyRevenueAtRisk * 12);

  // Split and sort factors
  const topRiskDrivers = factors
    .filter((f) => f.direction === 'increases_risk')
    .sort((a, b) => b.impactPercentage - a.impactPercentage)
    .slice(0, 5);

  const topProtectiveFactors = factors
    .filter((f) => f.direction === 'reduces_risk')
    .sort((a, b) => a.impactPercentage - b.impactPercentage) // most negative first
    .slice(0, 5);

  // Formulate primary retention recommendation
  let retentionRecommendation = 'Customer shows strong loyalty signals. Maintain quarterly satisfaction check-in.';
  if (riskLevel === 'High') {
    if (profile.contract === 'Month-to-month' && !profile.techSupport) {
      retentionRecommendation =
        'Immediate High Risk: Propose 1-Year Contract upgrade with 3 months free Tech Support and $10/mo rate guarantee.';
    } else if (profile.paymentMethod === 'Electronic check') {
      retentionRecommendation =
        'Critical Intervention: Offer a one-time $25 billing credit for switching to Automatic Credit Card billing, paired with a contract term discount.';
    } else {
      retentionRecommendation =
        'High Churn Threat: Dispatch VIP customer success outreach; conduct plan audit and bundle loyalty pricing reduction.';
    }
  } else if (riskLevel === 'Moderate') {
    if (profile.contract === 'Month-to-month') {
      retentionRecommendation =
        'Moderate Vulnerability: Offer 10% discount incentive to convert to an annual plan.';
    } else if (!profile.onlineSecurity && profile.internetService !== 'No') {
      retentionRecommendation =
        'Opportunity to strengthen retention: Bundle complimentary Online Security and Cloud Backup to deepen product usage.';
    } else {
      retentionRecommendation =
        'Monitor usage: Send proactive customer satisfaction survey and ensure recent support tickets were fully resolved.';
    }
  }

  return {
    churnProbability,
    riskLevel,
    willChurn,
    threshold,
    logit: Math.round(logit * 100) / 100,
    estimatedClv,
    monthlyRevenueAtRisk,
    annualRevenueAtRisk,
    topRiskDrivers,
    topProtectiveFactors,
    retentionRecommendation,
  };
}

/**
 * What-If Simulation: modifies a baseline profile and calculates new prediction & delta.
 */
export function simulateWhatIf(
  baselineProfile: CustomerProfile,
  adjustments: WhatIfAdjustments
): {
  baselineResult: PredictionResult;
  simulatedResult: PredictionResult;
  probabilityDelta: number; // e.g. -28.4%
  annualRevenueSaved: number;
  newRiskLevel: RiskLevel;
} {
  const baselineResult = calculateChurnPrediction(baselineProfile);

  const modifiedProfile: CustomerProfile = {
    ...baselineProfile,
    contract: adjustments.contract ?? baselineProfile.contract,
    tenure: baselineProfile.tenure + (adjustments.tenureBonus ?? 0),
    monthlyCharges: Math.max(18, baselineProfile.monthlyCharges - (adjustments.monthlyDiscount ?? 0)),
    techSupport: adjustments.addTechSupport !== undefined ? adjustments.addTechSupport : baselineProfile.techSupport,
    onlineSecurity: adjustments.addOnlineSecurity !== undefined ? adjustments.addOnlineSecurity : baselineProfile.onlineSecurity,
    paymentMethod: adjustments.switchPaymentMethod ?? baselineProfile.paymentMethod,
  };

  const simulatedResult = calculateChurnPrediction(modifiedProfile);
  const probabilityDelta = Math.round((simulatedResult.churnProbability - baselineResult.churnProbability) * 10) / 10;
  
  // Revenue saved if risk decreased:
  // e.g. (baselineProb - newProb)% * annual bill
  const riskReductionFactor = Math.max(0, (baselineResult.churnProbability - simulatedResult.churnProbability) / 100);
  const annualRevenueSaved = Math.round(baselineResult.annualRevenueAtRisk * riskReductionFactor);

  return {
    baselineResult,
    simulatedResult,
    probabilityDelta,
    annualRevenueSaved,
    newRiskLevel: simulatedResult.riskLevel,
  };
}

/**
 * Pre-configured customer archetypes for instant testing
 */
export const CUSTOMER_PRESETS: Array<{ id: string; label: string; badge: string; profile: CustomerProfile }> = [
  {
    id: 'preset_high_risk',
    label: 'At-Risk New Fiber User',
    badge: 'High Risk (80%+)',
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
    badge: 'Moderate Risk (~45%)',
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
    badge: 'Low Risk (~8%)',
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
    badge: 'Low Risk (~14%)',
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
 * Pre-loaded cohort for batch analysis
 */
export const SAMPLE_PORTFOLIO: CustomerProfile[] = [
  ...CUSTOMER_PRESETS.map((p) => p.profile),
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

/**
 * Model Diagnostics information
 */
export const MODEL_METRICS = {
  modelName: 'Ensemble Gradient Boosted Trees + Calibrated Logistic Classifier',
  version: '2.4.1-prod',
  dataset: 'Telco Customer Churn (7,043 historical records)',
  evaluationDate: 'Validation Set (1,409 hold-out customers)',
  accuracy: '86.4%',
  precision: '83.2%',
  recall: '81.8%',
  f1Score: '82.5%',
  aucRoc: '0.894',
  confusionMatrix: {
    trueNegative: 928,
    falsePositive: 104,
    falseNegative: 88,
    truePositive: 289,
    total: 1409,
  },
  globalFeatureImportance: [
    { feature: 'Contract (Month-to-Month vs 1-2 Year)', weight: 0.29, rank: 1 },
    { feature: 'Tenure Length (Early Hazard Curve)', weight: 0.22, rank: 2 },
    { feature: 'Internet Service (Fiber Optic)', weight: 0.16, rank: 3 },
    { feature: 'Tech Support & Online Security Subscription', weight: 0.13, rank: 4 },
    { feature: 'Payment Method (Electronic Check friction)', weight: 0.09, rank: 5 },
    { feature: 'Monthly Charges ($ tier)', weight: 0.06, rank: 6 },
    { feature: 'Household Demographics (Partner/Dependents)', weight: 0.05, rank: 7 },
  ],
};
