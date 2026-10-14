import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BarChart3, BookOpen, Check, ChevronDown, FileText, Lock, LogOut, Megaphone, Receipt, Repeat, Shield, Users, Wallet } from 'lucide-react';
import { PunyakartLogo } from '../components/PunyakartLogo';
import { StatisticsTab } from '../components/admin/StatisticsTab';
import { StaffReportTab } from '../components/admin/StaffReportTab';
import { DonorDetailsTab } from '../components/admin/DonorDetailsTab';
import { CertificateLogTab } from '../components/admin/CertificateLogTab';
import { Manual80GTab } from '../components/admin/Manual80GTab';
import { ManualReceiptTab } from '../components/admin/ManualReceiptTab';
import { AutoPayTab } from '../components/admin/AutoPayTab';
import {
  ADMIN_IDLE_MS,
  ADMIN_LIVE_REFRESH_MS,
  AdminDonation,
  AdminSubscription,
  AdminTab,
  CertificateLogRow,
  DONATION_SOURCE_FILTERS,
  DonationSourceFilter,
  FundRaiserRow,
  resolveAdminDonationSource,
  AdminBlog,
} from '../admin/adminTypes';
import {
  AdminRequestError,
  clearAdminKey,
  fetchAdminJson,
  formatCountdown,
  persistAdminKey,
  storedAdminKey,
} from '../admin/adminApi';
import { AdminCampaign } from '../admin/adminTypes';
import { CampaignsTab } from '../components/admin/CampaignsTab';
import { BlogTab } from '../components/admin/BlogTab';
import { createAdminRequestAuthority } from '../admin/adminCmsSync';

interface AdminPageProps {
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLeave: () => void;
}

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'statistics', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'staff', label: 'Staff report', icon: <Users className="w-4 h-4" /> },
  { id: 'donors', label: 'Donor details', icon: <Wallet className="w-4 h-4" /> },
  { id: 'autopay', label: 'Auto Pay', icon: <Repeat className="w-4 h-4" /> },
  { id: 'campaigns', label: 'CMS · Campaigns', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'blogs', label: 'CMS · Blog editor', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'certificates', label: '80G certificates', icon: <FileText className="w-4 h-4" /> },
  { id: 'receipt', label: 'Manual Receipt', icon: <Receipt className="w-4 h-4" /> },
  { id: 'manual', label: 'Manual 80G', icon: <Shield className="w-4 h-4" /> },
];

const BUILT_IN_CAMPAIGNS = [
  { id: 'c1', title: 'Support Emergency Rescue & Relief Operations Across India' },
  { id: 'c2', title: 'Let this Pitr Paksha be a time of remembrance, gratitude and compassion.' },
  { id: 'c3', title: 'This Tuesday, Turn Your Faith Into Seva' },
  { id: 'c4', title: '1,400+ Lives Depend on Your Kindness — Donate Today' },
  { id: 'c5', title: 'This Thursday, Let’s Feed 1,400+ Gaumata' },
  { id: 'c6', title: 'Celebrate Your Special Day by Sharing Happiness' },
];

const BUILT_IN_CAMPAIGN_SOURCE_ALIASES: Record<string, string[]> = {
  c1: ['campaign_Crowd Funding Campaign'],
  c2: ['campaign_Pitru Paksha Campaign'],
  c3: ['campaign_This Tuesday, Turn Your Faith Into Seva'],
  c4: ['campaign_1,400+ Lives Depend on Your Kindness — Donate Today', 'campaign_Gau Seva Campaign'],
  c5: ['campaign_c5', 'campaign_This Thursday, Let’s Feed 1,400+ Gaumata'],
  c6: ['campaign_c6', 'campaign_Celebrate Your Special Day by Sharing Happiness'],
};

export const AdminPage: React.FC<AdminPageProps> = ({ tab, onTabChange, onLeave }) => {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [live, setLive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ADMIN_IDLE_MS / 1000);
  const [fundRaisers, setFundRaisers] = useState<FundRaiserRow[]>([]);
  const [unassigned, setUnassigned] = useState<FundRaiserRow | null>(null);
  const [eligibleDonations, setEligibleDonations] = useState<AdminDonation[]>([]);
  const [allDonations, setAllDonations] = useState<AdminDonation[]>([]);
  const [certificates, setCertificates] = useState<CertificateLogRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [blogs, setBlogs] = useState<AdminBlog[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<DonationSourceFilter>('all');
  const [campaignSourceFilter, setCampaignSourceFilter] = useState('all');
  const [campaignMenuOpen, setCampaignMenuOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const requestAuthority = useRef(createAdminRequestAuthority());

  const campaignSourceOptions = useMemo(() => {
    const options = new Map<string, string>();
    BUILT_IN_CAMPAIGNS.forEach((campaign) => options.set(campaign.id, campaign.title));
    campaigns.forEach((campaign) => options.set(campaign.id, campaign.title));
    allDonations.forEach((row) => {
      const source = resolveAdminDonationSource(row);
      if (source.startsWith('campaign_')) {
        const id = source.slice(9);
        if (id && !options.has(id)) options.set(id, id);
      }
    });
    return [...options.entries()].map(([id, title]) => ({ id, title }));
  }, [allDonations, campaigns]);

  const filterBySource = useCallback(
    (rows: AdminDonation[]) => {
      if (sourceFilter === 'all') return rows;
      if (sourceFilter === 'crowd_funding') {
        return rows.filter((row) => {
          const source = resolveAdminDonationSource(row);
          if (campaignSourceFilter !== 'all') {
            return (
              row.campaignId === campaignSourceFilter ||
              source === `campaign_${campaignSourceFilter}` ||
              BUILT_IN_CAMPAIGN_SOURCE_ALIASES[campaignSourceFilter]?.includes(source)
            );
          }
          return source === 'crowd_funding' || source.startsWith('campaign_');
        });
      }
      return rows.filter((row) => resolveAdminDonationSource(row) === sourceFilter);
    },
    [campaignSourceFilter, sourceFilter],
  );

  const filteredAllDonations = filterBySource(allDonations);
  const filteredEligibleDonations = filterBySource(eligibleDonations);

  const lockSession = useCallback((message: string) => {
    requestAuthority.current.deactivate();
    clearAdminKey();
    setLoading(false);
    setUnlocked(false);
    setLive(false);
    setFundRaisers([]);
    setUnassigned(null);
    setEligibleDonations([]);
    setAllDonations([]);
    setCertificates([]);
    setSubscriptions([]);
    setCampaigns([]);
    setBlogs([]);
    setStaffSearch('');
    setAdminKey('');
    setErrorMsg(message);
  }, []);

  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(Math.ceil(ADMIN_IDLE_MS / 1000));
  }, []);

  const loadPanel = useCallback(async (key: string, silent = false) => {
    const trimmed = key.trim();
    if (!trimmed) {
      setErrorMsg('Enter the admin API key from your .env file (ADMIN_API_KEY).');
      return;
    }
    const request = requestAuthority.current.begin();
    if (!request) return;
    const init = { signal: request.signal };
    setLoading(!silent);
    if (!silent) {
      setLoading(true);
      setErrorMsg(null);
    }
    try {
      const [summary, eligible, all, certs, subs, campaignResult, blogResult] = await Promise.all([
        fetchAdminJson<{ fundRaisers: FundRaiserRow[]; unassigned: FundRaiserRow }>(
          '/api/admin/fundraisers',
          trimmed,
          init,
        ),
        fetchAdminJson<{ donations: AdminDonation[] }>('/api/admin/donations?eligible=1', trimmed, init),
        fetchAdminJson<{ donations: AdminDonation[] }>('/api/admin/donations', trimmed, init),
        fetchAdminJson<{ certificates: CertificateLogRow[] }>('/api/admin/certificates', trimmed, init),
        fetchAdminJson<{ subscriptions: AdminSubscription[] }>('/api/subscriptions', trimmed, init),
        fetchAdminJson<{ campaigns: AdminCampaign[] }>('/api/admin/campaigns', trimmed, init),
        fetchAdminJson<{ blogs: AdminBlog[] }>('/api/admin/blogs', trimmed, init),
      ]);
      if (!request.isCurrent()) return;
      if (silent && Date.now() - lastActivityRef.current >= ADMIN_IDLE_MS) {
        lockSession('Session timed out after 5 minutes of inactivity. Enter the admin key again.');
        return;
      }
      if (![summary?.fundRaisers, eligible?.donations, all?.donations, certs?.certificates,
        subs?.subscriptions, campaignResult?.campaigns, blogResult?.blogs].every(Array.isArray)) {
        throw new Error('The admin API returned incomplete data. Please refresh again.');
      }
      persistAdminKey(trimmed);
      setFundRaisers(summary.fundRaisers || []);
      setUnassigned(summary.unassigned || null);
      setEligibleDonations(eligible.donations || []);
      setAllDonations(all.donations || []);
      setCertificates(certs.certificates || []);
      setSubscriptions(subs.subscriptions || []);
      setCampaigns(campaignResult.campaigns || []);
      setBlogs(blogResult.blogs || []);
      setUnlocked(true);
      setLive(true);
      setErrorMsg(null);
      if (!silent) {
        lastActivityRef.current = Date.now();
        setSecondsLeft(Math.ceil(ADMIN_IDLE_MS / 1000));
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      if (err instanceof AdminRequestError && (err.status === 401 || err.status === 403)) {
        lockSession('Admin access expired or was rejected. Enter the admin key again.');
        return;
      }
      if (silent) {
        setLive(false);
        return;
      }
      setUnlocked(false);
      setLive(false);
      setErrorMsg(err instanceof Error ? err.message : 'Could not load the admin panel.');
    } finally {
      if (request.isCurrent()) setLoading(false);
      request.finish();
    }
  }, [lockSession]);

  useEffect(() => {
    requestAuthority.current.activate();
    const saved = storedAdminKey();
    setAdminKey(saved);
    if (saved) void loadPanel(saved);
    return () => requestAuthority.current.deactivate();
  }, [loadPanel]);

  useEffect(() => {
    if (!unlocked) return;
    lastActivityRef.current = Date.now();
    const tick = window.setInterval(() => {
      const remaining = ADMIN_IDLE_MS - (Date.now() - lastActivityRef.current);
      if (remaining <= 0) {
        lockSession('Session timed out after 5 minutes of inactivity. Enter the admin key again.');
        return;
      }
      setSecondsLeft(Math.ceil(remaining / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [unlocked, lockSession]);

  useEffect(() => {
    if (!unlocked) return;
    const refresh = window.setInterval(() => {
      const key = storedAdminKey();
      if (key) void loadPanel(key, true);
    }, ADMIN_LIVE_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [unlocked, loadPanel]);

  useEffect(() => {
    if (!unlocked) return;
    if (tab !== 'donors' && tab !== 'certificates' && tab !== 'autopay') return;
    const key = storedAdminKey();
    if (key) void loadPanel(key, true);
  }, [tab, unlocked, loadPanel]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    requestAuthority.current.activate();
    void loadPanel(adminKey);
  };

  return (
    <div
      className="admin-mobile-layout min-h-screen min-w-0 bg-[#F4F7FA] dark:bg-[#070D18] text-neutral-900 dark:text-neutral-50"
      onMouseMove={bumpActivity}
      onKeyDown={bumpActivity}
    >
      <header className="bg-[#002D62] text-white border-b border-blue-900">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white/10 p-1.5 rounded-xl border border-white/10">
              <span className="sm:hidden"><PunyakartLogo size="sm" variant="icon-only" showTagline={false} theme="dark" /></span>
              <span className="hidden sm:block"><PunyakartLogo size="sm" showTagline={false} theme="dark" /></span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                {unlocked && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-300 animate-pulse' : 'bg-amber-300'}`} />
                )}
                {unlocked ? (live ? 'Live admin' : 'Reconnecting…') : 'Staff access'}
              </span>
              <h1 className="font-display font-black text-lg sm:text-xl tracking-tight mt-0.5">Admin panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unlocked && (
              <>
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wide text-blue-100/80">
                  Locks in {formatCountdown(secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={() => lockSession('You have been logged out.')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => { requestAuthority.current.deactivate(); onLeave(); }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer"
            >
              Back to site
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl min-w-0 mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5">
        <form onSubmit={handleUnlock} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin API key"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Loading…' : unlocked ? 'Refresh' : 'Unlock panel'}
          </button>
        </form>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {unlocked && (
          <>
            <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black cursor-pointer ${
                    tab === item.id
                      ? 'bg-[#002D62] text-white'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {(tab === 'statistics' || tab === 'donors' || tab === 'staff') && (
              <div className="flex flex-wrap gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5">
                {DONATION_SOURCE_FILTERS.map((item) => {
                  const isCrowdFunding = item.id === 'crowd_funding';
                  const isSelectedCampaign = isCrowdFunding && campaignSourceFilter !== 'all';
                  return (
                    <div key={item.id} className="relative min-w-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSourceFilter(item.id);
                          if (!isCrowdFunding) setCampaignSourceFilter('all');
                          if (isCrowdFunding) setCampaignMenuOpen((open) => !open);
                        }}
                        className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black cursor-pointer ${
                          sourceFilter === item.id
                            ? 'bg-[#FF6B00] text-white'
                            : 'text-neutral-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        aria-haspopup={isCrowdFunding ? 'menu' : undefined}
                        aria-expanded={isCrowdFunding ? campaignMenuOpen : undefined}
                      >
                        {isSelectedCampaign
                          ? campaignSourceOptions.find((option) => option.id === campaignSourceFilter)?.title || item.label
                          : item.label}
                        {isCrowdFunding && <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
                      </button>
                      {isCrowdFunding && campaignMenuOpen && (
                        <div className="absolute left-0 top-full z-20 mt-2 w-full sm:w-80 max-w-[calc(100vw-3rem)] max-h-[50dvh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900" role="menu">
                          <button
                            type="button"
                            onClick={() => { setCampaignSourceFilter('all'); setCampaignMenuOpen(false); }}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[#7c2d12] hover:bg-orange-50 dark:text-orange-100 dark:hover:bg-slate-800"
                            role="menuitem"
                          >
                            <span>All campaign donations</span>
                            {campaignSourceFilter === 'all' && <Check className="h-3.5 w-3.5 text-[#FF6B00]" />}
                          </button>
                          {campaignSourceOptions.map((campaign) => (
                            <button
                              key={campaign.id}
                              type="button"
                              onClick={() => { setCampaignSourceFilter(campaign.id); setCampaignMenuOpen(false); }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-[#7c2d12] hover:bg-orange-50 dark:text-orange-100 dark:hover:bg-slate-800"
                              role="menuitem"
                            >
                              <span className="truncate">{campaign.title}</span>
                              {campaignSourceFilter === campaign.id && <Check className="h-3.5 w-3.5 shrink-0 text-[#FF6B00]" />}
                            </button>
                          ))}
                          {campaignSourceOptions.length === 0 && (
                            <p className="px-3 py-2.5 text-xs text-neutral-500">No campaign donations found.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6">
              {tab === 'statistics' && (
                <StatisticsTab donations={filteredAllDonations} certificates={certificates} campaigns={campaignSourceOptions} />
              )}
              {tab === 'staff' && (
                <StaffReportTab
                  fundRaisers={fundRaisers}
                  unassigned={unassigned}
                  donations={filteredEligibleDonations}
                  searchQuery={staffSearch}
                  onSearchQueryChange={setStaffSearch}
                />
              )}
              {tab === 'donors' && <DonorDetailsTab donations={filteredAllDonations} />}
              {tab === 'autopay' && <AutoPayTab subscriptions={subscriptions} />}
              {tab === 'certificates' && <CertificateLogTab certificates={certificates} />}
              {tab === 'receipt' && (
                <ManualReceiptTab
                  adminKey={storedAdminKey() || adminKey}
                  onCreated={() => void loadPanel(storedAdminKey() || adminKey, true)}
                />
              )}
              {tab === 'manual' && (
                <Manual80GTab adminKey={storedAdminKey() || adminKey} onIssued={() => void loadPanel(storedAdminKey() || adminKey, true)} />
              )}
              {tab === 'campaigns' && (
                <CampaignsTab
                  adminKey={storedAdminKey() || adminKey}
                  campaigns={campaigns}
                  onChanged={() => void loadPanel(storedAdminKey() || adminKey, true)}
                />
              )}
              {tab === 'blogs' && (
                <BlogTab adminKey={storedAdminKey() || adminKey} blogs={blogs} onChanged={() => void loadPanel(storedAdminKey() || adminKey, true)} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};
