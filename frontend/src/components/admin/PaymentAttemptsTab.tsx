import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { AdminPaymentAttempt, AdminPaymentSyncDiagnostics } from '../../admin/adminTypes';
import { formatMoney, formatWhen } from '../../admin/adminApi';

interface PaymentAttemptsTabProps {
  attempts: AdminPaymentAttempt[];
  diagnostics: AdminPaymentSyncDiagnostics | null;
}

type AttemptFilter = 'all' | 'pending' | 'failed';

export const PaymentAttemptsTab: React.FC<PaymentAttemptsTabProps> = ({ attempts, diagnostics }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AttemptFilter>('all');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return attempts.filter((row) => {
      if (filter === 'pending' && row.status === 'failed') return false;
      if (filter === 'failed' && row.status !== 'failed') return false;
      if (!term) return true;
      return [
        row.fullName, row.email, row.phone, row.id, row.razorpayOrderId,
        row.causeTitle, row.campaignId, row.status,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [attempts, filter, query]);

  const pendingCount = attempts.filter((row) => row.status !== 'failed').length;
  const failedCount = attempts.filter((row) => row.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-neutral-900 dark:text-white">Payment attempts</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          These are checkout attempts, not confirmed donations. Only payments verified as captured appear in Donor Details and donation totals.
        </p>
      </div>

      {diagnostics && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Production database</p>
            <p className="mt-1 break-all font-mono text-xs font-bold text-neutral-900 dark:text-white">
              {diagnostics.databaseHost}/{diagnostics.databaseName}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Checked {formatWhen(diagnostics.checkedAt)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">MongoDB collection counts</p>
            <p className="mt-1 text-xs font-bold text-neutral-900 dark:text-white">
              donations: {diagnostics.donations.total} · payment_attempts: {diagnostics.paymentAttempts.total}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Attempts collection {diagnostics.paymentAttempts.collectionExists ? 'exists' : 'not yet created'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Donations statuses: {diagnostics.donations.byStatus.map((row) => `${row.status} ${row.count}`).join(' · ') || 'empty'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Attempt statuses: {diagnostics.paymentAttempts.byStatus.map((row) => `${row.status} ${row.count}`).join(' · ') || 'empty'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Latest donation timestamps: {diagnostics.donations.byStatus.filter((row) => row.newestTimestamp).map((row) => `${row.status}: ${formatWhen(row.newestTimestamp)}`).join(' · ') || 'none'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">
              Latest attempt timestamps: {diagnostics.paymentAttempts.byStatus.filter((row) => row.newestTimestamp).map((row) => `${row.status}: ${formatWhen(row.newestTimestamp)}`).join(' · ') || 'none'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['all', `All attempts (${attempts.length})`],
          ['pending', `Pending / retryable (${pendingCount})`],
          ['failed', `Failed (${failedCount})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black cursor-pointer ${filter === id
              ? 'border-[#002D62] bg-[#002D62] text-white'
              : 'border-slate-200 bg-white text-neutral-600 dark:border-slate-700 dark:bg-slate-800 dark:text-neutral-300'}`}
          >
            {label}
          </button>
        ))}
        <label className="relative ml-auto block w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search attempt, donor, order ID…"
            aria-label="Search payment attempts"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-neutral-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead className="bg-slate-100 text-neutral-600 dark:bg-slate-800 dark:text-neutral-300">
            <tr>
              <th className="px-3 py-2 font-bold">Attempt / donor</th>
              <th className="px-3 py-2 font-bold">Amount</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Campaign / portal</th>
              <th className="px-3 py-2 font-bold">Razorpay order / subscription</th>
              <th className="px-3 py-2 font-bold">Failure detail</th>
              <th className="px-3 py-2 font-bold">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                  No payment attempts match this filter.
                </td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                <td className="px-3 py-2">
                  <p className="font-black text-neutral-900 dark:text-white">{row.fullName || '—'}</p>
                  <p className="text-[10px] text-neutral-500">{row.email || '—'}</p>
                  <p className="font-mono text-[10px] text-neutral-500">{row.id}</p>
                  <p className="font-mono text-[10px] text-neutral-500">{row.phone || '—'}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-black">{formatMoney(row.amount)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${row.status === 'failed'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {row.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-bold">{row.campaignId ? `Campaign: ${row.campaignId}` : row.source || '—'}</p>
                  <p className="mt-1 max-w-[220px] text-[10px] text-neutral-500">{row.causeTitle || '—'}</p>
                </td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  <p>{row.razorpayOrderId || '—'}</p>
                  {row.razorpaySubscriptionId && <p className="mt-1">{row.razorpaySubscriptionId}</p>}
                </td>
                <td className="max-w-[220px] px-3 py-2 text-neutral-600 dark:text-neutral-300">{row.failureReason || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatWhen(row.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        Payment attempts refresh with the admin panel. A captured payment should move to Donor Details after verification/reconciliation; do not manually mark an attempt successful without checking Razorpay.
      </p>
    </div>
  );
};
