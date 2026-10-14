import React from 'react';
import { Heart, ShieldCheck, Users } from 'lucide-react';
import { navigate } from '../navigation';
import type { Language } from '../types';
import { resolveCampaignImage } from '../components/campaign/campaignImages';
import { WhereYourMoneyGoes } from '../components/campaign/WhereYourMoneyGoes';

import { usePublicCampaign } from '../hooks/usePublicCampaign';
import { campaignAvailabilityMessage, campaignDonationAvailable } from '../utils/publicCampaignPolling';
import { isValidDonationAmount } from '../constants/donation';

interface CampaignDetailPageProps {
  campaignId: string;
  language: Language;
  onOpenCheckout: (amount: number, causeTitle: string) => void;
}

export const CampaignDetailPage: React.FC<CampaignDetailPageProps> = ({
  campaignId,
  onOpenCheckout,
}) => {
  const { campaign, status } = usePublicCampaign(campaignId);
  if (status === 'loading' && !campaign) {
    return <div className="public-page min-h-[60vh] flex items-center justify-center text-sm font-semibold text-slate-500">Loading campaign…</div>;
  }

  if (!campaign || campaign.id !== campaignId) {
    return (
      <div className="public-page min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-bold text-slate-700">{status === 'error' ? 'Campaign unavailable. Please try again shortly.' : 'Campaign not found.'}</p>
        <button type="button" onClick={() => navigate('/campaigns')} className="px-4 py-2 rounded-xl bg-[#002D62] text-white text-sm font-bold">Back to campaigns</button>
      </div>
    );
  }

  const target = typeof campaign.target === 'number' && Number.isFinite(campaign.target) && campaign.target >= 0 ? campaign.target : null;
  const raised = typeof campaign.raised === 'number' && Number.isFinite(campaign.raised) && campaign.raised >= 0 ? campaign.raised : null;
  const donors = typeof campaign.donors === 'number' && Number.isSafeInteger(campaign.donors) && campaign.donors >= 0 ? campaign.donors : null;
  const progress = target !== null && target > 0 && raised !== null ? Math.min(100, Math.round((raised / target) * 100)) : null;
  const canDonate = campaignDonationAvailable(status, campaign) && Boolean(campaign.title?.trim());
  const openCheckout = (amount: number) => {
    if (!canDonate || campaign.id !== campaignId
      || !isValidDonationAmount(amount)) return;
    onOpenCheckout(amount, campaign.title!);
  };

  return (
    <div className="public-page min-h-screen">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-7">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4 sm:gap-6 items-start">
          <div className="public-card min-w-0 break-words rounded-3xl overflow-hidden border shadow-sm">
            <img src={resolveCampaignImage(campaign.id, campaign.image)} alt={campaign.title} className="w-full aspect-[16/9] object-cover" />
            <div className="p-5 sm:p-7">
              <span className="inline-flex px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-wide">{campaign.category}</span>
              <h1 className="mt-3 text-2xl sm:text-4xl font-black leading-tight text-slate-900">{campaign.content?.hero_title || campaign.title}</h1>
              <p className="mt-2 text-sm text-slate-500">Organized by <span className="font-bold text-[#002D62]">{campaign.organizer}</span></p>
              <p className="mt-5 text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line">{campaign.content?.hero_subtitle || campaign.description || 'Your support helps this campaign deliver meaningful care and relief.'}</p>
            </div>
          </div>
          <aside className="public-card min-w-0 break-words rounded-3xl border shadow-sm p-5 sm:p-7 lg:sticky lg:top-[calc(var(--site-header-height,0px)+1.25rem)]">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between text-sm font-black text-slate-700">
              <span>{raised === null ? '—' : formatMoney(raised)} raised</span>
              {progress !== null && <span className="text-[#FF6000]">{progress}%</span>}
            </div>
            {progress !== null && <div className="mt-2 h-3 rounded-full public-muted-surface overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#FF6000] to-[#FF8C38]" style={{ width: `${progress}%` }} />
            </div>}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-2xl public-muted-surface p-3"><p className="text-[10px] uppercase font-black text-slate-400">Goal</p><p className="mt-1 font-black text-slate-900">{target === null ? '—' : target === 0 ? 'No fixed goal' : formatMoney(target)}</p></div>
              <div className="rounded-2xl public-muted-surface p-3"><p className="text-[10px] uppercase font-black text-slate-400">Donors</p><p className="mt-1 font-black text-slate-900 flex items-center gap-1"><Users className="w-4 h-4" /> {donors ?? '—'}</p></div>
            </div>
            {!canDonate && <p role="status" className="mt-4 text-sm font-semibold text-amber-800">{campaignDonationAvailable(status, campaign) ? 'Campaign details are incomplete. Donations are temporarily unavailable.' : campaignAvailabilityMessage(status)}</p>}
            <button type="button" disabled={!canDonate} onClick={() => openCheckout(1000)} className="w-full mt-5 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black inline-flex items-center justify-center gap-2">
              <Heart className="w-4 h-4 fill-current" /> Donate to this campaign
            </button>
            {campaign.has_tax_benefit && <p className="mt-3 text-center text-xs font-semibold text-emerald-700 inline-flex items-center justify-center gap-1 w-full"><ShieldCheck className="w-4 h-4" /> 80G tax benefit available</p>}
          </aside>
        </div>
        {campaign.content?.about_title && (
          <section className="public-card mt-4 rounded-3xl border shadow-sm p-5 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-black text-[#002D62]">{campaign.content.about_title}</h2>
            {campaign.content.about_banner_description && <p className="mt-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{campaign.content.about_banner_description}</p>}
            {campaign.content.about_cards?.length ? <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">{campaign.content.about_cards.map((card) => <article key={card.id} className="public-card rounded-2xl overflow-hidden border"><img src={card.image} alt={`${card.line1} ${card.line2}`} className="w-full aspect-[4/3] object-cover" loading="lazy" /><div className="p-3 text-sm font-bold text-[#002D62]">{card.line1} {card.line2} {card.line3}</div></article>)}</div> : null}
          </section>
        )}
        {campaign.content?.recovery_stories?.length ? (
          <section className="public-card mt-4 rounded-3xl border shadow-sm p-5 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-black text-[#002D62]">{campaign.content.recovery_title || 'Real stories. Real healing.'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">{campaign.content.recovery_stories.map((story) => <article key={story.id} className="rounded-2xl border border-slate-200 overflow-hidden"><div className="grid grid-cols-2"><img src={story.beforeImg} alt={`${story.title} before`} className="aspect-[4/3] w-full object-cover" loading="lazy" /><img src={story.afterImg} alt={`${story.title} after`} className="aspect-[4/3] w-full object-cover" loading="lazy" /></div><div className="p-3"><h3 className="font-black text-[#002D62]">{story.title}</h3><p className="mt-1 text-xs text-slate-600">{story.description}</p></div></article>)}</div>
          </section>
        ) : null}
        {campaign.content?.section_visibility?.allocation !== false && (
          <WhereYourMoneyGoes campaignId={campaign.id} category={campaign.category} content={campaign.content} />
        )}
        {campaign.faqs?.length ? (
          <section className="public-card mt-4 rounded-3xl border shadow-sm p-5 sm:p-7">
            <h2 className="text-xl sm:text-2xl font-black text-[#002D62]">{campaign.content?.faq_title || 'Frequently asked questions'}</h2>
            <div className="mt-4 space-y-3">{campaign.faqs.map((faq) => <details key={faq.question} className="rounded-xl public-muted-surface p-4"><summary className="cursor-pointer font-bold text-sm text-[#002D62]">{faq.question}</summary><p className="mt-2 text-sm leading-relaxed text-slate-600">{faq.answer}</p></details>)}</div>
          </section>
        ) : null}
      </section>
    </div>
  );
};

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
