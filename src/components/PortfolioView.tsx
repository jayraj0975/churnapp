import React, { useState, useMemo } from 'react';
import { CustomerProfile, RiskLevel } from '../types';
import { calculateChurnPrediction } from '../lib/churnEngine';
import { Users, Search, Download, Plus, ArrowUpRight, Filter, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

interface PortfolioViewProps {
  portfolio: CustomerProfile[];
  onSelectCustomer: (customer: CustomerProfile) => void;
  onAddCustomer: (customer: CustomerProfile) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  portfolio,
  onSelectCustomer,
  onAddCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'All' | RiskLevel>('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // New customer form state
  const [newCustomer, setNewCustomer] = useState<Partial<CustomerProfile>>({
    name: '',
    id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    tenure: 6,
    monthlyCharges: 75.0,
    contract: 'Month-to-month',
    internetService: 'Fiber optic',
    paymentMethod: 'Electronic check',
    techSupport: false,
    onlineSecurity: false,
    paperlessBilling: true,
  });

  // Calculate scores for all portfolio records
  const enrichedPortfolio = useMemo(() => {
    return portfolio.map((c) => {
      const pred = calculateChurnPrediction(c);
      return {
        ...c,
        prediction: pred,
      };
    });
  }, [portfolio]);

  // Aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const total = enrichedPortfolio.length;
    if (total === 0) return { total: 0, avgRisk: 0, highRiskCount: 0, totalMrrAtRisk: 0 };

    const highRiskCount = enrichedPortfolio.filter((c) => c.prediction.riskLevel === 'High').length;
    const avgRisk = Math.round(
      enrichedPortfolio.reduce((acc, c) => acc + c.prediction.churnProbability, 0) / total
    );
    const totalMrrAtRisk = enrichedPortfolio
      .filter((c) => c.prediction.willChurn)
      .reduce((acc, c) => acc + c.monthlyCharges, 0);

    return {
      total,
      avgRisk,
      highRiskCount,
      totalMrrAtRisk: Math.round(totalMrrAtRisk),
    };
  }, [enrichedPortfolio]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return enrichedPortfolio.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = riskFilter === 'All' || c.prediction.riskLevel === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [enrichedPortfolio, searchTerm, riskFilter]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Name',
      'Tenure (Months)',
      'Monthly Charges ($)',
      'Contract',
      'Internet Service',
      'Payment Method',
      'Tech Support',
      'Churn Probability (%)',
      'Risk Level',
    ];

    const rows = filteredRows.map((c) => [
      c.id,
      `"${c.name}"`,
      c.tenure,
      c.monthlyCharges.toFixed(2),
      `"${c.contract}"`,
      `"${c.internetService}"`,
      `"${c.paymentMethod}"`,
      c.techSupport ? 'Yes' : 'No',
      c.prediction.churnProbability,
      c.prediction.riskLevel,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `churn_portfolio_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;

    const fullProfile: CustomerProfile = {
      id: newCustomer.id || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newCustomer.name,
      tenure: Number(newCustomer.tenure || 6),
      monthlyCharges: Number(newCustomer.monthlyCharges || 70),
      contract: (newCustomer.contract as any) || 'Month-to-month',
      internetService: (newCustomer.internetService as any) || 'Fiber optic',
      onlineSecurity: !!newCustomer.onlineSecurity,
      onlineBackup: false,
      deviceProtection: false,
      techSupport: !!newCustomer.techSupport,
      streamingTV: false,
      streamingMovies: false,
      paperlessBilling: !!newCustomer.paperlessBilling,
      paymentMethod: (newCustomer.paymentMethod as any) || 'Electronic check',
      seniorCitizen: false,
      partner: false,
      dependents: false,
      phoneService: true,
      multipleLines: false,
    };

    onAddCustomer(fullProfile);
    setShowAddModal(false);
    setNewCustomer({
      name: '',
      id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
      tenure: 6,
      monthlyCharges: 75.0,
      contract: 'Month-to-month',
      internetService: 'Fiber optic',
      paymentMethod: 'Electronic check',
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Subscriber Portfolio & Cohort Risk Monitor
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor accounts across your customer base, prioritize interventions, and export audit datasets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Cohort Size
          </span>
          <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
            {aggregateMetrics.total} Accounts
          </span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Average Churn Risk
          </span>
          <span className="text-xl font-extrabold text-indigo-600 mt-0.5 block">
            {aggregateMetrics.avgRisk}%
          </span>
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            High Risk Accounts
          </span>
          <span className="text-xl font-extrabold text-rose-800 mt-0.5 block">
            {aggregateMetrics.highRiskCount} (
            {Math.round((aggregateMetrics.highRiskCount / (aggregateMetrics.total || 1)) * 100)}%)
          </span>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
            Monthly billing of flagged accounts
          </span>
          <span className="text-xl font-extrabold text-amber-800 mt-0.5 block">
            ${aggregateMetrics.totalMrrAtRisk}/mo
          </span>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by customer name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {(['All', 'High', 'Moderate', 'Low'] as Array<'All' | RiskLevel>).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setRiskFilter(level)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                riskFilter === level
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-3">Contract</th>
              <th className="py-3 px-3">Tenure</th>
              <th className="py-3 px-3">Monthly Charge</th>
              <th className="py-3 px-3">Internet & Tech</th>
              <th className="py-3 px-3">Churn Probability</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                  No customers found matching the search criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((c) => {
                const pred = c.prediction;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectCustomer(c)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">{c.id}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                        {c.contract}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {c.tenure} mo ({Math.round(c.tenure / 12 * 10) / 10} yrs)
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      ${c.monthlyCharges.toFixed(2)}/mo
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-700 font-medium">{c.internetService}</div>
                      <div className="text-[10px] text-slate-400">
                        {c.techSupport ? '✓ Tech Support' : '✗ No Support'}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                            pred.riskLevel === 'High'
                              ? 'bg-rose-100 text-rose-800'
                              : pred.riskLevel === 'Moderate'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {pred.churnProbability}%
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {pred.riskLevel}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCustomer(c);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <span>Analyze</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Add Subscriber to Cohort</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter subscriber details to calculate predictive churn metrics.
            </p>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Wells"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="72"
                    value={newCustomer.tenure}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, tenure: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Bill ($)
                  </label>
                  <input
                    type="number"
                    min="18"
                    max="130"
                    value={newCustomer.monthlyCharges}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, monthlyCharges: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contract Type
                </label>
                <select
                  value={newCustomer.contract}
                  onChange={(e) => setNewCustomer({ ...newCustomer, contract: e.target.value as any })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="Month-to-month">Month-to-month</option>
                  <option value="One year">One year</option>
                  <option value="Two year">Two year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internet Service
                </label>
                <select
                  value={newCustomer.internetService}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, internetService: e.target.value as any })
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                >
                  <option value="Fiber optic">Fiber optic</option>
                  <option value="DSL">DSL</option>
                  <option value="No">No Internet</option>
                </select>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCustomer.techSupport}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, techSupport: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span>Tech Support</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCustomer.onlineSecurity}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, onlineSecurity: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span>Online Security</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
