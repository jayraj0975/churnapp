import React from 'react';
import { CustomerProfile, ContractType, InternetServiceType, PaymentMethodType } from '../types';
import { Sliders, Shield, Zap, CreditCard, User, RotateCcw } from 'lucide-react';

interface CustomerFormProps {
  profile: CustomerProfile;
  onChange: (updated: CustomerProfile) => void;
  onReset: () => void;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  profile,
  onChange,
  onReset,
}) => {
  const updateField = <K extends keyof CustomerProfile>(field: K, value: CustomerProfile[K]) => {
    onChange({
      ...profile,
      [field]: value,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            Customer Attributes & Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure subscriber contract terms, service subscriptions, and billing parameters.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          title="Reset to default baseline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Customer Name & Identifier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Customer Name
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g. Alex Morgan"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Subscriber ID
          </label>
          <input
            type="text"
            value={profile.id}
            onChange={(e) => updateField('id', e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
            placeholder="CUST-1234"
          />
        </div>
      </div>

      {/* Section 1: Contract & Tenure */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <CreditCard className="w-4 h-4 text-slate-500" />
          <span>Contract & Billing Terms</span>
        </div>

        {/* Contract Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Contract Commitment Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Month-to-month', 'One year', 'Two year'] as ContractType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateField('contract', type)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  profile.contract === type
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Tenure Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Tenure with Company
            </label>
            <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded">
              {profile.tenure} {profile.tenure === 1 ? 'Month' : 'Months'} ({(profile.tenure / 12).toFixed(1)} yrs)
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="72"
            value={profile.tenure}
            onChange={(e) => updateField('tenure', Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
            <span>0 mo (New)</span>
            <span>24 mo (2 yrs)</span>
            <span>48 mo (4 yrs)</span>
            <span>72 mo (Loyal)</span>
          </div>
        </div>

        {/* Monthly Charges Slider & Direct Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Monthly Charges ($/month)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-700">$</span>
              <input
                type="number"
                min="18"
                max="130"
                step="0.5"
                value={profile.monthlyCharges}
                onChange={(e) => updateField('monthlyCharges', Number(e.target.value))}
                className="w-20 px-2 py-0.5 text-xs font-bold text-slate-800 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <input
            type="range"
            min="18"
            max="130"
            step="0.5"
            value={profile.monthlyCharges}
            onChange={(e) => updateField('monthlyCharges', Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
            <span>$18.00 (Economy)</span>
            <span>$65.00 (Average)</span>
            <span>$130.00 (Premium)</span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Payment Method
          </label>
          <select
            value={profile.paymentMethod}
            onChange={(e) => updateField('paymentMethod', e.target.value as PaymentMethodType)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            <option value="Electronic check">Electronic check (Highest Churn Risk)</option>
            <option value="Mailed check">Mailed check</option>
            <option value="Bank transfer (automatic)">Bank transfer (ACH automatic)</option>
            <option value="Credit card (automatic)">Credit card (Automatic recurring)</option>
          </select>
        </div>

        {/* Paperless Billing Switch */}
        <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/70 transition-colors">
          <span className="text-xs font-medium text-slate-700">
            Paperless Billing Enrolled
          </span>
          <input
            type="checkbox"
            checked={profile.paperlessBilling}
            onChange={(e) => updateField('paperlessBilling', e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
          />
        </label>
      </div>

      {/* Section 2: Internet & Support Services */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Internet & Value-Added Services</span>
        </div>

        {/* Internet Service Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Internet Infrastructure Service
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Fiber optic', 'DSL', 'No'] as InternetServiceType[]).map((net) => (
              <button
                key={net}
                type="button"
                onClick={() => updateField('internetService', net)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  profile.internetService === net
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {net === 'No' ? 'No Internet' : net}
              </button>
            ))}
          </div>
        </div>

        {/* Support & Addon Service Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label
            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
              profile.techSupport
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Tech Support</span>
              <span className="text-[10px] text-slate-500">24/7 dedicated troubleshooting</span>
            </div>
            <input
              type="checkbox"
              checked={profile.techSupport}
              onChange={(e) => updateField('techSupport', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label
            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors cursor-pointer ${
              profile.onlineSecurity
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Online Security</span>
              <span className="text-[10px] text-slate-500">Antivirus & firewall guard</span>
            </div>
            <input
              type="checkbox"
              checked={profile.onlineSecurity}
              onChange={(e) => updateField('onlineSecurity', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Online Cloud Backup</span>
              <span className="text-[10px] text-slate-500">Encrypted offsite storage</span>
            </div>
            <input
              type="checkbox"
              checked={profile.onlineBackup}
              onChange={(e) => updateField('onlineBackup', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Device Protection</span>
              <span className="text-[10px] text-slate-500">Hardware warranty coverage</span>
            </div>
            <input
              type="checkbox"
              checked={profile.deviceProtection}
              onChange={(e) => updateField('deviceProtection', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>
        </div>

        {/* Entertainment Streaming Services */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <span className="text-xs font-medium text-slate-700">Streaming TV</span>
            <input
              type="checkbox"
              checked={profile.streamingTV}
              onChange={(e) => updateField('streamingTV', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <span className="text-xs font-medium text-slate-700">Streaming Movies</span>
            <input
              type="checkbox"
              checked={profile.streamingMovies}
              onChange={(e) => updateField('streamingMovies', e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* Section 3: Household & Demographics */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <User className="w-4 h-4 text-slate-500" />
          <span>Household & Demographics</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-center">
            <span className="text-xs font-medium text-slate-800">Senior (65+)</span>
            <input
              type="checkbox"
              checked={profile.seniorCitizen}
              onChange={(e) => updateField('seniorCitizen', e.target.checked)}
              className="mt-1.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-center">
            <span className="text-xs font-medium text-slate-800">Has Partner</span>
            <input
              type="checkbox"
              checked={profile.partner}
              onChange={(e) => updateField('partner', e.target.checked)}
              className="mt-1.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col items-center justify-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-center">
            <span className="text-xs font-medium text-slate-800">Dependents</span>
            <input
              type="checkbox"
              checked={profile.dependents}
              onChange={(e) => updateField('dependents', e.target.checked)}
              className="mt-1.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
