import React, { useState } from 'react';
import { CustomerProfile } from '../types';
import { Sparkles, AlertCircle } from 'lucide-react';

interface InvestigationResult {
  available: boolean;
  reason?: string;
  modelSignal: Record<string, unknown> | null;
  interpretation: string;
  recommendedAction: string;
  confidence: 'low' | 'medium' | 'high' | null;
}

interface AskAiPanelProps {
  profile: CustomerProfile;
  portfolio: CustomerProfile[];
}

/**
 * Natural-language investigation over the real, already-computed model outputs for this
 * customer (and the rest of the portfolio, for segment questions). The AI never invents a
 * number here - modelSignal below is always copied verbatim from a real tool call.
 */
export const AskAiPanel: React.FC<AskAiPanelProps> = ({ profile, portfolio }) => {
  const [question, setQuestion] = useState(`Why is ${profile.name} at risk, and what should we do?`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);

  const ask = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ai/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, portfolio }),
      });
      setResult(await res.json());
    } catch {
      setResult({ available: false, reason: 'Could not reach the server.', modelSignal: null, interpretation: '', recommendedAction: '', confidence: null });
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor =
    result?.confidence === 'high' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    result?.confidence === 'medium' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-slate-600 bg-slate-100 border-slate-200';

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
        Ask AI
      </h4>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          placeholder="Ask about this customer or the portfolio..."
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || question.trim().length === 0}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {loading ? 'Asking...' : 'Ask'}
        </button>
      </div>

      {result && !result.available && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.reason}</span>
        </div>
      )}

      {result && result.available && (
        <div className="space-y-2.5">
          {result.modelSignal && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Model Signal (computed, not AI-generated)
              </span>
              <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result.modelSignal, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              AI Interpretation
            </span>
            <p className="text-xs text-slate-700">{result.interpretation}</p>
          </div>
          {result.recommendedAction && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Recommended Action
              </span>
              <p className="text-xs text-slate-700">{result.recommendedAction}</p>
            </div>
          )}
          {result.confidence && (
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
              Confidence: {result.confidence}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
