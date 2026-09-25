import React, { useState, useMemo } from 'react';
import { CustomerProfile, PredictionResult, RetentionStrategyResponse } from './types';
import { CUSTOMER_PRESETS, MODEL_METRICS, SAMPLE_PORTFOLIO, buildFallbackStrategy, calculateChurnPrediction } from './lib/churnEngine';
import { Header, ActiveTab } from './components/Header';
import { CustomerForm } from './components/CustomerForm';
import { PredictionGauge } from './components/PredictionGauge';
import { FeatureContributions } from './components/FeatureContributions';
import { RetentionModal } from './components/RetentionModal';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { PortfolioView } from './components/PortfolioView';
import { ModelDiagnostics } from './components/ModelDiagnostics';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  DollarSign,
  TrendingDown,
  Calendar,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('predictor');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(CUSTOMER_PRESETS[0].id);
  const [currentProfile, setCurrentProfile] = useState<CustomerProfile>(CUSTOMER_PRESETS[0].profile);
  const [threshold, setThreshold] = useState<number>(MODEL_METRICS.bestF1Threshold);
  const [portfolio, setPortfolio] = useState<CustomerProfile[]>(SAMPLE_PORTFOLIO);

  // Retention Modal & AI Strategy State
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionData, setRetentionData] = useState<RetentionStrategyResponse | null>(null);
  const [isLoadingRetention, setIsLoadingRetention] = useState(false);

  // Compute prediction in real-time
  const prediction: PredictionResult = useMemo(() => {
    return calculateChurnPrediction(currentProfile, threshold);
  }, [currentProfile, threshold]);

  // Handle Preset Selection
  const handleSelectPreset = (preset: typeof CUSTOMER_PRESETS[0]) => {
    setSelectedPresetId(preset.id);
    setCurrentProfile({ ...preset.profile });
    setRetentionData(null);
  };

  // Handle Profile Edits
  const handleProfileChange = (updated: CustomerProfile) => {
    setSelectedPresetId(null);
    setCurrentProfile(updated);
    setRetentionData(null);
  };

  // Reset to default
  const handleReset = () => {
    handleSelectPreset(CUSTOMER_PRESETS[0]);
  };

  // Apply What-If adjustments directly to active profile
  const handleApplyWhatIf = (updatedProfile: CustomerProfile) => {
    setCurrentProfile(updatedProfile);
    setSelectedPresetId(null);
    setActiveTab('predictor');
  };

  // Select customer from portfolio
  const handleSelectPortfolioCustomer = (customer: CustomerProfile) => {
    setCurrentProfile(customer);
    setSelectedPresetId(null);
    setActiveTab('predictor');
  };

  // Add customer to portfolio
  const handleAddPortfolioCustomer = (customer: CustomerProfile) => {
    setPortfolio((prev) => [customer, ...prev]);
  };

  // Fetch or generate retention strategy
  const handleGenerateRetention = async () => {
    setIsLoadingRetention(true);
    try {
      const response = await fetch('/api/retention-strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile: currentProfile }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate retention strategy');
      }

      const data = await response.json();
      setRetentionData(data);
    } catch (err) {
      console.warn('API call error, using local fallback:', err);
      // Fallback in case of server error
      setRetentionData(buildFallbackStrategy(currentProfile, prediction));
    } finally {
      setIsLoadingRetention(false);
    }
  };

  const openRetentionModal = () => {
    setIsRetentionModalOpen(true);
    if (!retentionData) {
      handleGenerateRetention();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* App Header & Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        currentRiskLevel={prediction.riskLevel}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab 1: Core Predictor & Risk Factor Attribution */}
        {activeTab === 'predictor' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Attribute Configurator (7 cols on lg) */}
              <div className="lg:col-span-7">
                <CustomerForm
                  profile={currentProfile}
                  onChange={handleProfileChange}
                  onReset={handleReset}
                />
              </div>

              {/* Right Column: Prediction Score, Gauge & Financial Impact (5 cols on lg) */}
              <div className="lg:col-span-5 space-y-5">
                {/* Visual Gauge */}
                <PredictionGauge
                  probability={prediction.churnProbability}
                  riskLevel={prediction.riskLevel}
                  threshold={prediction.threshold}
                  logit={prediction.logit}
                />

                {/* Financial Exposure Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Monthly billing
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">
                      ${prediction.monthlyRevenueAtRisk.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400">Current bill</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Annual billing
                    </span>
                    <span className="text-lg font-extrabold text-rose-700 mt-0.5 block">
                      ${prediction.annualRevenueAtRisk}
                    </span>
                    <span className="text-[10px] text-slate-400">12 months of billing</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Expected annual billing exposure
                    </span>
                    <span className="text-lg font-extrabold text-indigo-700 mt-0.5 block">
                      ${prediction.expectedAnnualExposure}
                    </span>
                    <span className="text-[10px] text-slate-400">Annual billing x predicted churn probability (modeled, not an observed loss)</span>
                  </div>
                </div>

                {/* Actionable Retention Callout */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Prescriptive Intervention
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Next Best Action
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {prediction.retentionRecommendation}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={openRetentionModal}
                      className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Retention Script & Playbook</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('what-if')}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Test What-If</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature contributions: coefficient x deviation from the average customer */}
            <FeatureContributions
              topRiskDrivers={prediction.topRiskDrivers}
              topProtectiveFactors={prediction.topProtectiveFactors}
            />
          </div>
        )}

        {/* Tab 2: "What-If" Sensitivity Simulator */}
        {activeTab === 'what-if' && (
          <WhatIfSimulator
            profile={currentProfile}
            onApplyToProfile={handleApplyWhatIf}
          />
        )}

        {/* Tab 3: Cohort & Portfolio Monitor */}
        {activeTab === 'portfolio' && (
          <PortfolioView
            portfolio={portfolio}
            onSelectCustomer={handleSelectPortfolioCustomer}
            onAddCustomer={handleAddPortfolioCustomer}
          />
        )}

        {/* Tab 4: Model Diagnostics & Explainability */}
        {activeTab === 'model' && (
          <ModelDiagnostics
            threshold={threshold}
            onThresholdChange={setThreshold}
          />
        )}
      </main>

      {/* Retention Strategy Modal */}
      <RetentionModal
        isOpen={isRetentionModalOpen}
        onClose={() => setIsRetentionModalOpen(false)}
        profile={currentProfile}
        prediction={prediction}
        retentionData={retentionData}
        isLoading={isLoadingRetention}
        onGenerate={handleGenerateRetention}
      />
      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
