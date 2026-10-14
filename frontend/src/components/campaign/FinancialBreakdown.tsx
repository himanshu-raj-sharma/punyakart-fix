import React from 'react';
import { FINANCIAL_ALLOCATIONS } from '../../data/campaigns';
import { PieChart, ShieldCheck, FileSpreadsheet, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const FinancialBreakdown: React.FC = () => {
  const totalAuditedAmount = FINANCIAL_ALLOCATIONS.reduce((sum, item) => sum + item.totalAllocation, 0);

  const getStatusBadge = (status: string, color: string) => {
    switch (color) {
      case 'amber':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            {status}
          </span>
        );
      case 'blue':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <Clock className="w-3 h-3 text-blue-600" />
            {status}
          </span>
        );
      case 'emerald':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <Clock className="w-3 h-3 text-purple-600" />
            {status}
          </span>
        );
    }
  };

  return (
    <section id="transparency" className="py-12 sm:py-16 bg-[#FDFBF7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md mb-3">
            <PieChart className="w-3.5 h-3.5 text-emerald-700" />
            100% Financial Transparency
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2942]">
            Where Your Money Goes
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Every rupee donated directly finances tangible feed, trauma medications, and rescue equipment. No exorbitant administrative bloat—direct gauseva impact.
          </p>
        </div>

        {/* Audited Table Card */}
        <div className="bg-white rounded-2xl border border-[#EAE5DD] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              <span className="font-display font-bold text-sm sm:text-base text-[#0F2942]">
                Audited Emergency Expense Ledger (Phase 1)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Independent CA Verified Audit</span>
            </div>
          </div>

          {/* Mobile Card List View (Visible on < md) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {FINANCIAL_ALLOCATIONS.map((row) => (
              <div key={row.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display font-bold text-slate-900 text-sm">
                    {row.material}
                  </span>
                  {getStatusBadge(row.status, row.statusColor)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Qty / Need</span>
                    <span className="font-semibold text-slate-800">{row.requiredQty}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Est. Unit Cost</span>
                    <span className="font-mono text-slate-800">₹{row.unitCost.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 font-medium">Total Allocation:</span>
                  <span className="font-display font-bold text-base text-[#0F2942]">
                    ₹{row.totalAllocation.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            <div className="p-4 bg-amber-50/80 border-t-2 border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Total Phase 1 Target:
                </span>
                <span className="font-display font-bold text-lg text-[#9F3D00]">
                  ₹ {totalAuditedAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Table View (Visible on >= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Material / Supply Item</th>
                  <th className="py-3.5 px-4 sm:px-6">Required Quantity</th>
                  <th className="py-3.5 px-4 sm:px-6">Est. Unit Cost</th>
                  <th className="py-3.5 px-4 sm:px-6">Total Allocation</th>
                  <th className="py-3.5 px-4 sm:px-6">Procurement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FINANCIAL_ALLOCATIONS.map((row) => (
                  <tr key={row.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-semibold text-slate-900">
                      {row.material}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-slate-600 font-medium">
                      {row.requiredQty}
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-slate-600 font-mono">
                      ₹{row.unitCost.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 sm:px-6 font-display font-bold text-[#0F2942]">
                      ₹{row.totalAllocation.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      {getStatusBadge(row.status, row.statusColor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50/60 font-display font-bold border-t-2 border-amber-200">
                  <td colSpan={3} className="py-4 px-4 sm:px-6 text-slate-900 font-bold text-sm sm:text-base">
                    Total Phase 1 Emergency Rescue Allocation Target
                  </td>
                  <td colSpan={2} className="py-4 px-4 sm:px-6 text-[#9F3D00] text-lg sm:text-xl">
                    ₹ {totalAuditedAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audit Guarantee Note */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Audited under Income Tax Section 12A / 80G by Sharma &amp; Associates, Dehradun.</span>
          </div>
          <div className="font-medium text-slate-500">
            NITI Aayog NGO Darpan Unique ID: <span className="font-mono text-slate-800">UA/2021/0284719</span>
          </div>
        </div>

      </div>
    </section>
  );
};
