import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CertificateLogRow } from '../../admin/adminTypes';
import { downloadCsv, formatMoney, formatWhen } from '../../admin/adminApi';
import { ExportCsvButton } from './ExportCsvButton';

interface CertificateLogTabProps {
  certificates: CertificateLogRow[];
}

const SOURCE_LABEL: Record<CertificateLogRow['source'], string> = {
  public: 'Public download',
  email: 'Email sent',
  'admin-download': 'Admin download',
  'admin-create': 'Admin created',
  'admin-issue': 'Admin issued',
  issued: 'Receipt issued',
  'receipt-public': 'Receipt public download',
  'receipt-admin-download': 'Receipt admin download',
  'receipt-admin-create': 'Receipt admin created',
};

export const CertificateLogTab: React.FC<CertificateLogTabProps> = ({ certificates }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return certificates;
    const compactNeedle = needle.replace(/[^a-z0-9]/g, '');
    return certificates.filter((row) => {
      const haystack = [
        row.fullName,
        row.email,
        row.phone,
        row.receiptNumber,
        row.transactionId,
        row.panNumber,
        SOURCE_LABEL[row.source],
      ]
        .join(' ')
        .toLowerCase();
      if (haystack.includes(needle)) return true;
      if (compactNeedle.length >= 6) {
        const compactHay = haystack.replace(/[^a-z0-9]/g, '');
        return compactHay.includes(compactNeedle);
      }
      return false;
    });
  }, [certificates, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {filtered.length} 80G receipt{filtered.length === 1 ? '' : 's'} (issued / downloaded)
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search donor, mobile, receipt…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <ExportCsvButton
            disabled={filtered.length === 0}
            onClick={() =>
              downloadCsv(
                'punyakart-80g-certificates.csv',
                ['Donor', 'Email', 'Phone', 'Amount', 'Receipt', 'Transaction ID', 'Source', 'Downloaded at'],
                filtered.map((row) => [
                  row.fullName,
                  row.email,
                  row.phone,
                  row.amount,
                  row.receiptNumber,
                  row.transactionId || '',
                  SOURCE_LABEL[row.source],
                  row.downloadedAt,
                ]),
              )
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs min-w-[860px]">
          <thead className="bg-slate-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
            <tr>
              <th className="px-3 py-2 font-bold">Donor</th>
              <th className="px-3 py-2 font-bold">Mobile</th>
              <th className="px-3 py-2 font-bold">Amount</th>
              <th className="px-3 py-2 font-bold">Receipt / Txn</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  No verified 80G receipts yet. Completed donations with a receipt number will appear here.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2">
                    <p className="font-black text-neutral-900 dark:text-white">{row.fullName}</p>
                    <p className="text-[10px] text-neutral-500">{row.email}</p>
                  </td>
                  <td className="px-3 py-2 font-mono">{row.phone}</td>
                  <td className="px-3 py-2 font-black">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-2">
                    <p className="font-mono font-semibold">{row.receiptNumber || '—'}</p>
                    <p className="font-mono text-[10px] text-neutral-500">{row.transactionId || '—'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-neutral-700">
                      {SOURCE_LABEL[row.source]}
                    </span>
                    {(row.downloadCount || 0) > 0 ? (
                      <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Downloaded</p>
                    ) : (
                      <p className="text-[10px] text-amber-600 font-bold mt-0.5">Not downloaded yet</p>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p>{formatWhen(row.downloadedAt)}</p>
                    {row.downloadCount && row.downloadCount > 1 ? (
                      <p className="text-[10px] text-neutral-500">{row.downloadCount} times</p>
                    ) : null}
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
