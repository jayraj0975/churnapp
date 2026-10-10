import type { CustomerProfile } from '../types';
import { calculateChurnPrediction, simulateWhatIf, standardLevers } from './churnEngine';

/**
 * Which customers to contact, with which offer, when there is only so much budget.
 *
 * For every customer, each standard lever is scored by the model's own what-if: the predicted fall in their
 * expected annual billing that walks away. That is an association learned from past customers, not money the
 * business is guaranteed to keep. Offer costs are the user's assumptions, never inferred. Each customer gets at
 * most one offer (the one with the largest predicted value net of its cost), and offers are chosen by value per
 * dollar until the budget runs out.
 */

/** Example cost of each offer for one customer, in dollars. Editable assumptions, shown as such. */
export const DEFAULT_OFFER_COSTS: Record<string, number> = {
  '1-year contract offer': 60,
  '2-year contract offer': 90,
  'Include tech support': 72,
  'Include online security': 60,
  'Move to automatic payment': 20,
};

export interface PlannedOffer {
  customer: CustomerProfile;
  offer: string;
  cost: number;
  /** Predicted fall in expected annual billing lost, in dollars (model association, not a guarantee). */
  value: number;
  riskBefore: number;
  riskAfter: number;
}

export interface RetentionPlan {
  chosen: PlannedOffer[];
  /** Customers with a worthwhile offer (value above cost) who did not fit in the budget: their best offer, best first. */
  overBudget: PlannedOffer[];
  /** Customers with no offer whose predicted value exceeds its cost. */
  noWorthwhileOffer: number;
  spend: number;
  value: number;
  /** Predicted value per dollar spent; null when nothing is spent. */
  returnPerDollar: number | null;
}

/** Every offer for this customer that is predicted to be worth more than it costs. Unknown or negative costs are "not offered". */
export function worthwhileOffers(customer: CustomerProfile, costs: Record<string, number>): PlannedOffer[] {
  const riskBefore = calculateChurnPrediction(customer).churnProbability;
  const out: PlannedOffer[] = [];
  for (const lever of standardLevers(customer)) {
    const cost = costs[lever.title];
    if (cost === undefined || !Number.isFinite(cost) || cost < 0) continue;
    const sim = simulateWhatIf(customer, lever.adjustments);
    if (sim.modeledExposureReduction > cost) {
      out.push({ customer, offer: lever.title, cost, value: sim.modeledExposureReduction, riskBefore, riskAfter: sim.simulatedResult.churnProbability });
    }
  }
  return out;
}

/** The offer worth most after its cost: what an unlimited budget would give this customer. */
export function bestOffer(customer: CustomerProfile, costs: Record<string, number>): PlannedOffer | null {
  return worthwhileOffers(customer, costs).reduce<PlannedOffer | null>((b, o) => (!b || o.value - o.cost > b.value - b.cost ? o : b), null);
}

interface Step { customer: number; to: PlannedOffer; dCost: number; dValue: number }

/**
 * A customer's offers as upgrade steps: start from no offer, and each step moves to a pricier offer only while the
 * extra predicted value per extra dollar stays above 1 (so every step adds net value) and falls from step to step
 * (the upper concave hull of value against cost). Offers off the hull are never the best use of that money.
 */
function upgradeSteps(i: number, offers: PlannedOffer[]): Step[] {
  const sorted = [...offers].sort((a, b) => a.cost - b.cost || b.value - a.value);
  const hull: PlannedOffer[] = [];
  const at = (k: number) => (k < 0 ? { cost: 0, value: 0 } : hull[k]);
  for (const o of sorted) {
    if (o.value <= at(hull.length - 1).value) continue; // costs at least as much and is worth no more
    // Drop the last hull point while it lies on or below the line from the one before it to this offer.
    while (hull.length) {
      const a = at(hull.length - 2), b = at(hull.length - 1);
      if ((b.value - a.value) * (o.cost - a.cost) <= (o.value - a.value) * (b.cost - a.cost)) hull.pop();
      else break;
    }
    hull.push(o);
  }
  const steps: Step[] = [];
  for (let k = 0; k < hull.length; k++) {
    const prev = at(k - 1);
    const step = { customer: i, to: hull[k], dCost: hull[k].cost - prev.cost, dValue: hull[k].value - prev.value };
    if (k > 0 && step.dValue <= step.dCost) break; // ratios only fall along the hull: no later upgrade pays either
    steps.push(step);
  }
  return steps;
}

const rate = (s: Step) => (s.dCost === 0 ? Number.POSITIVE_INFINITY : s.dValue / s.dCost);

export function planRetention(customers: CustomerProfile[], budget: number, costs: Record<string, number> = DEFAULT_OFFER_COSTS): RetentionPlan {
  const cap = Number.isFinite(budget) ? Math.max(0, budget) : 0;
  const options = customers.map((c) => worthwhileOffers(c, costs));
  // ponytail: the classic greedy for a multiple-choice knapsack (take upgrade steps by value per dollar); near-optimal
  // when each offer is small next to the budget. Use an exact dynamic programme if budgets cover only a few offers.
  const steps = options.flatMap((o, i) => upgradeSteps(i, o))
    .sort((a, b) => rate(b) - rate(a) || b.dValue - a.dValue || customers[a.customer].name.localeCompare(customers[b.customer].name));
  const current = new Map<number, PlannedOffer>();
  const blocked = new Set<number>();
  let spend = 0;
  for (const s of steps) {
    if (blocked.has(s.customer)) continue;
    const prev = current.get(s.customer);
    // Steps of one customer arrive in hull order; a step only applies on top of the one before it.
    if (prev ? s.dCost !== s.to.cost - prev.cost : s.dCost !== s.to.cost) { blocked.add(s.customer); continue; }
    if (spend + s.dCost <= cap) {
      current.set(s.customer, s.to);
      spend += s.dCost;
    } else blocked.add(s.customer);
  }
  const chosen = customers.flatMap((_, i) => (current.has(i) ? [current.get(i)!] : []))
    .sort((a, b) => b.value / Math.max(b.cost, 1e-9) - a.value / Math.max(a.cost, 1e-9) || a.customer.name.localeCompare(b.customer.name));
  const overBudget = options.flatMap((o, i) => (current.has(i) || !o.length ? [] : [bestOffer(customers[i], costs)!]))
    .sort((a, b) => b.value - b.cost - (a.value - a.cost));
  const value = chosen.reduce((sum, o) => sum + o.value, 0);
  return { chosen, overBudget, noWorthwhileOffer: options.filter((o) => !o.length).length, spend, value, returnPerDollar: spend > 0 ? value / spend : null };
}
