import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminDonation, resolveAdminDonationSource, sourceFilterLabel } from '../../admin/adminTypes';
import { downloadCsv, formatMoney, formatWhen } from '../../admin/adminApi';
import {
  DONOR_CSV_HEADERS, TRAFFIC_SOURCE_OPTIONS, donorCsvRow, donorTrafficEvidence,
  donorTrafficSource, filterDonorRows, isEligibleDonorStatus as isEligible, trafficSourceLabel,
} from '../../admin/donorTraffic';
import type { EightyGFilter, TrafficSourceFilter } from '../../admin/donorTraffic';
import { ExportCsvButton } from './ExportCsvButton';

interface DonorDetailsTabProps {
  donations: AdminDonation[];
}

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === 'verified' || value === 'completed') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (value === 'failed') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export const DonorDetailsTab: React.FC<DonorDetailsTabProps> = ({ donations }) => {
  const [query, setQuery] = useState('');
  const [eightyGFilter, setEightyGFilter] = useState<EightyGFilter>('all');
  const [trafficSource, setTrafficSource] = useState<TrafficSourceFilter>('all');

  const filtered = useMemo(
    () => filterDonorRows(donations, { query, eightyGFilter, trafficSource }),
    [donations, query, eightyGFilter, trafficSource],
  );

  const total = filtered.reduce((sum, row) => sum + (isEligible(row.status) ? row.amount : 0), 0);
  const downloadedCount = donations.filter((row) => row.certificateDownloaded).length;
  const notDownloadedCount = donations.filter((row) => isEligible(row.status) && !row.certificateDownloaded).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {filtered.length} donor record{filtered.length === 1 ? '' : 's'}
          {query.trim() ? '' : ` · verified total ${formatMoney(total)}`}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search donor, receipt, campaign, traffic…"
              aria-label="Search donor records, campaigns and traffic sources"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <ExportCsvButton
            disabled={filtered.length === 0}
            onClick={() =>
              downloadCsv(
                'punyakart-donors.csv',
                DONOR_CSV_HEADERS,
                filtered.map(donorCsvRow),
              )
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {([
          ['all', `All (${donations.length})`],
          ['downloaded', `80G downloaded (${downloadedCount})`],
          ['not-downloaded', `80G not downloaded (${notDownloadedCount})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setEightyGFilter(id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black cursor-pointer border ${
              eightyGFilter === id
                ? 'bg-[#002D62] text-white border-[#002D62]'
                : 'bg-white dark:bg-slate-800 text-neutral-600 dark:text-neutral-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        <label className="flex items-center gap-2 sm:ml-auto text-xs font-bold text-neutral-600 dark:text-neutral-300">
          Traffic source
          <select
            value={trafficSource}
            onChange={(e) => setTrafficSource(e.target.value as TrafficSourceFilter)}
            className="max-w-[230px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-neutral-900 dark:text-white"
          >
            <option value="all">All traffic sources</option>
            {TRAFFIC_SOURCE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Campaign / portal is separate from traffic source. Older records are never retrofilled with traffic data.
        {' '}Direct / unknown can include a hidden referrer. UTM tags and other evidence are best-effort attribution, not proof of origin.
        {' '}Original signup marks inherited attribution on recurring payments, not a new visit.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left text-xs min-w-[1240px]">
          <thead className="bg-slate-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300">
            <tr>
              <th className="px-3 py-2 font-bold">Donor</th>
              <th className="px-3 py-2 font-bold">Mobile</th>
              <th className="px-3 py-2 font-bold">Email</th>
              <th className="px-3 py-2 font-bold">Amount</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Campaign / portal</th>
              <th className="px-3 py-2 font-bold">Traffic source</th>
              <th className="px-3 py-2 font-bold">Downloads</th>
              <th className="px-3 py-2 font-bold">Receipt / Txn</th>
              <th className="px-3 py-2 font-bold">PAN</th>
              <th className="px-3 py-2 font-bold">Address</th>
              <th className="px-3 py-2 font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-neutral-500">
                  No donor records match this search.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700 align-top">
                  <td className="px-3 py-2">
                    <p className="font-black text-neutral-900 dark:text-white">{row.fullName}</p>
                    <p className="text-[10px] text-neutral-500">{row.causeTitle}</p>
                    {row.fundRaiser ? (
                      <p className="text-[10px] text-[#FF6B00] font-bold">Raised by {row.fundRaiser}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono">{row.phone || '—'}</td>
                  <td className="px-3 py-2">{row.email || '—'}</td>
                  <td className="px-3 py-2 font-black whitespace-nowrap">
                    {formatMoney(row.amount)}
                    {row.autoPay ? (
                      <span className="mt-1 block text-[9px] font-black uppercase tracking-wide text-[#002D62] dark:text-blue-300">
                        Auto Pay
                      </span>
                    ) : row.type === 'monthly' ? (
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                        Monthly
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                    {resolveAdminDonationSource(row).startsWith('campaign_') ? (
                      <span className="inline-flex px-2 py-0.5 rounded border text-[10px] font-black uppercase bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                        {sourceFilterLabel(resolveAdminDonationSource(row))}
                      </span>
                    ) : (
                      sourceFilterLabel(resolveAdminDonationSource(row))
                    )}
                  </td>
                  <td className="px-3 py-2 min-w-[180px] max-w-[260px] break-words">
                    <p className="font-bold text-neutral-900 dark:text-white">
                      {trafficSourceLabel(donorTrafficSource(row))}
                    </p>
                    <span className="inline-flex mt-1 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {donorTrafficEvidence(row)}
                    </span>
                    {row.trafficAttribution?.utmSource ? (
                      <p className="mt-1 text-[10px] text-neutral-500">Tagged source: {row.trafficAttribution.utmSource}</p>
                    ) : row.trafficAttribution?.referrerHost ? (
                      <p className="mt-1 text-[10px] text-neutral-500">Referrer: {row.trafficAttribution.referrerHost}</p>
                    ) : null}
                    {row.trafficAttribution?.utmMedium ? (
                      <p className="mt-1 text-[10px] text-neutral-500">Medium: {row.trafficAttribution.utmMedium}</p>
                    ) : null}
                    {row.trafficAttribution?.utmCampaign ? (
                      <p className="text-[10px] text-neutral-500">UTM campaign: {row.trafficAttribution.utmCampaign}</p>
                    ) : null}
                    {row.trafficAttribution?.inherited ? (
                      <p className="mt-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">Original signup (not a new visit)</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div>
                        <p className="text-[10px] font-black uppercase text-neutral-500">80G</p>
                        {row.certificateDownloaded ? (
                          <>
                            <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
                              Downloaded
                            </span>
                            <p className="text-[10px] text-neutral-500 mt-0.5">{formatWhen(row.certificateDownloadedAt)}</p>
                          </>
                        ) : isEligible(row.status) ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-amber-50 text-amber-800 border-amber-200">
                            Not downloaded
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-neutral-500">Receipt</p>
                        {row.receiptDownloaded ? (
                          <>
                            <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
                              Downloaded
                            </span>
                            <p className="text-[10px] text-neutral-500 mt-0.5">{formatWhen(row.receiptDownloadedAt)}</p>
                          </>
                        ) : isEligible(row.status) ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase bg-amber-50 text-amber-800 border-amber-200">
                            Not downloaded
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-mono font-semibold">{row.receiptNumber || '—'}</p>
                    <p className="font-mono text-[10px] text-neutral-500">{row.paymentRef || row.transactionId || '—'}</p>
                  </td>
                  <td className="px-3 py-2 font-mono">{row.panNumber || '—'}</td>
                  <td className="px-3 py-2 max-w-[180px]">{row.address || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.verifiedAt || row.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
