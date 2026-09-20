import assert from 'node:assert/strict';
import { test } from 'node:test';
import model from '../src/lib/model.json' with { type: 'json' };
import {
  CUSTOMER_PRESETS,
  MODEL_METRICS,
  SAMPLE_PORTFOLIO,
  calculateChurnPrediction,
  churnProbability,
  metricsAt,
  simulateWhatIf,
  standardLevers,
} from '../src/lib/churnEngine.ts';
import { validateAdjustments, validateProfile } from '../src/lib/validate.ts';
import type { CustomerProfile } from '../src/types.ts';

const base = CUSTOMER_PRESETS[0].profile;

test('engine reproduces scikit-learn predictions to 1e-9 on real customers', () => {
  assert.ok(model.golden.length >= 8);
  for (const g of model.golden) {
    const ours = churnProbability(g.profile as CustomerProfile);
    assert.ok(Math.abs(ours - g.probability) < 1e-9, `${g.profile.id}: ${ours} vs ${g.probability}`);
  }
});

test('probabilities are valid and monotone in the directions the data shows', () => {
  const p = (over: Partial<CustomerProfile>) => churnProbability({ ...base, ...over });
  for (const c of SAMPLE_PORTFOLIO) {
    const v = churnProbability(c);
    assert.ok(v > 0 && v < 1);
  }
  assert.ok(p({ contract: 'Two year' }) < p({ contract: 'One year' }));
  assert.ok(p({ contract: 'One year' }) < p({ contract: 'Month-to-month' }));
  assert.ok(p({ tenure: 60 }) < p({ tenure: 2 }));
  assert.ok(p({ paymentMethod: 'Credit card (automatic)' }) < p({ paymentMethod: 'Electronic check' }));
});

test('risk bands and threshold follow the probability', () => {
  const r = calculateChurnPrediction(base, 0.35);
  const expected = r.churnProbability >= 50 ? 'High' : r.churnProbability >= 20 ? 'Moderate' : 'Low';
  assert.equal(r.riskLevel, expected);
  assert.equal(r.willChurn, churnProbability(base) >= 0.35);
  assert.equal(r.annualRevenueAtRisk, Math.round(base.monthlyCharges * 12));
  assert.equal(r.expectedAnnualLoss, Math.round(r.annualRevenueAtRisk * churnProbability(base)));
});

test('factor contributions have consistent signs and no invented numbers', () => {
  const r = calculateChurnPrediction(base);
  assert.ok(r.topRiskDrivers.length > 0);
  for (const f of r.topRiskDrivers) assert.ok(f.impactPercentage > 0 && f.direction === 'increases_risk');
  for (const f of r.topProtectiveFactors) assert.ok(f.impactPercentage < 0 && f.direction === 'reduces_risk');
});

test('what-if delta matches re-scoring, and never reports negative savings', () => {
  const sim = simulateWhatIf(base, { contract: 'Two year' });
  const direct = calculateChurnPrediction({ ...base, contract: 'Two year' });
  assert.equal(sim.simulatedResult.churnProbability, direct.churnProbability);
  assert.ok(sim.probabilityDelta < 0 && sim.annualRevenueSaved > 0);
  const worse = simulateWhatIf(CUSTOMER_PRESETS[2].profile, { contract: 'Month-to-month' });
  assert.ok(worse.annualRevenueSaved >= 0);
});

test('standard levers only include ones the model says help, best first', () => {
  const levers = standardLevers(base);
  assert.ok(levers.length > 0);
  for (const l of levers) assert.ok(l.delta < 0);
  assert.deepEqual(levers.map((l) => l.delta), [...levers.map((l) => l.delta)].sort((a, b) => a - b));
});

test('diagnostics come from measured data: confusion matrix adds up, recall falls as threshold rises', () => {
  const rows = MODEL_METRICS.thresholds.map(metricsAt);
  for (const r of rows) assert.equal(r.total, model.nTest);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].recall <= rows[i - 1].recall);
  assert.ok(MODEL_METRICS.rocAuc > 0.8 && MODEL_METRICS.rocAuc < 0.87, 'AUC should be the measured ~0.83');
  assert.ok(MODEL_METRICS.rocAucCi95[0] < MODEL_METRICS.rocAuc && MODEL_METRICS.rocAuc < MODEL_METRICS.rocAucCi95[1]);
});

test('preset badges are computed from the model', () => {
  for (const p of CUSTOMER_PRESETS) {
    const pct = Math.round(churnProbability(p.profile) * 100);
    assert.ok(p.badge.includes(`${pct}%`));
  }
});

test('validation accepts a real profile and rejects malformed input', () => {
  assert.equal(validateProfile(base), null);
  assert.ok(validateProfile(null));
  assert.ok(validateProfile({ ...base, tenure: -1 }));
  assert.ok(validateProfile({ ...base, tenure: 'ten' }));
  assert.ok(validateProfile({ ...base, contract: 'Forever' }));
  assert.ok(validateProfile({ ...base, techSupport: 'yes' }));
  assert.equal(validateAdjustments({ contract: 'One year', addTechSupport: true }), null);
  assert.ok(validateAdjustments({ monthlyDiscount: -5 }));
  assert.ok(validateAdjustments(undefined));
});

test('probabilities are calibrated on the held-out set (predicted ~ observed in every fifth)', () => {
  for (const bin of model.calibration) {
    assert.ok(Math.abs(bin.predicted - bin.observed) < 0.07, `${bin.predicted} vs ${bin.observed}`);
  }
});
