import React, { useState } from 'react';
import { CustomerProfile, PredictionResult, RetentionStrategyResponse } from '../types';
import { Sparkles, Check, Copy, X, ArrowRight, DollarSign, Clock, ShieldCheck, Mail, Phone } from 'lucide-react';

interface RetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CustomerProfile;
  prediction: PredictionResult;
  retentionData: RetentionStrategyResponse | null;
  isLoading: boolean;
  onGenerate: () => void;
}

export const RetentionModal: React.FC<RetentionModalProps> = ({
  isOpen,
  onClose,
  profile,
  prediction,
  retentionData,
  isLoading,
  onGenerate,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!retentionData?.actionScript?.messageBody) return;
    navigator.clipboard.writeText(
      `Subject: ${retentionData.actionScript.subjectOrOpener}\n\n${retentionData.actionScript.messageBody}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Retention Strategy & Intervention Playbook
              </h3>
              <p className="text-xs text-slate-500">
                Tailored prescriptive recommendations for {profile.name} ({profile.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Risk Context Banner */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Calculated Attrition Risk:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded-full ${
                  prediction.riskLevel === 'High'
                    ? 'bg-rose-100 text-rose-800'
                    : prediction.riskLevel === 'Moderate'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {prediction.churnProbability}% ({prediction.riskLevel} Risk)
              </span>
            </div>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-900">${prediction.annualRevenueAtRisk}</span> / yr at risk
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-700">
                Synthesizing prescriptive retention strategy...
              </p>
              <p className="text-[11px] text-slate-400">
                Analyzing feature weights, lifetime value, and discount elasticity
              </p>
            </div>
          ) : retentionData ? (
            <div className="space-y-5">
              {/* Executive Summary */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">
                  Executive Diagnosis
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {retentionData.riskSummary}
                </p>
              </div>

              {/* Recommended Actionable Offers */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  Recommended Retention Incentives
                </h4>
                <div className="space-y-2.5">
                  {retentionData.recommendedIncentives.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Cost: {item.costToBusiness}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {item.impactEstimate}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[11px] text-slate-600">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{item.roiVerdict}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outreach Script / Message */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    {retentionData.actionScript.channel === 'Phone Call' ? (
                      <Phone className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    Outreach Script ({retentionData.actionScript.channel})
                  </h4>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Script'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-2 font-mono">
                  <div className="text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                    <span className="text-indigo-400 font-semibold">
                      {retentionData.actionScript.channel === 'Phone Call' ? 'Opening Hook:' : 'Subject:'}
                    </span>{' '}
                    {retentionData.actionScript.subjectOrOpener}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed pt-1 text-slate-200 font-sans text-xs">
                    {retentionData.actionScript.messageBody}
                  </div>
                </div>
              </div>

              {/* Timing recommendation */}
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Recommended Timing:</strong> {retentionData.timingRecommendation}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-slate-500 mb-4">
                Click below to generate a customer outreach script and retention package. Impact figures come from the model; the wording is written by Gemini when an API key is set.
              </p>
              <button
                type="button"
                onClick={onGenerate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Retention Playbook</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {retentionData?.aiGenerated ? 'Generated with Gemini AI Model' : 'Algorithmic Prescriptive Playbook'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
            {retentionData && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isLoading}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
