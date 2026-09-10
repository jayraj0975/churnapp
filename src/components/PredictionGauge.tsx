import React from 'react';
import { RiskLevel } from '../types';
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

interface PredictionGaugeProps {
  probability: number; // 0 to 100
  riskLevel: RiskLevel;
  threshold: number; // 0 to 1
  logit: number;
}

export const PredictionGauge: React.FC<PredictionGaugeProps> = ({
  probability,
  riskLevel,
  threshold,
}) => {
  // Semi-circle SVG calculation
  // Radius 80, Center (100, 95)
  // Angle from -180 to 0 deg (or PI to 0)
  const radius = 74;
  const circumference = Math.PI * radius; // approx 232.48
  const strokeDashoffset = circumference - (probability / 100) * circumference;

  // Threshold angle marker
  const thresholdAngle = Math.PI - (threshold * Math.PI);
  const markerX = 100 + radius * Math.cos(thresholdAngle);
  const markerY = 95 - radius * Math.sin(thresholdAngle);

  const getRiskColors = () => {
    switch (riskLevel) {
      case 'High':
        return {
          stroke: '#ef4444',
          bgBadge: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
          icon: AlertTriangle,
          label: 'High Attrition Risk',
          textClass: 'text-rose-600',
        };
      case 'Moderate':
        return {
          stroke: '#f59e0b',
          bgBadge: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: AlertCircle,
          label: 'Moderate Risk',
          textClass: 'text-amber-600',
        };
      case 'Low':
      default:
        return {
          stroke: '#10b981',
          bgBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: CheckCircle2,
          label: 'Low Risk (Retained)',
          textClass: 'text-emerald-600',
        };
    }
  };

  const riskMeta = getRiskColors();
  const IconComponent = riskMeta.icon;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Churn Probability Score
        </span>
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${riskMeta.bgBadge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${riskMeta.dot}`} />
          <IconComponent className="w-3.5 h-3.5" />
          <span>{riskMeta.label}</span>
        </div>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative flex items-center justify-center w-56 h-36">
        <svg className="w-56 h-36 overflow-visible" viewBox="0 0 200 120">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="85%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <path
            d="M 26 95 A 74 74 0 0 1 174 95"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Value Arc */}
          <path
            d="M 26 95 A 74 74 0 0 1 174 95"
            fill="none"
            stroke={riskMeta.stroke}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />

          {/* Threshold Marker Indicator */}
          <circle
            cx={markerX}
            cy={markerY}
            r="3.5"
            fill="#475569"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>

        {/* Center Display */}
        <div className="absolute top-14 flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline">
            <span className={`text-4xl font-extrabold tracking-tight ${riskMeta.textClass}`}>
              {probability.toFixed(1)}
            </span>
            <span className={`ml-0.5 text-xl font-bold ${riskMeta.textClass}`}>%</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Decision Threshold: {(threshold * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Gauge Scale Labels */}
      <div className="flex justify-between w-full px-4 text-xs font-semibold text-slate-400 -mt-2">
        <span>0% (Safe)</span>
        <span>50%</span>
        <span>100% (Churn)</span>
      </div>
    </div>
  );
};
