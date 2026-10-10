import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAMPLE_PORTFOLIO, simulateWhatIf, standardLevers } from '../src/lib/churnEngine.ts';
import { bestOffer, DEFAULT_OFFER_COSTS, planRetention, worthwhileOffers } from '../src/lib/retentionPlan.ts';

const everyone = SAMPLE_PORTFOLIO;

test('no budget, no plan; nothing is ever spent beyond the budget', () => {
  assert.deepEqual(planRetention(everyone, 0).chosen, []);
  assert.equal(planRetention(everyone, -50).spend, 0);
  assert.equal(planRetention(everyone, Number.NaN).spend, 0);
  for (const budget of [25, 100, 250, 1000]) {
    const p = planRetention(everyone, budget);
    assert.ok(p.spend <= budget, `spent ${p.spend} of ${budget}`);
    assert.equal(p.spend, p.chosen.reduce((s, o) => s + o.cost, 0));
  }
});

test('with an unlimited budget every worthwhile offer is chosen, one per customer', () => {
  const p = planRetention(everyone, 1e9);
  assert.equal(p.overBudget.length, 0);
  assert.equal(p.chosen.length + p.noWorthwhileOffer, everyone.length);
  assert.equal(new Set(p.chosen.map((o) => o.customer.id)).size, p.chosen.length);
  assert.ok(p.chosen.length > 0, 'the sample portfolio should have at least one worthwhile offer');
});

test('every chosen offer is worth more than it costs, and its value is the model\'s own what-if', () => {
  for (const o of planRetention(everyone, 1e9).chosen) {
    assert.ok(o.value > o.cost);
    assert.ok(o.riskAfter < o.riskBefore);
    const lever = standardLevers(o.customer).find((l) => l.title === o.offer)!;
    assert.equal(o.value, simulateWhatIf(o.customer, lever.adjustments).modeledExposureReduction);
    assert.equal(o.cost, DEFAULT_OFFER_COSTS[o.offer]);
  }
});

test('with money to spare, each customer ends on the offer worth most after its cost', () => {
  for (const o of planRetention(everyone, 1e9).chosen) {
    const best = bestOffer(o.customer, DEFAULT_OFFER_COSTS)!;
    assert.equal(o.value - o.cost, best.value - best.cost, o.customer.name);
  }
});

test('a tight budget still funds the cheaper offers that fit, best value per dollar first', () => {
  const all = everyone.flatMap((c) => worthwhileOffers(c, DEFAULT_OFFER_COSTS));
  const cheapest = Math.min(...all.map((o) => o.cost));
  const one = planRetention(everyone, cheapest);
  assert.equal(one.chosen.length, 1);
  const bestRatio = Math.max(...all.filter((o) => o.cost <= cheapest).map((o) => o.value / o.cost));
  assert.equal(one.chosen[0].value / one.chosen[0].cost, bestRatio);
  // A budget below the most popular offer's price must not leave the money unspent when cheaper offers fit.
  const p = planRetention(everyone, 80);
  assert.ok(p.chosen.length >= 1 && p.spend <= 80, JSON.stringify({ n: p.chosen.length, spend: p.spend }));
  assert.ok(p.returnPerDollar !== null && p.returnPerDollar > 1);
  // Spending more never protects less.
  let last = 0;
  for (const b of [0, 20, 60, 80, 150, 300, 600, 1e9]) {
    const v = planRetention(everyone, b).value;
    assert.ok(v >= last, `budget ${b}: ${v} < ${last}`);
    last = v;
  }
});

test('costs are assumptions: an offer that costs more than it is worth is never proposed', () => {
  const pricey = Object.fromEntries(Object.keys(DEFAULT_OFFER_COSTS).map((k) => [k, 1e6]));
  const p = planRetention(everyone, 1e9, pricey);
  assert.equal(p.chosen.length, 0);
  assert.equal(p.noWorthwhileOffer, everyone.length);
  assert.equal(p.returnPerDollar, null);
  // An unknown or negative cost means "not offered", never "free".
  assert.equal(bestOffer(everyone[0], { 'Include tech support': -5 }), null);
});

test('the plan is deterministic', () => {
  assert.deepEqual(planRetention(everyone, 300), planRetention(everyone, 300));
});
