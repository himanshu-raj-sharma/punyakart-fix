import React, { useMemo, useState } from 'react';
import { Repeat, Search } from 'lucide-react';
import { AdminSubscription } from '../../admin/adminTypes';
import { downloadCsv, formatMoney } from '../../admin/adminApi';
import { ExportCsvButton } from './ExportCsvButton';

interface AutoPayTabProps {
  subscriptions: AdminSubscription[];
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  PAUSED: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export const AutoPayTab: React.FC<AutoPayTabProps> = ({ subscriptions }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminSubscription['status']>('all');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subscriptions.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        row.donorName,
        row.email,
        row.phone,
        row.causeTitle,
        row.razorpaySubscriptionId,
        row.initialReceiptNumber,
        row.id,
        row.status,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [subscriptions, query, statusFilter]);

  const activeCount = subscriptions.filter((row) => row.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#002D62] dark:text-blue-300" />
            Auto Pay subscriptions
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {activeCount} active · {subscriptions.length} total. Cancel / pause is done in Razorpay Dashboard →
            Subscriptions.
          </p>
        </div>
        <ExportCsvButton
          disabled={filtered.length === 0}
          onClick={() =>
            downloadCsv(
              'punyakart-autopay-subscriptions.csv',
              [
                'Donor',
                'Email',
                'Phone',
                'Amount',
                'Cause',
                'Status',
                'Start',
                'Next billing',
                'Razorpay Sub ID',
                'Seed receipt',
                'Local ID',
              ],
              filtered.map((row) => [
                row.donorName,
                row.email,
                row.phone,
                row.amount,
                row.causeTitle,
                row.status,
                row.startDate,
                row.nextBillingDate,
                row.razorpaySubscriptionId || '',
                row.initialReceiptNumber || '',
                row.id,
              ]),
            )
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search donor, mobile, Razorpay sub id…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm font-bold"
        >
          <option value="all">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs min-w-[960px]">
          <thead className="bg-slate-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
            <tr>
              <th className="px-3 py-2 font-bold">Donor</th>
              <th className="px-3 py-2 font-bold">Mobile / Email</th>
              <th className="px-3 py-2 font-bold">Amount</th>
              <th className="px-3 py-2 font-bold">Cause</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Next billing</th>
              <th className="px-3 py-2 font-bold">Razorpay Sub</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-neutral-500">
                  No Auto Pay subscriptions yet. After a donor activates Auto Pay, they appear here.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 dark:border-slate-800 align-top"
                >
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-neutral-900 dark:text-white">{row.donorName}</p>
                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{row.id}</p>
                    {row.initialReceiptNumber && (
                      <p className="text-[10px] text-[#FF6B00] font-mono mt-0.5">
                        Seed: {row.initialReceiptNumber}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-neutral-800 dark:text-neutral-200">{row.phone}</p>
                    <p className="text-neutral-500 break-all">{row.email || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 font-black text-neutral-900 dark:text-white whitespace-nowrap">
                    {formatMoney(row.amount)}
                    <span className="block text-[10px] font-bold text-neutral-400">/ month</span>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700 dark:text-neutral-300 max-w-[180px]">
                    {row.causeTitle}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                        STATUS_STYLE[row.status] || STATUS_STYLE.PENDING
                      }`}
                    >
                      {row.status}
                    </span>
                    <p className="text-[10px] text-neutral-400 mt-1">Since {row.startDate || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
                    {row.nextBillingDate || '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-neutral-600 dark:text-neutral-300 break-all">
                    {row.razorpaySubscriptionId || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
