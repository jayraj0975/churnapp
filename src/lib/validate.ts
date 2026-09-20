import type { CustomerProfile, WhatIfAdjustments } from '../types';

const CONTRACTS = ['Month-to-month', 'One year', 'Two year'];
const INTERNET = ['DSL', 'Fiber optic', 'No'];
const PAYMENT = ['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)'];
const BOOLS = [
  'onlineSecurity', 'onlineBackup', 'deviceProtection', 'techSupport', 'streamingTV',
  'streamingMovies', 'paperlessBilling', 'seniorCitizen', 'partner', 'dependents',
  'phoneService', 'multipleLines',
] as const;

const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Returns an error message, or null when the value is a usable CustomerProfile. */
export function validateProfile(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'A customer profile object is required';
  const o = p as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length > 64) return 'id must be a string of at most 64 characters';
  if (typeof o.name !== 'string' || o.name.length > 80) return 'name must be a string of at most 80 characters';
  if (!isNum(o.tenure, 0, 120)) return 'tenure must be a number of months between 0 and 120';
  if (!isNum(o.monthlyCharges, 0, 1000)) return 'monthlyCharges must be a number between 0 and 1000';
  if (!CONTRACTS.includes(o.contract as string)) return `contract must be one of: ${CONTRACTS.join(', ')}`;
  if (!INTERNET.includes(o.internetService as string)) return `internetService must be one of: ${INTERNET.join(', ')}`;
  if (!PAYMENT.includes(o.paymentMethod as string)) return `paymentMethod must be one of: ${PAYMENT.join(', ')}`;
  for (const k of BOOLS) if (typeof o[k] !== 'boolean') return `${k} must be true or false`;
  return null;
}

export function validateAdjustments(a: unknown): string | null {
  if (!a || typeof a !== 'object') return 'adjustments object is required';
  const o = a as Record<string, unknown>;
  if (o.contract !== undefined && !CONTRACTS.includes(o.contract as string)) return 'invalid contract';
  if (o.switchPaymentMethod !== undefined && !PAYMENT.includes(o.switchPaymentMethod as string)) return 'invalid switchPaymentMethod';
  if (o.tenureBonus !== undefined && !isNum(o.tenureBonus, 0, 120)) return 'tenureBonus must be between 0 and 120';
  if (o.monthlyDiscount !== undefined && !isNum(o.monthlyDiscount, 0, 1000)) return 'monthlyDiscount must be between 0 and 1000';
  for (const k of ['addTechSupport', 'addOnlineSecurity'] as const)
    if (o[k] !== undefined && typeof o[k] !== 'boolean') return `${k} must be true or false`;
  return null;
}

export type { CustomerProfile, WhatIfAdjustments };
