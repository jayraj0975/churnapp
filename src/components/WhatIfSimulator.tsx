import React, { useState } from 'react';
import { CustomerProfile, WhatIfAdjustments, ContractType, PaymentMethodType } from '../types';
import { simulateWhatIf } from '../lib/churnEngine';
import { Sliders, ArrowRight, TrendingDown, DollarSign, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';

interface WhatIfSimulatorProps {
  profile: CustomerProfile;
  onApplyToProfile: (updatedProfile: CustomerProfile) => void;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  profile,
  onApplyToProfile,
}) => {
  const [contractChoice, setContractChoice] = useState<ContractType>(
    profile.contract === 'Month-to-month' ? 'One year' : profile.contract
  );
  const [discount, setDiscount] = useState<number>(10);
  const [addTechSupport, setAddTechSupport] = useState<boolean>(!profile.techSupport);
  const [addOnlineSecurity, setAddOnlineSecurity] = useState<boolean>(!profile.onlineSecurity);
  const [switchAutoPay, setSwitchAutoPay] = useState<boolean>(
    profile.paymentMethod === 'Electronic check'
  );

  const adjustments: WhatIfAdjustments = {
    contract: contractChoice,
    monthlyDiscount: discount,
    addTechSupport: addTechSupport || profile.techSupport,
    addOnlineSecurity: addOnlineSecurity || profile.onlineSecurity,
    switchPaymentMethod: switchAutoPay ? 'Credit card (automatic)' : profile.paymentMethod,
  };

  const simulation = simulateWhatIf(profile, adjustments);

  // Each lever's effect for THIS customer, computed by the model on its own (not summed from the levers above).
  const soloDelta = (adj: WhatIfAdjustments) => simulateWhatIf(profile, adj).probabilityDelta;
  const describe = (delta: number, alreadyApplies: boolean) =>
    alreadyApplies
      ? 'Already applies to this customer'
      : `Model estimate for this customer: ${delta > 0 ? '+' : delta < 0 ? '\u2212' : ''}${Math.abs(delta).toFixed(1)} pts churn risk (association, not proven cause)`;
  const isAutoPay = profile.paymentMethod === 'Credit card (automatic)' || profile.paymentMethod === 'Bank transfer (automatic)';
  const twoYearDelta = soloDelta({ contract: 'Two year' });

  const handleApply = () => {
    onApplyToProfile({
      ...profile,
      contract: adjustments.contract ?? profile.contract,
      monthlyCharges: Math.max(18, profile.monthlyCharges - (adjustments.monthlyDiscount ?? 0)),
      techSupport: adjustments.addTechSupport ?? profile.techSupport,
      onlineSecurity: adjustments.addOnlineSecurity ?? profile.onlineSecurity,
      paymentMethod: adjustments.switchPaymentMethod ?? profile.paymentMethod,
    });
  };

  const handleResetLevers = () => {
    setContractChoice(profile.contract);
    setDiscount(0);
    setAddTechSupport(false);
    setAddOnlineSecurity(false);
    setSwitchAutoPay(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            "What-If" Sensitivity Simulator & Intervention Sandbox
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test retention levers in real-time to observe the model-predicted change in risk and in expected annual billing exposure.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetLevers}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Levers</span>
        </button>
      </div>

      {/* Side-by-side Comparison Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Baseline Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Current Baseline State
          </span>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-800">
              {simulation.baselineResult.churnProbability}%
            </div>
            <span
              className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                simulation.baselineResult.riskLevel === 'High'
                  ? 'bg-rose-100 text-rose-800'
                  : simulation.baselineResult.riskLevel === 'Moderate'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {simulation.baselineResult.riskLevel} Risk
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
            ${simulation.baselineResult.annualRevenueAtRisk}/yr of billing exposed
          </div>
        </div>

        {/* Delta Card */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col justify-between items-center text-center">
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
            Retention Impact Delta
          </span>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-indigo-700 flex items-center justify-center gap-1">
              <TrendingDown className="w-7 h-7 text-indigo-600" />
              <span>{Math.abs(simulation.probabilityDelta)}%</span>
            </div>
            <span className="text-xs font-semibold text-indigo-900 block mt-1">
              {simulation.probabilityDelta < 0 ? 'Predicted risk drop' : 'Risk Change'}
            </span>
          </div>
          <div className="text-xs font-bold text-emerald-700 bg-white/80 px-2.5 py-1 rounded-md border border-emerald-200 w-full">
            Modeled exposure reduction: ${simulation.modeledExposureReduction}/yr
          </div>
        </div>

        {/* Simulated Card */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Simulated Post-Intervention
          </span>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-700">
              {simulation.simulatedResult.churnProbability}%
            </div>
            <span
              className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                simulation.newRiskLevel === 'High'
                  ? 'bg-rose-100 text-rose-800'
                  : simulation.newRiskLevel === 'Moderate'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {simulation.newRiskLevel} Risk
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-200 text-xs text-emerald-700 font-medium">
            Expected annual billing exposure: ${simulation.simulatedResult.expectedAnnualExposure}
          </div>
        </div>
      </div>

      {/* Interactive Levers */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Simulated Retention Levers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lever 1: Contract Upgrade */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                1. Contract Term Commitment
              </span>
              <span className="text-[11px] text-indigo-600 font-bold">
                {profile.contract === 'Two year' ? 'Already two-year' : `Two-year: ${twoYearDelta > 0 ? '+' : '\u2212'}${Math.abs(twoYearDelta).toFixed(1)} pts`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Month-to-month', 'One year', 'Two year'] as ContractType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContractChoice(t)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    contractChoice === t
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Lever 2: Monthly Retention Discount */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                2. Monthly Loyalty Discount
              </span>
              <span className="text-xs font-bold text-indigo-700">
                -${discount}/mo (${profile.monthlyCharges - discount}/mo)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="5"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>$0</span>
              <span>$5/mo</span>
              <span>$10/mo</span>
              <span>$15/mo</span>
              <span>$25/mo</span>
            </div>
          </div>

          {/* Lever 3: Tech Support Bundle */}
          <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">
                3. Complimentary 24/7 Tech Support
              </span>
              <span className="text-[11px] text-slate-500">
                {describe(soloDelta({ addTechSupport: true }), profile.techSupport)}
              </span>
            </div>
            <input
              type="checkbox"
              checked={addTechSupport}
              onChange={(e) => setAddTechSupport(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          {/* Lever 4: Online Security Suite */}
          <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">
                4. Free Online Security & Anti-Malware
              </span>
              <span className="text-[11px] text-slate-500">
                {describe(soloDelta({ addOnlineSecurity: true }), profile.onlineSecurity)}
              </span>
            </div>
            <input
              type="checkbox"
              checked={addOnlineSecurity}
              onChange={(e) => setAddOnlineSecurity(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          {/* Lever 5: Auto-Pay Transition */}
          <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 md:col-span-2">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">
                5. Auto-Pay Billing Transition (ACH / Recurring Credit Card)
              </span>
              <span className="text-[11px] text-slate-500">
                {describe(soloDelta({ switchPaymentMethod: 'Credit card (automatic)' }), isAutoPay)}
              </span>
            </div>
            <input
              type="checkbox"
              checked={switchAutoPay}
              onChange={(e) => setSwitchAutoPay(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* Action to Apply to Profile */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          Ready to enact these retention changes on {profile.name}'s active profile?
        </div>
        <button
          type="button"
          onClick={handleApply}
          className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors inline-flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Apply These Interventions to Profile</span>
        </button>
      </div>
    </div>
  );
};
