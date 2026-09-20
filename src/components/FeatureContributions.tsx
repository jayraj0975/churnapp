import React from 'react';
import { RiskFactorContribution } from '../types';
import { TrendingUp, TrendingDown, ShieldAlert, Sparkles } from 'lucide-react';

interface FeatureContributionsProps {
  topRiskDrivers: RiskFactorContribution[];
  topProtectiveFactors: RiskFactorContribution[];
}

export const FeatureContributions: React.FC<FeatureContributionsProps> = ({
  topRiskDrivers,
  topProtectiveFactors,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Feature Contributions
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Identifies specific subscriber attributes elevating or reducing churn likelihood.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Elevating Drivers (+) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 uppercase tracking-wide">
            <TrendingUp className="w-4 h-4 text-rose-600" />
            <span>Top Churn Accelerators (+ Risk)</span>
          </div>

          {topRiskDrivers.length === 0 ? (
            <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
              No significant risk-elevating drivers detected.
            </div>
          ) : (
            topRiskDrivers.map((driver, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-rose-100 bg-rose-50/50 hover:bg-rose-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {driver.featureName}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                        {driver.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {driver.description}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-700 whitespace-nowrap px-2 py-0.5 bg-rose-200/70 rounded">
                    +{driver.impactPercentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-rose-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, driver.impactPercentage * 3)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Protective Factors (-) */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            <span>Top Protective Anchors (- Risk)</span>
          </div>

          {topProtectiveFactors.length === 0 ? (
            <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
              No protective features currently active for this profile.
            </div>
          ) : (
            topProtectiveFactors.map((factor, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {factor.featureName}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                        {factor.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {factor.description}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 whitespace-nowrap px-2 py-0.5 bg-emerald-200/70 rounded">
                    {factor.impactPercentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-emerald-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.abs(factor.impactPercentage) * 2.6)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
