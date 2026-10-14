import React from 'react';
import { IndianRupee, Search } from 'lucide-react';
import { AdminDonation, FundRaiserRow } from '../../admin/adminTypes';
import { downloadCsv, formatMoney, formatWhen } from '../../admin/adminApi';
import { ExportCsvButton } from './ExportCsvButton';

interface StaffReportTabProps {
  fundRaisers: FundRaiserRow[];
  unassigned: FundRaiserRow | null;
  donations: AdminDonation[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

export const StaffReportTab: React.FC<StaffReportTabProps> = ({
  fundRaisers,
  unassigned,
  donations,
  searchQuery,
  onSearchQueryChange,
}) => {
  const needle = searchQuery.trim().toLowerCase();
  const filteredFundRaisers = needle
    ? fundRaisers.filter((row) => row.name.toLowerCase().includes(needle))
    : fundRaisers;
  const showUnassigned =
    Boolean(unassigned && unassigned.donationCount > 0) &&
    (!needle || 'unassigned'.includes(needle));
  const filteredDonations = needle
    ? donations.filter((row) => (row.fundRaiser || 'unassigned').toLowerCase().includes(needle))
    : donations;
  const filteredTotal = filteredDonations.reduce((sum, row) => sum + row.amount, 0);

  const exportRows = () => {
    downloadCsv(
      'punyakart-staff-report.csv',
      ['Fund raiser', 'Donor', 'Amount', 'Receipt', 'Cause', 'Date'],
      filteredDonations.map((row) => [
        row.fundRaiser || 'Unassigned',
        row.fullName,
        row.amount,
        row.receiptNumber || '',
        row.causeTitle,
        row.timestamp,
      ]),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search by fund raiser name"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
          />
        </div>
        <ExportCsvButton onClick={exportRows} disabled={filteredDonations.length === 0} />
      </div>
      {needle && (
        <p className="text-xs text-neutral-500">
          Showing {filteredDonations.length} donation{filteredDonations.length === 1 ? '' : 's'} totalling {formatMoney(filteredTotal)}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filteredFundRaisers.map((row) => (
          <button
            type="button"
            key={row.name}
            onClick={() => onSearchQueryChange(row.name)}
            className="text-left p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-[#FF6B00]"
          >
            <p className="font-black text-neutral-900 dark:text-white">{row.name}</p>
            <p className="text-xs text-neutral-500">
              {row.donationCount} donation{row.donationCount === 1 ? '' : 's'}
            </p>
            <p className="mt-1 font-display font-black text-[#FF6B00] flex items-center gap-1">
              <IndianRupee className="w-4 h-4" />
              {row.totalAmount.toLocaleString('en-IN')}
            </p>
          </button>
        ))}
        {showUnassigned && unassigned && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('Unassigned')}
            className="text-left p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer"
          >
            <p className="font-black text-neutral-700 dark:text-neutral-200">Unassigned</p>
            <p className="text-xs text-neutral-500">
              {unassigned.donationCount} donation{unassigned.donationCount === 1 ? '' : 's'} with no fund raiser
            </p>
            <p className="mt-1 font-display font-black text-neutral-500">
              {formatMoney(unassigned.totalAmount)}
            </p>
          </button>
        )}
      </div>

      {filteredFundRaisers.length === 0 && !showUnassigned && (
        <p className="text-sm text-neutral-500">
          {needle
            ? `No fund raiser matched “${searchQuery.trim()}”.`
            : 'No verified donations yet. Complete a payment with a fund raiser name to see it here.'}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
            <tr>
              <th className="px-3 py-2 font-bold">Fund raiser</th>
              <th className="px-3 py-2 font-bold">Donor</th>
              <th className="px-3 py-2 font-bold">Amount</th>
              <th className="px-3 py-2 font-bold">Receipt</th>
              <th className="px-3 py-2 font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredDonations.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-3 py-2 font-semibold">{row.fundRaiser || '—'}</td>
                <td className="px-3 py-2">{row.fullName}</td>
                <td className="px-3 py-2 font-black">{formatMoney(row.amount)}</td>
                <td className="px-3 py-2 font-mono">{row.receiptNumber || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
