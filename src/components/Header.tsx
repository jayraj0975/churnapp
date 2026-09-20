import React from 'react';
import { CUSTOMER_PRESETS } from '../lib/churnEngine';
import { CustomerProfile } from '../types';
import { Activity, Sliders, Users, Brain, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab = 'predictor' | 'what-if' | 'portfolio' | 'model';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  selectedPresetId: string | null;
  onSelectPreset: (preset: typeof CUSTOMER_PRESETS[0]) => void;
  currentRiskLevel: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  selectedPresetId,
  onSelectPreset,
  currentRiskLevel,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Brand & Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Customer Churn Predictor
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  Logistic regression
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Predict churn probability, see what drives it, and test retention what-ifs.
              </p>
            </div>
          </div>

          {/* Actions & Quick Presets Strip */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-semibold uppercase text-slate-400 mr-0.5 shrink-0 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Presets:
              </span>
              {CUSTOMER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border whitespace-nowrap transition-all ${
                    selectedPresetId === preset.id
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-400'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />

            <PWAInstallButton />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-4 overflow-x-auto pt-2">
          <button
            type="button"
            onClick={() => onTabChange('predictor')}
            className={`pb-3 pt-1 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'predictor'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Predictor & Risk Attribution</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('what-if')}
            className={`pb-3 pt-1 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'what-if'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>"What-If" Sensitivity Simulator</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('portfolio')}
            className={`pb-3 pt-1 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'portfolio'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cohort Portfolio Monitor</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('model')}
            className={`pb-3 pt-1 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'model'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Model Diagnostics & Weights</span>
          </button>
        </div>
      </div>
    </header>
  );
};
