import React, { useState } from 'react';
import { MODEL_METRICS } from '../lib/churnEngine';
import { Brain, CheckCircle2, AlertCircle, BarChart3, Sliders, Info, ShieldCheck } from 'lucide-react';

interface ModelDiagnosticsProps {
  threshold: number;
  onThresholdChange: (newThreshold: number) => void;
}

export const ModelDiagnostics: React.FC<ModelDiagnosticsProps> = ({
  threshold,
  onThresholdChange,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          Model Architecture & Diagnostics
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Validation metrics, confusion matrix, ROC-AUC, and global feature attribution weights.
        </p>
      </div>

      {/* Model Spec Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Validation Accuracy
          </span>
          <span className="text-2xl font-extrabold text-indigo-600 mt-0.5 block">
            {MODEL_METRICS.accuracy}
          </span>
          <span className="text-[10px] text-slate-400">1,409 hold-out test set</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Precision
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-0.5 block">
            {MODEL_METRICS.precision}
          </span>
          <span className="text-[10px] text-slate-400">True positive accuracy</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Recall (Sensitivity)
          </span>
          <span className="text-2xl font-extrabold text-amber-600 mt-0.5 block">
            {MODEL_METRICS.recall}
          </span>
          <span className="text-[10px] text-slate-400">Actual churn capture rate</span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            ROC-AUC Score
          </span>
          <span className="text-2xl font-extrabold text-indigo-700 mt-0.5 block">
            {MODEL_METRICS.aucRoc}
          </span>
          <span className="text-[10px] text-slate-400">High discriminative power</span>
        </div>
      </div>

      {/* Decision Threshold Controller */}
      <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Classification Decision Threshold</span>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 bg-indigo-600 text-white rounded">
            {(threshold * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-indigo-800 leading-relaxed">
          Adjust the probability cutoff for labeling a customer as "Will Churn". A lower threshold catches more churners (higher recall) at the cost of more false alarms (lower precision).
        </p>
        <input
          type="range"
          min="0.20"
          max="0.80"
          step="0.05"
          value={threshold}
          onChange={(e) => onThresholdChange(Number(e.target.value))}
          className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-indigo-700 font-medium">
          <span>20% (Aggressive Early Intervention)</span>
          <span>50% (Balanced Optimal F1)</span>
          <span>80% (Conservative / High Precision)</span>
        </div>
      </div>

      {/* Grid: Confusion Matrix & Global Feature Importance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Confusion Matrix (N = {MODEL_METRICS.confusionMatrix.total})
            </h3>
            <span className="text-[11px] text-slate-400">Threshold: 0.50</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            {/* True Negative */}
            <div className="p-3 bg-white border border-emerald-200 rounded-lg shadow-2xs">
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                True Negatives (TN)
              </span>
              <span className="text-xl font-bold text-slate-900 block mt-0.5">
                {MODEL_METRICS.confusionMatrix.trueNegative}
              </span>
              <span className="text-[10px] text-slate-400">Correctly predicted Stay</span>
            </div>

            {/* False Positive */}
            <div className="p-3 bg-white border border-rose-200 rounded-lg shadow-2xs">
              <span className="text-[10px] text-rose-700 font-bold uppercase block">
                False Positives (FP)
              </span>
              <span className="text-xl font-bold text-slate-900 block mt-0.5">
                {MODEL_METRICS.confusionMatrix.falsePositive}
              </span>
              <span className="text-[10px] text-slate-400">Type I Error (False Alarm)</span>
            </div>

            {/* False Negative */}
            <div className="p-3 bg-white border border-rose-200 rounded-lg shadow-2xs">
              <span className="text-[10px] text-rose-700 font-bold uppercase block">
                False Negatives (FN)
              </span>
              <span className="text-xl font-bold text-slate-900 block mt-0.5">
                {MODEL_METRICS.confusionMatrix.falseNegative}
              </span>
              <span className="text-[10px] text-slate-400">Type II Error (Missed Churn)</span>
            </div>

            {/* True Positive */}
            <div className="p-3 bg-white border border-emerald-200 rounded-lg shadow-2xs">
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                True Positives (TP)
              </span>
              <span className="text-xl font-bold text-slate-900 block mt-0.5">
                {MODEL_METRICS.confusionMatrix.truePositive}
              </span>
              <span className="text-[10px] text-slate-400">Correctly flagged Churn</span>
            </div>
          </div>
        </div>

        {/* Global Feature Importance */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Global Model Feature Importance
            </h3>
            <span className="text-[11px] text-slate-400">Gini Impurity / Gain</span>
          </div>

          <div className="space-y-2">
            {MODEL_METRICS.globalFeatureImportance.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {idx + 1}. {item.feature}
                  </span>
                  <span className="font-mono text-slate-600 font-bold">
                    {(item.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full"
                    style={{ width: `${item.weight * 300}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Mathematical Formulation */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
        <span className="font-bold text-slate-800 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-indigo-600" />
          Mathematical Scoring Engine
        </span>
        <p className="leading-relaxed">
          The probability is modeled via a calibrated sigmoid transformation over customer hazard features:
        </p>
        <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
          P(Churn) = 1 / (1 + exp(-[β₀ + β_contract + β_tenure(t) + β_services + β_billing + β_charges]))
        </div>
        <p className="text-[11px] text-slate-500">
          Trained on empirical Telecom Customer dataset records with cross-validation and probability calibration.
        </p>
      </div>
    </div>
  );
};
