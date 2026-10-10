import React, { useMemo, useState } from 'react';
import { CustomerProfile } from '../types';
import { DEFAULT_OFFER_COSTS, planRetention, type PlannedOffer } from '../lib/retentionPlan';
import { csvSafe } from '../lib/csv';
import { Wallet, Download, Info } from 'lucide-react';

interface Props {
  portfolio: CustomerProfile[];
  onSelectCustomer: (customer: CustomerProfile) => void;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Spend a fixed retention budget where the model predicts it protects the most revenue per dollar. */
export const RetentionPlanner: React.FC<Props> = ({ portfolio, onSelectCustomer }) => {
  const [budget, setBudget] = useState(500);
  const [costs, setCosts] = useState<Record<string, number>>(DEFAULT_OFFER_COSTS);
  const [showOver, setShowOver] = useState(false);
  const plan = useMemo(() => planRetention(portfolio, budget, costs), [portfolio, budget, costs]);

  const download = () => {
    const rows = [['Customer', 'Offer', 'Offer cost ($)', 'Risk before (%)', 'Risk after (%)', 'Predicted annual billing protected ($)'],
      ...plan.chosen.map((o) => [`"${csvSafe(o.customer.name)}"`, `"${o.offer}"`, o.cost, o.riskBefore, o.riskAfter, Math.round(o.value)])];
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((r) => r.join(',')).join('\n'));
    link.download = `retention_plan_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const row = (o: PlannedOffer) => (
    <tr key={o.customer.id} className="border-t border-slate-100">
      <td className="py-2.5 px-4"><button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={() => onSelectCustomer(o.customer)}>{o.customer.name}</button></td>
      <td className="py-2.5 px-3">{o.offer}</td>
      <td className="py-2.5 px-3 text-right tabular-nums">{o.riskBefore}% → {o.riskAfter}%</td>
      <td className="py-2.5 px-3 text-right tabular-nums">{usd(o.cost)}</td>
      <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{usd(o.value)}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex items-start gap-3">
          <Wallet className="w-5 h-5 text-indigo-600 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Retention budget planner</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">With a fixed budget, which customers should get which offer? For each of the {portfolio.length} customers in the portfolio, every applicable offer is scored by the model&apos;s what-if. The budget goes first to the offers with the most predicted value per dollar; a customer moves up to a pricier offer only while each extra dollar is predicted to bring back more than a dollar.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <label className="text-xs font-semibold text-slate-700">Budget ($)
            <input type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
          </label>
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">Cost of each offer per customer ($): your assumptions</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {Object.keys(DEFAULT_OFFER_COSTS).map((k) => (
                <label key={k} className="text-[11px] text-slate-500">{k}
                  <input type="number" min={0} step={5} value={costs[k]} aria-label={`Cost of ${k}`}
                    onChange={(e) => setCosts({ ...costs, [k]: Math.max(0, Number(e.target.value) || 0) })}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-xs tabular-nums" />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Plan summary">
          {[
            ['Customers to contact', `${plan.chosen.length}`],
            ['Spend', `${usd(plan.spend)} of ${usd(budget)}`],
            ['Predicted billing protected (a year)', usd(plan.value)],
            ['Per dollar spent', plan.returnPerDollar === null ? '–' : `$${plan.returnPerDollar.toFixed(2)} back`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"><dt className="text-[11px] text-slate-500">{k}</dt><dd className="text-lg font-bold text-slate-900 tabular-nums">{v}</dd></div>
          ))}
        </dl>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <h3 className="text-sm font-bold text-slate-900">The plan</h3>
          {plan.chosen.length > 0 && <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download className="w-3.5 h-3.5" /> Download CSV</button>}
        </div>
        {plan.chosen.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{budget === 0 ? 'Set a budget to see a plan.' : plan.overBudget.length ? 'The budget does not cover even the cheapest worthwhile offer. Raise it, or lower an offer cost.' : 'No offer is predicted to be worth more than it costs at these prices.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs mt-3">
              <thead className="text-slate-500"><tr><th className="py-2 px-4">Customer</th><th className="py-2 px-3">Offer</th><th className="py-2 px-3 text-right">Predicted risk</th><th className="py-2 px-3 text-right">Cost</th><th className="py-2 px-3 text-right">Billing protected</th></tr></thead>
              <tbody>{plan.chosen.map(row)}</tbody>
            </table>
          </div>
        )}
        {plan.overBudget.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <button type="button" className="text-xs font-semibold text-indigo-700" aria-expanded={showOver} onClick={() => setShowOver(!showOver)}>
              {showOver ? 'Hide' : 'Show'} {plan.overBudget.length} more worthwhile offer{plan.overBudget.length > 1 ? 's' : ''} beyond the budget
            </button>
            {showOver && <div className="overflow-x-auto"><table className="w-full text-left text-xs mt-2"><tbody>{plan.overBudget.map(row)}</tbody></table></div>}
          </div>
        )}
        <p className="flex gap-2 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Predictions, not promises. &quot;Billing protected&quot; is the model&apos;s predicted fall in a customer&apos;s expected annual billing lost if they looked like a customer with that offer. It is an association learned from past customers, not a measured effect of making the offer. {plan.noWorthwhileOffer} customer{plan.noWorthwhileOffer === 1 ? ' has' : 's have'} no offer worth its cost at these prices.</span>
        </p>
      </div>
    </div>
  );
};
