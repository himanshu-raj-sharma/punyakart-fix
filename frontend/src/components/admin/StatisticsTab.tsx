import React, { useMemo, useState } from 'react';
import { BarChart3, FileText, IndianRupee, TrendingUp, Users } from 'lucide-react';
import { AdminDonation, CertificateLogRow } from '../../admin/adminTypes';
import { downloadCsv, formatMoney } from '../../admin/adminApi';
import { buildDonationStats, donationDate, isSuccessfulDonation, periodChangeLabel, PeriodTotals } from '../../admin/donationStats';
import { ExportCsvButton } from './ExportCsvButton';
import { canonicalCampaignId } from '../../utils/campaignRoutes';

interface StatisticsTabProps {
  donations: AdminDonation[];
  certificates: CertificateLogRow[];
  campaigns?: { id: string; title: string }[];
}

const CAMPAIGN_SOURCE_ALIASES: Record<string, string[]> = {
  c1: ['campaign_Crowd Funding Campaign'],
  c2: ['campaign_Pitru Paksha Campaign'],
  c3: ['campaign_This Tuesday, Turn Your Faith Into Seva'],
  c4: ['campaign_1,400+ Lives Depend on Your Kindness — Donate Today', 'campaign_Gau Seva Campaign'],
  c5: ['campaign_c5', 'campaign_This Thursday, Let’s Feed 1,400+ Gaumata'],
  c6: ['campaign_c6', 'campaign_Celebrate Your Special Day by Sharing Happiness'],
  c7: ['campaign_c7', 'campaign_navratri'],
};

function KpiCard({
  period,
  accent,
}: {
  period: PeriodTotals;
  accent: string;
}) {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
      <p className="text-[10px] font-black uppercase tracking-wide text-neutral-500">{period.label}</p>
      <p className={`mt-1 font-display font-black text-2xl ${accent}`}>{formatMoney(period.amount)}</p>
      <p className="text-xs text-neutral-500 mt-1">
        {period.count} donation{period.count === 1 ? '' : 's'}
      </p>
      {period.label !== 'All time' && (
        <p className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 mt-2">
          {periodChangeLabel(period)}
        </p>
      )}
    </div>
  );
}

function PeriodBars({ periods }: { periods: PeriodTotals[] }) {
  const max = Math.max(...periods.map((item) => item.amount), 1);
  return (
    <div className="grid grid-cols-4 gap-3 items-end h-44">
      {periods.map((item) => (
        <div key={item.label} className="flex flex-col items-center justify-end h-full gap-1.5">
          <span className="text-[10px] font-black text-[#FF6B00] text-center leading-tight">
            {formatMoney(item.amount)}
          </span>
          <div
            className="w-full max-w-[72px] rounded-t-xl bg-gradient-to-t from-[#E05300] to-[#FF6B00]"
            style={{ height: `${Math.max((item.amount / max) * 100, item.amount ? 6 : 0)}%` }}
          />
          <span className="text-[10px] font-bold text-neutral-500 text-center">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ points }: { points: { label: string; amount: number }[] }) {
  const width = 640;
  const height = 180;
  const padX = 12;
  const padY = 16;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const coords = points.map((point, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(points.length - 1, 1);
    const y = height - padY - (point.amount / max) * (height - padY * 2);
    return { x, y, ...point };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padX},${height - padY} ${polyline} ${width - padX},${height - padY}`;
  const ticks = coords.filter((_, index) => index % 7 === 0 || index === coords.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44" role="img" aria-label="Last 30 days donations">
      <polygon points={area} fill="rgba(255,107,0,0.12)" />
      <polyline points={polyline} fill="none" stroke="#FF6B00" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {ticks.map((tick) => (
        <text key={tick.label} x={tick.x} y={height - 2} textAnchor="middle" fontSize="10" fill="#64748b">
          {tick.label}
        </text>
      ))}
    </svg>
  );
}

function RankedBars({ items, empty }: { items: { name: string; amount: number; count: number }[]; empty: string }) {
  const max = Math.max(...items.map((item) => item.amount), 1);
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">{empty}</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between gap-2 text-xs mb-1">
            <span className="font-bold text-neutral-800 dark:text-neutral-100 truncate">{item.name}</span>
            <span className="font-black text-[#FF6B00] shrink-0">{formatMoney(item.amount)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-[#002D62]" style={{ width: `${(item.amount / max) * 100}%` }} />
          </div>
          <p className="text-[10px] text-neutral-500 mt-0.5">{item.count} donation{item.count === 1 ? '' : 's'}</p>
        </div>
      ))}
    </div>
  );
}

export const StatisticsTab: React.FC<StatisticsTabProps> = ({ donations, certificates, campaigns: campaignRecords = [] }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const campaigns = useMemo(() => {
    const options = new Map<string, string>([
      ['c1', 'Support Emergency Rescue & Relief Operations Across India'],
      ['c2', 'Let this Pitru Paksha be a time of remembrance, gratitude and compassion.'],
      ['c3', 'This Tuesday, Turn Your Faith Into Seva'],
      ['c4', '1,400+ Lives Depend on Your Kindness — Donate Today'],
      ['c5', 'This Thursday, Let’s Feed 1,400+ Gaumata'],
      ['c6', 'Celebrate Your Special Day by Sharing Happiness'],
    ]);
    campaignRecords.forEach((campaign) => {
      const id = canonicalCampaignId(campaign.id);
      if (options.has(id)) options.set(id, campaign.title);
    });
    donations.forEach((row) => {
      const id = canonicalCampaignId(row.campaignId || (row.source?.startsWith('campaign_') ? row.source.slice(9) : ''));
      if (id && !options.has(id)) options.set(id, id);
    });
    return [...options.entries()].map(([id, title]) => ({ id, title }));
  }, [campaignRecords, donations]);
  const visibleDonations = useMemo(() => donations.filter((row) => {
    const date = donationDate(row);
    if (fromDate && (!date || date < new Date(`${fromDate}T00:00:00`))) return false;
    if (toDate && (!date || date >= new Date(`${toDate}T23:59:59.999`))) return false;
    if (
      campaignFilter !== 'all' &&
      canonicalCampaignId(row.campaignId || '') !== campaignFilter &&
      row.source !== `campaign_${campaignFilter}` &&
      !CAMPAIGN_SOURCE_ALIASES[campaignFilter]?.includes(row.source)
    ) return false;
    return true;
  }), [campaignFilter, donations, fromDate, toDate]);
  const stats = useMemo(() => buildDonationStats(visibleDonations, certificates), [visibleDonations, certificates]);
  const campaignCards = useMemo(() => {
    const grouped = new Map<string, { name: string; amount: number; count: number }>();
    for (const row of visibleDonations) {
      if (!row.source?.startsWith('campaign_') && !row.campaignId) continue;
      const id = canonicalCampaignId(row.campaignId || (row.source?.startsWith('campaign_') ? row.source.slice(9) : ''));
      const name = campaigns.find((item) => item.id === id)?.title || id || 'Unnamed campaign';
      const current = grouped.get(id || name) || { name, amount: 0, count: 0 };
      if (isSuccessfulDonation(row.status)) current.amount += row.amount;
      current.count += 1;
      grouped.set(id || name, current);
    }
    return campaigns.map((campaign) => grouped.get(campaign.id) || { name: campaign.title, amount: 0, count: 0 });
  }, [campaigns, visibleDonations]);
  const periods = [stats.today, stats.week, stats.month, stats.allTime];

  const exportStats = () => {
    downloadCsv(
      `punyakart-donations-${fromDate || 'all'}-${toDate || 'all'}.csv`,
      ['Donation ID', 'Date', 'Name', 'Email', 'Phone', 'City', 'Amount (INR)', 'Status', 'Campaign', 'Cause'],
      [
        ...visibleDonations.map((row) => [
          row.id, row.verifiedAt || row.timestamp, row.fullName, row.email, row.phone,
          (row.address || '').split(',').map((part) => part.trim()).filter(Boolean).at(-1) || 'Unknown',
          row.amount, row.status, row.source?.startsWith('campaign_') ? row.source.slice(9) : '', row.causeTitle,
        ]),
      ],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-black text-lg text-neutral-900 dark:text-white">Donation statistics</h2>
          <p className="text-xs text-neutral-500">Verified and completed gifts only. Failed checkouts are shown separately.</p>
        </div>
        <ExportCsvButton onClick={exportStats} />
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
        <label className="text-xs font-bold text-neutral-600">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="block mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
        <label className="text-xs font-bold text-neutral-600">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="block mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>
        <label className="text-xs font-bold text-neutral-600">Campaign<select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="block mt-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"><option value="all">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label>
        <span className="text-xs text-neutral-500">{visibleDonations.length} records selected</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
        {campaignCards.length ? campaignCards.map((campaign) => (
          <button
            key={campaign.name}
            type="button"
            onClick={() => setCampaignFilter(campaigns.find((item) => item.title === campaign.name)?.id || 'all')}
            className={`min-w-[190px] snap-start text-left p-3 rounded-2xl border ${campaignFilter === (campaigns.find((item) => item.title === campaign.name)?.id || '') ? 'border-[#FF6000] bg-orange-50' : 'border-slate-200 dark:border-slate-700'} cursor-pointer`}
          >
            <p className="text-xs font-black truncate">{campaign.name}</p>
            <p className="mt-1 text-lg font-black text-[#FF6000]">{formatMoney(campaign.amount)}</p>
            <p className="text-[11px] text-neutral-500">{campaign.count} donation records</p>
          </button>
        )) : <p className="text-sm text-neutral-500">Campaign donations will appear here separately.</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard period={stats.today} accent="text-[#FF6B00]" />
        <KpiCard period={stats.week} accent="text-[#002D62] dark:text-blue-300" />
        <KpiCard period={stats.month} accent="text-emerald-600" />
        <KpiCard period={stats.allTime} accent="text-neutral-900 dark:text-white" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1">
            <IndianRupee className="w-3 h-3" /> Avg ticket
          </p>
          <p className="font-display font-black text-lg">{formatMoney(stats.averageTicket)}</p>
        </div>
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1">
            <Users className="w-3 h-3" /> Unique donors
          </p>
          <p className="font-display font-black text-lg">{stats.uniqueDonors}</p>
        </div>
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Success rate
          </p>
          <p className="font-display font-black text-lg">{stats.successRate}%</p>
          <p className="text-[10px] text-neutral-500">{stats.failedCount} failed · {stats.pendingCount} pending</p>
        </div>
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1">
            <FileText className="w-3 h-3" /> 80G downloads
          </p>
          <p className="font-display font-black text-lg">{stats.eightyG.allTime}</p>
          <p className="text-[10px] text-neutral-500">
            Today {stats.eightyG.today} · Week {stats.eightyG.week} · Month {stats.eightyG.month}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Period totals
          </p>
          <PeriodBars periods={periods} />
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500 mb-3">Last 30 days</p>
          <TrendChart points={stats.daily} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500 mb-3">Top causes</p>
          <RankedBars items={stats.causes} empty="No verified donations yet." />
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500 mb-3">Top fund raisers</p>
          <RankedBars items={stats.fundRaisers} empty="No fund-raiser names recorded yet." />
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-black uppercase tracking-wide text-neutral-500 mb-3">Top donor cities</p>
          <RankedBars items={stats.cities} empty="No city data recorded yet." />
        </div>
      </div>
    </div>
  );
};
