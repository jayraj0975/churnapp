export type ContractType = 'Month-to-month' | 'One year' | 'Two year';
export type InternetServiceType = 'DSL' | 'Fiber optic' | 'No';
export type PaymentMethodType = 
  | 'Electronic check'
  | 'Mailed check'
  | 'Bank transfer (automatic)'
  | 'Credit card (automatic)';

export interface CustomerProfile {
  id: string;
  name: string;
  tenure: number; // months (0 - 72)
  monthlyCharges: number; // $ (18 - 130)
  totalCharges?: number; // $ (derived or manual)
  contract: ContractType;
  internetService: InternetServiceType;
  onlineSecurity: boolean;
  onlineBackup: boolean;
  deviceProtection: boolean;
  techSupport: boolean;
  streamingTV: boolean;
  streamingMovies: boolean;
  paperlessBilling: boolean;
  paymentMethod: PaymentMethodType;
  seniorCitizen: boolean;
  partner: boolean;
  dependents: boolean;
  phoneService: boolean;
  multipleLines: boolean;
}

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export interface RiskFactorContribution {
  featureName: string;
  category: 'Contract' | 'Services' | 'Billing' | 'Tenure' | 'Demographics';
  impactPercentage: number; // e.g. +24% or -18%
  direction: 'increases_risk' | 'reduces_risk';
  description: string;
}

export interface PredictionResult {
  churnProbability: number; // 0 to 100 (percentage)
  riskLevel: RiskLevel;
  willChurn: boolean; // based on threshold (default 0.50)
  threshold: number;
  logit: number;
  estimatedClv: number; // Customer Lifetime Value $
  monthlyRevenueAtRisk: number;
  annualRevenueAtRisk: number;
  topRiskDrivers: RiskFactorContribution[];
  topProtectiveFactors: RiskFactorContribution[];
  retentionRecommendation: string;
}

export interface WhatIfAdjustments {
  contract?: ContractType;
  tenureBonus?: number;
  monthlyDiscount?: number;
  addTechSupport?: boolean;
  addOnlineSecurity?: boolean;
  switchPaymentMethod?: PaymentMethodType;
}

export interface RetentionStrategyResponse {
  customerName: string;
  riskSummary: string;
  recommendedIncentives: Array<{
    title: string;
    impactEstimate: string;
    costToBusiness: string;
    roiVerdict: string;
  }>;
  actionScript: {
    channel: 'Email' | 'Phone Call' | 'In-App Offer';
    subjectOrOpener: string;
    messageBody: string;
  };
  timingRecommendation: string;
  aiGenerated?: boolean;
}
