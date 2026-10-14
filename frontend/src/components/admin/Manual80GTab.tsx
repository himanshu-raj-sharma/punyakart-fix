import React, { useState } from 'react';
import { AlertCircle, Download, FilePlus2, Receipt, Search } from 'lucide-react';
import { AdminDonation } from '../../admin/adminTypes';
import {
  downloadAdminDonationReceiptPdf,
  downloadAdminPdf,
  fetchAdminJson,
  formatMoney,
} from '../../admin/adminApi';

interface Manual80GTabProps {
  adminKey: string;
  onIssued: () => void;
}

function isVerified(status: string): boolean {
  const value = status.toLowerCase();
  return value === 'verified' || value === 'completed';
}

function canIssue(status: string): boolean {
  const value = status.toLowerCase();
  return value === 'initiated' || value === 'pending_verification';
}

export const Manual80GTab: React.FC<Manual80GTabProps> = ({ adminKey, onIssued }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminDonation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setErrorMsg('Enter a receipt number (PKF-), donor name, mobile, or transaction ID.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await fetchAdminJson<{ donations: AdminDonation[] }>(
        `/api/admin/donations/search?q=${encodeURIComponent(q)}`,
        adminKey,
      );
      setResults(data.donations || []);
    } catch (err) {
      setResults(null);
      setErrorMsg(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload80G = async (row: AdminDonation) => {
    setBusyId(row.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await downloadAdminPdf(
        `/api/admin/donations/${encodeURIComponent(row.id)}/certificate.pdf`,
        adminKey,
        `${row.receiptNumber || row.id}-80G.pdf`,
      );
      setSuccessMsg(`Downloaded 80G certificate for ${row.fullName}.`);
      onIssued();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '80G download failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadReceipt = async (row: AdminDonation) => {
    setBusyId(row.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await downloadAdminDonationReceiptPdf(
        row.id,
        adminKey,
        `${row.receiptNumber || row.id}-receipt.pdf`,
      );
      setSuccessMsg(`Downloaded donation receipt for ${row.fullName}.`);
      onIssued();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Donation receipt download failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleIssue = async (row: AdminDonation) => {
    setBusyId(row.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await downloadAdminPdf(
        `/api/admin/donations/${encodeURIComponent(row.id)}/issue-certificate`,
        adminKey,
        `${row.receiptNumber || row.id}-80G.pdf`,
        { method: 'POST' },
      );
      setSuccessMsg(`Created and downloaded 80G for ${row.fullName}.`);
      onIssued();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not create 80G.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-neutral-500">
        Search an existing donation to download the <strong>80G tax certificate</strong> or the branded{' '}
        <strong>donation receipt</strong>. To create a new offline receipt, use the <strong>Manual Receipt</strong> tab.
      </p>

      <form onSubmit={runSearch} className="space-y-2">
        <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
          Search by receipt number, name, mobile, or transaction ID
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. PKF-2025-26-000001, Anand Kumar, 9876543210"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
          {successMsg}
        </div>
      )}

      {results && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
              <tr>
                <th className="px-3 py-2 font-bold">Donor</th>
                <th className="px-3 py-2 font-bold">Mobile</th>
                <th className="px-3 py-2 font-bold">Amount</th>
                <th className="px-3 py-2 font-bold">Txn / Receipt</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No donor matched that search. Use the Manual Receipt tab to create a new offline receipt.
                  </td>
                </tr>
              ) : (
                results.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">
                      <p className="font-black">{row.fullName}</p>
                      <p className="text-[10px] text-neutral-500">{row.email}</p>
                    </td>
                    <td className="px-3 py-2 font-mono">{row.phone}</td>
                    <td className="px-3 py-2 font-black">{formatMoney(row.amount)}</td>
                    <td className="px-3 py-2">
                      <p className="font-mono">{row.transactionId || row.paymentRef || '—'}</p>
                      <p className="font-mono text-[10px] text-neutral-500">{row.receiptNumber || '—'}</p>
                    </td>
                    <td className="px-3 py-2 font-bold uppercase text-[10px]">{row.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {isVerified(row.status) ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void handleDownload80G(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#002D62] text-white font-bold cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-3.5 h-3.5" />
                              80G
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void handleDownloadReceipt(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FF6B00] text-white font-bold cursor-pointer disabled:opacity-50"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              Receipt
                            </button>
                          </>
                        ) : canIssue(row.status) ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void handleIssue(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FF6B00] text-white font-bold cursor-pointer disabled:opacity-50"
                          >
                            <FilePlus2 className="w-3.5 h-3.5" />
                            Create 80G
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 uppercase">Cannot issue</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
