import * as React from 'react';
import { resolveCampaignImage } from '../components/campaign/campaignImages';
import { allocationMaterialsFromProducts, WhereYourMoneyGoes } from '../components/campaign/WhereYourMoneyGoes';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Droplets,
  HandHeart,
  Heart,
  HeartPulse,
  HelpCircle,
  Home,
  Info,
  Lock,
  Minus,
  PawPrint,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

// ─── Direct Asset Imports (from src/assets) ──────────────────────────────────
import gauriBefore from '../assets/wa-image-1.jpeg';
import gauriAfter from '../assets/wa-image-2.jpeg';
import bholeAfter from '../assets/wa-image-3.jpeg';
import bholeBefore from '../assets/wa-image-4.jpeg';

import { Language, DonationType, DonorDedication } from '../types';
import { translations } from '../data/content';
import { useRecentDonations } from '../hooks/useRecentDonations';
import { usePublicCampaign } from '../hooks/usePublicCampaign';
import { campaignDonationAvailable, campaignAvailabilityMessage } from '../utils/publicCampaignPolling';
import { nextCampaignCartQuantity } from '../utils/campaignQuantity.js';
import { donorFeedMessage, formatRelativeTime } from '../utils/publicDonations';
import { navigate } from '../navigation';
import { EveryRupeeMattersBanner } from '../components/EveryRupeeMattersBanner';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../constants/donation';

type CrowdCheckoutDetails = {
  amount: number;
  type: DonationType;
  causeTitle: string;
  want80G: boolean;
  dedication?: DonorDedication;
  source: 'crowd_funding';
};

interface LegacyLegacyCrowdFundingPageProps {
  language: Language;
  amount: number;
  onAmountAndCauseTitleChange: (amount: number, causeTitle: string) => void;
  onOpenCheckout: (details: CrowdCheckoutDetails) => void;
}

function safeParseAmount(input: string): number {
  return parseDonationAmount(input) ?? 0;
}

// ─── Cause Categories (Sliding Marquee) ────────────────────────────────────────
const CAUSE_STYLES = [
  { id: 'flood', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800/60', text: 'text-blue-700 dark:text-blue-300' },
  { id: 'animal', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800/60', text: 'text-amber-700 dark:text-amber-300' },
  { id: 'needy', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800/60', text: 'text-emerald-700 dark:text-emerald-300' },
  { id: 'medical', bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800/60', text: 'text-rose-700 dark:text-rose-300' },
  { id: 'disaster', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800/60', text: 'text-purple-700 dark:text-purple-300' },
  { id: 'care', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800/60', text: 'text-orange-700 dark:text-orange-300' },
] as const;

// ─── Combined Impact Cards Data ──────────────────────────────────────────────
const IMPACT_CARD_META = [
  {
    amt: 1000,
    titleKey: 'crowdCard1Title' as const,
    subtitleKey: 'crowdCard1Sub' as const,
    img: '/impact1.jpeg',
  },
  {
    amt: 2000,
    titleKey: 'crowdCard2Title' as const,
    subtitleKey: 'crowdCard2Sub' as const,
    img: '/impact2.jpeg',
  },
  {
    amt: 3000,
    titleKey: 'crowdCard3Title' as const,
    subtitleKey: 'crowdCard3Sub' as const,
    img: '/impact3.jpeg',
  },
  {
    amt: 5000,
    titleKey: 'crowdCard4Title' as const,
    subtitleKey: 'crowdCard4Sub' as const,
    img: '/impact4.jpeg',
  },
] as const;

// ─── Rescue & Recovery Stories Data (Imported Assets) ────────────────────────
const RESCUE_STORIES = [
  {
    id: 'tumor-surgery',
    title: 'Life-saving surgery',
    subtitle: 'Tumor removal & recovery',
    status: 'Treated & Healing',
    beforeImg: '/before.jpeg',
    afterImg: '/after.jpeg',
    story: 'Rescued with a large, painful growth on the flank from an unsafe, garbage-strewn area. Emergency surgery, daily wound care, and sanctuary rest helped this cow stand strong again.',
  },
  {
    id: 'gauri-nandi',
    title: 'Gauri & Nandi',
    subtitle: 'Highway Accident Recovery',
    status: 'Recovered & Fully Healed',
    beforeImg: gauriBefore,
    afterImg: gauriAfter,
    story: 'Rescued from a severe highway collision with deep trauma. Emergency surgical intervention, daily wound dressings, and 45 days of continuous sanctuary care brought complete healing.',
  },
  {
    id: 'bhole',
    title: 'Bhole',
    subtitle: 'Critical Malnutrition & Rehab',
    status: 'Healthy Resident',
    beforeImg: bholeBefore,
    afterImg: bholeAfter,
    story: 'Found abandoned and critically weak, unable to feed. Nutritious green fodder, daily calcium supplements, and devoted human care helped Bhole make a full 100% recovery.',
  },
];

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const FAQ_KEYS = [
  { q: 'crowdFaq1Q', a: 'crowdFaq1A' },
  { q: 'crowdFaq2Q', a: 'crowdFaq2A' },
  { q: 'crowdFaq3Q', a: 'crowdFaq3A' },
  { q: 'crowdFaq4Q', a: 'crowdFaq4A' },
] as const;

const CAUSE_LABEL_KEYS: Record<(typeof CAUSE_STYLES)[number]['id'], string> = {
  flood: 'crowdCauseFlood',
  animal: 'crowdCauseAnimal',
  needy: 'crowdCauseNeedy',
  medical: 'crowdCauseMedical',
  disaster: 'crowdCauseDisaster',
  care: 'crowdCauseCare',
};

export const LegacyCrowdFundingPage: React.FC<LegacyLegacyCrowdFundingPageProps> = ({
  language,
  amount,
  onAmountAndCauseTitleChange,
  onOpenCheckout,
}) => {
  const t = translations[language];
  const causes = CAUSE_STYLES.map((c) => ({ ...c, label: t[CAUSE_LABEL_KEYS[c.id]] }));
  const impactCards = IMPACT_CARD_META.map((card) => ({
    ...card,
    title: t[card.titleKey],
    subtitle: t[card.subtitleKey],
  }));
  const faqs = FAQ_KEYS.map((item) => ({ q: t[item.q], a: t[item.a] }));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [activeCause, setActiveCause] = useState<string>('animal');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { donations: liveDonors, status: donorStatus } = useRecentDonations('campaign_c1', 9);
  const donorMessage = donorFeedMessage(donorStatus, liveDonors.length);
  const { campaign: campaignData, status: campaignStatus } = usePublicCampaign('c1');
  const donationUnavailable = !campaignDonationAvailable(campaignStatus, campaignData);

  // 2x2 counter card states
  const [cardCounts, setCardCounts] = useState<Record<number, number>>({ 1000: 0, 2000: 0, 3000: 0, 5000: 0 });

  // Rescue stories mobile slider ref & active index + auto sliding
  const storySliderRef = useRef<HTMLDivElement>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [isStoryUserInteracting, setIsStoryUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<number | null>(null);

  const handleUserInteraction = () => {
    setIsStoryUserInteracting(true);
    if (interactionTimeoutRef.current) {
      window.clearTimeout(interactionTimeoutRef.current);
    }
    // Resume auto-slide 5s after user stops touching/interacting
    interactionTimeoutRef.current = window.setTimeout(() => {
      setIsStoryUserInteracting(false);
    }, 5000);
  };

  const scrollToStory = (index: number) => {
    handleUserInteraction();
    setActiveStoryIndex(index);
    if (!storySliderRef.current) return;
    const container = storySliderRef.current;
    const card = container.children[index] as HTMLElement | undefined;
    if (card) {
      const cardLeft = card.offsetLeft;
      const cardWidth = card.offsetWidth;
      const containerWidth = container.offsetWidth;
      const targetScroll = cardLeft - (containerWidth - cardWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  };

  const handleStoryScroll = () => {
    if (!storySliderRef.current) return;
    const container = storySliderRef.current;
    const scrollLeft = container.scrollLeft;
    const containerCenter = scrollLeft + container.offsetWidth / 2;
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const diff = Math.abs(containerCenter - childCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    setActiveStoryIndex(closestIndex);
  };

  // Auto sliding every 3.5 seconds on mobile
  useEffect(() => {
    if (isStoryUserInteracting) return;

    const timer = window.setInterval(() => {
      // Don't auto-slide on desktop screens (md: 768px+) where 3-column grid is shown
      if (typeof window !== 'undefined' && window.innerWidth >= 768) return;

      setActiveStoryIndex((prev) => {
        const next = (prev + 1) % RESCUE_STORIES.length;
        if (storySliderRef.current) {
          const container = storySliderRef.current;
          const card = container.children[next] as HTMLElement | undefined;
          if (card) {
            const cardLeft = card.offsetLeft;
            const cardWidth = card.offsetWidth;
            const containerWidth = container.offsetWidth;
            const targetScroll = cardLeft - (containerWidth - cardWidth) / 2;
            container.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
          }
        }
        return next;
      });
    }, 3500);

    return () => {
      window.clearInterval(timer);
      if (interactionTimeoutRef.current) {
        window.clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [isStoryUserInteracting]);

  const calcCardTotal = (counts: Record<number, number>) =>
    Object.entries(counts).reduce((sum, [amt, qty]) => sum + Number(amt) * qty, 0);

  const getEffectiveAmount = (): number => {
    if (customAmount) return safeParseAmount(customAmount);
    const cardTotal = calcCardTotal(cardCounts);
    if (cardTotal > 0) return cardTotal;
    if (selectedPreset) return selectedPreset;
    return amount || 1000;
  };

  const getCauseTitle = (amt: number): string => {
    const matched = impactCards.find((card) => card.amt === amt);
    if (matched) return `${matched.title} (${matched.subtitle})`;
    const cause = causes.find((c) => c.id === activeCause);
    return `${cause?.label ?? 'Punyakart Crowd Donation'} — ₹${amt.toLocaleString('en-IN')}`;
  };

  const getCauseTitleForCounts = (counts: Record<number, number>): string => {
    const selected = impactCards
      .filter((card) => (counts[card.amt] || 0) > 0)
      .map((card) => {
        const quantity = counts[card.amt];
        return `${card.title}${quantity > 1 ? ` × ${quantity}` : ''} (${card.subtitle})`;
      });
    if (selected.length) return selected.join('; ');
    const cause = causes.find((item) => item.id === activeCause);
    return cause?.label ?? 'Punyakart Crowd Donation';
  };

  const handleQuantityChange = (amt: number, delta: number) => {
    setCustomAmount('');
    setSelectedPreset(null);
    setAmountError(null);

    const updated = {
      ...cardCounts,
      [amt]: nextCampaignCartQuantity(cardCounts[amt] || 0, delta),
    };
    setCardCounts(updated);

    const total = calcCardTotal(updated);
    onAmountAndCauseTitleChange(total, getCauseTitleForCounts(updated));
  };

  const handleSelectImpactCard = (amt: number) => {
    setCustomAmount('');
    setSelectedPreset(null);
    setAmountError(null);
    setCardCounts({ 1000: 0, 2000: 0, 3000: 0, 5000: 0, [amt]: 1 });
    onAmountAndCauseTitleChange(amt, getCauseTitle(amt));
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setSelectedPreset(null);
    setCardCounts({ 1000: 0, 2000: 0, 3000: 0, 5000: 0 });
    setAmountError(null);
    if (val.trim()) {
      const parsed = safeParseAmount(val);
      if (parsed) onAmountAndCauseTitleChange(parsed, getCauseTitle(parsed));
    }
  };

  const handleSelectPresetChip = (amt: number) => {
    setCardCounts({ 1000: 0, 2000: 0, 3000: 0, 5000: 0 });
    setCustomAmount(amt.toString());
    setSelectedPreset(amt);
    setAmountError(null);
    onAmountAndCauseTitleChange(amt, getCauseTitle(amt));
  };

  const handleDonateNow = () => {
    if (donationUnavailable) return;
    const finalAmount = getEffectiveAmount();
    if (!isValidDonationAmount(finalAmount)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    const title = getCauseTitle(finalAmount);
    onAmountAndCauseTitleChange(finalAmount, title);
    onOpenCheckout({
      amount: finalAmount,
      type: 'one-time',
      causeTitle: title,
      want80G: true,
      source: 'crowd_funding',
    });
  };

  useEffect(() => {
    const current = getEffectiveAmount();
    onAmountAndCauseTitleChange(current, getCauseTitle(current));
  }, [language]);

  return (
    <div id="crowd-funding-page" className="public-page scroll-mt-40 min-h-screen pb-4 sm:pb-20 font-sans">
      {donationUnavailable && <p role="status" className="bg-amber-50 p-3 text-sm text-amber-900">{campaignAvailabilityMessage(campaignStatus)}</p>}

      {/* ── 1. HERO SECTION ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#001833] via-[#002D62] to-[#003A7A] text-white">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#FF6B00]/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-16 w-72 h-72 rounded-full bg-cyan-400/15 blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-8 sm:py-10 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

            {/* Left Column — Tagline & Description */}
            <div className="space-y-3">
              <p className="text-amber-300 text-xs sm:text-sm font-black uppercase tracking-wider leading-tight">
                {campaignData?.title || t.crowdHeroTitle}
              </p>

              <h1 className="font-display font-black text-2xl sm:text-4xl lg:text-5xl text-white leading-tight tracking-tight">
                {campaignData?.content?.hero_title || campaignData?.hero_title || campaignData?.title || <>{t.crowdHeroHeadline}{' '}
                <span className="text-[#FF6B00]">{t.crowdHeroHeadlineAccent}</span></>}
              </h1>

              {/* Mobile Image */}
              <div className="lg:hidden mt-2">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
                  <img
                    src={resolveCampaignImage('c1', campaignData?.image)}
                    alt="Children Receiving Support"
                    className="w-full h-48 sm:h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>
              </div>

              <p className="text-blue-100/90 text-sm sm:text-base leading-relaxed pt-1">
                {campaignData?.content?.hero_subtitle || campaignData?.description || t.crowdHeroBody}
              </p>
            </div>

            {/* Right Column — Desktop Image */}
            <div className="hidden lg:block">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 group">
                <img
                  src={resolveCampaignImage('c1', campaignData?.image)}
                  alt="Children Receiving Support"
                  className="w-full h-80 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── 2. CAUSES SLIDING MARQUEE (FULL SCREEN WIDTH) ────────────────────── */}
      <div className="w-full py-4 bg-[var(--public-surface)] dark:bg-slate-900/60 border-b border-slate-200/70 dark:border-slate-800/70 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-3">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-700" />
            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400 px-2">{t.crowdChooseCause}</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-700" />
          </div>
        </div>

        <div className="w-full overflow-hidden py-1 relative">
          <style>{`
            @keyframes smoothInfiniteMarquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .marquee-slider-track {
              display: flex;
              width: max-content;
              animation: smoothInfiniteMarquee 28s linear infinite;
            }
            .marquee-slider-track:hover {
              animation-play-state: paused;
            }
          `}</style>

          {/* Edge fade gradients */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 z-10 bg-gradient-to-r from-[var(--public-surface)] dark:from-slate-950 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 z-10 bg-gradient-to-l from-[var(--public-surface)] dark:from-slate-950 to-transparent" />

          <div className="marquee-slider-track gap-3 px-4">
            {[...causes, ...causes, ...causes].map((c, idx) => (
              <button
                key={`${c.id}-${idx}`}
                type="button"
                onClick={() => setActiveCause(c.id)}
                className={`shrink-0 rounded-2xl px-5 py-3 border text-center transition-all cursor-pointer whitespace-nowrap ${c.bg} ${c.border} ${
                  activeCause === c.id ? 'ring-2 ring-[#FF6B00]/50 shadow-md scale-102' : 'hover:shadow-md'
                }`}
              >
                <p className={`text-xs sm:text-sm font-black ${c.text}`}>{c.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── 4. HEADING SECTION BETWEEN MARQUEE & PAYMENT ENGINE ─────────────── */}
        <div className="text-center max-w-3xl mx-auto space-y-2 pt-2">
          <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {t.crowdMidTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            {t.crowdMidSub}
          </p>
        </div>

        {/* ── 5. COMBINED PAYMENT ENGINE (FULL CONTAINER WIDTH) ──────────────────── */}
        <div className="w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 lg:p-8 shadow-xl space-y-5 sm:space-y-6">

          {/* Header: title + script accent */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0 space-y-0.5">
              <h3 className="font-display font-black text-lg sm:text-2xl text-[#0B1F3A] dark:text-white leading-tight">
                {t.crowdChooseAmount}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                {t.crowdPickImpact}
              </p>
            </div>
            <p
              className="font-script shrink-0 text-[#FF6B00] text-base sm:text-xl leading-none"
              aria-hidden="true"
            >
              Small Help Big Change{' '}
              <Heart className="inline-block w-4 h-4 sm:w-5 sm:h-5 fill-[#FF6B00] text-[#FF6B00] align-[-2px]" />
            </p>
          </div>

          {/* 4 impact cards: 2×2 on mobile, 4 in 1 row on desktop */}
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
            {impactCards.map((card) => {
              const qty = cardCounts[card.amt] || 0;
              const isActive = qty > 0;

              return (
                <div
                  key={card.amt}
                  className={`rounded-xl sm:rounded-2xl border bg-white dark:bg-slate-800/80 overflow-hidden flex flex-col transition-all ${
                    isActive
                      ? 'border-[#FF6B00] shadow-md ring-1 ring-[#FF6B00]/25'
                      : 'border-slate-200/90 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectImpactCard(card.amt)}
                    className="text-left cursor-pointer flex-1"
                    aria-pressed={isActive}
                    aria-label={`Select ${card.title} ₹${card.amt.toLocaleString('en-IN')}`}
                  >
                    <div className="relative aspect-[16/10] sm:aspect-[5/3] w-full overflow-hidden public-muted-surface dark:bg-slate-800">
                      <img
                        src={card.img}
                        alt=""
                        className="w-full h-full object-cover object-center"
                      />
                    </div>

                    <div className="px-2.5 pt-2.5 pb-1 space-y-0.5">
                      <p className="font-black text-[#FF6B00] text-lg sm:text-xl leading-none tracking-tight">
                        ₹{card.amt.toLocaleString('en-IN')}
                      </p>
                      <p className="font-black text-[12px] sm:text-sm text-slate-900 dark:text-white leading-tight">
                        {card.title}
                      </p>
                      <p className="text-xs sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-snug sm:line-clamp-2 min-h-[2.2em]">
                        {card.subtitle}
                      </p>
                    </div>
                  </button>

                  <div className="px-2.5 pb-2.5 pt-1">
                    <div className="flex min-h-12 w-full items-stretch overflow-hidden rounded-xl bg-[#FF6B00] text-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(card.amt, -1)}
                        className="flex w-1/4 items-center justify-center border-r border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 transition-all cursor-pointer"
                        aria-label={`Decrease ${card.title}`}
                      >
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectImpactCard(card.amt)}
                        disabled={qty > 0}
                        className="flex min-w-0 flex-1 items-center justify-center px-2 text-sm font-black tabular-nums hover:bg-[#E05300] active:scale-95 transition-all cursor-pointer disabled:cursor-default disabled:hover:bg-[#FF6B00]"
                        aria-label={qty > 0
                          ? `${card.title} selected, quantity ${qty}, total ₹${(card.amt * qty).toLocaleString('en-IN')}`
                          : `Add ${card.title} worth ₹${card.amt.toLocaleString('en-IN')}`}
                      >
                        {qty > 0 ? (
                          <span className="flex flex-col items-center leading-tight">
                            <span>Added ({qty})</span>
                            <span className="text-[10px] font-bold">₹{(card.amt * qty).toLocaleString('en-IN')}</span>
                          </span>
                        ) : (
                          `₹${card.amt.toLocaleString('en-IN')}`
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(card.amt, 1)}
                        className="flex w-1/4 items-center justify-center border-l border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 transition-all cursor-pointer"
                        aria-label={`Increase ${card.title}`}
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden sm:block">
          {/* Donation amount presets */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-2">
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {t.crowdDonationAmount}
              </p>
              <p
                className="font-script relative self-end sm:self-auto shrink-0 text-[#FF6B00] text-[13px] sm:text-base leading-none pb-0.5"
                aria-hidden="true"
              >
                <span className="absolute left-0 right-0 bottom-0 h-2 rounded-full bg-[#FFB347]/35 -z-0" />
                <span className="relative z-10">
                  Every rupee creates a kinder tomorrow{' '}
                  <Heart className="inline-block w-3.5 h-3.5 fill-[#FF6B00] text-[#FF6B00] align-[-1px]" />
                </span>
              </p>
            </div>
          <div className="grid grid-cols-2 min-[360px]:grid-cols-4 gap-2.5 sm:gap-3">
              {[1000, 2000, 3000, 5000].map((amt) => {
                const isSelected = calcCardTotal(cardCounts) === 0 && selectedPreset === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectPresetChip(amt)}
                    className={`py-3 rounded-xl border text-xs sm:text-sm font-black transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'border-[#FF6B00] bg-[#FFF0E6] text-[#E05300] shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-orange-300'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom amount & Donate CTA row (stacked on mobile, side-by-side on desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-center pt-1">
            <div className="lg:col-span-5 space-y-1">
              <div className="relative flex items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 focus-within:border-[#FF6B00] focus-within:ring-2 focus-within:ring-[#FF6B00]/20 transition-all">
                <Pencil className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <input
                  type="text"
                  value={customAmount}
                  onChange={handleCustomInputChange}
                  inputMode="numeric"
                  min={MIN_DONATION_AMOUNT}
                  max={MAX_DONATION_AMOUNT}
                  step="1"
                  aria-label="Donation amount in rupees"
                  placeholder={t.crowdCustomAmount}
                  className="w-full min-w-0 pl-2.5 pr-2 text-base font-semibold text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 placeholder:font-medium"
                />
              </div>
              {amountError && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 pl-1">
                  <Info className="w-3 h-3 shrink-0" />
                  {amountError}
                </p>
              )}
            </div>

            <div className="lg:col-span-7">
              <button
                type="button"
                onClick={handleDonateNow}
                disabled={donationUnavailable}
                className="w-full py-3.5 sm:py-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 cursor-pointer transition-all uppercase tracking-wide"
              >
                <Heart className="w-5 h-5 fill-white" />
                {t.crowdDonateNow} ₹{getEffectiveAmount().toLocaleString('en-IN')}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Trust row */}
          <div className="flex items-stretch justify-center gap-3 sm:gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center leading-snug px-1">
              <Lock className="w-4 h-4 shrink-0" />
              <span>100% Secure &amp; Tax-Deductible Donation</span>
            </p>
            <div className="w-px self-stretch bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true" />
            <p className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 text-center leading-snug px-1">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Your support brings real change</span>
            </p>
          </div>
          </div>
        </div>

        {/* ── 6. SECTION: EVERY RUPEE MATTERS ──────────────────────────────── */}
        <div className="pt-2">
          <EveryRupeeMattersBanner />
        </div>

        {/* ── 7. SECTION: RESCUE & RECOVERY ────────────────────────────────── */}
        <div className="space-y-6 pt-2">
          <div className="text-center space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50">
              RESCUE & RECOVERY
            </span>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white">
              Real stories. Real healing.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
              See the before & after journey of lives your crowd funding has directly transformed.
            </p>
          </div>

          {/* Smooth horizontal slider on phone, responsive 3-column grid on desktop */}
          <div
            ref={storySliderRef}
            onScroll={handleStoryScroll}
            onTouchStart={handleUserInteraction}
            onMouseEnter={handleUserInteraction}
            className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch overflow-x-auto md:overflow-visible snap-x snap-mandatory scroll-smooth no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-2"
          >
            {RESCUE_STORIES.map((story) => (
              <div
                key={story.id}
                className="w-[85vw] sm:w-[380px] md:w-auto shrink-0 snap-center bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xl flex flex-col h-full gap-3"
              >
                {/* Header Badge & Name */}
                <div className="min-h-[4.75rem] flex flex-col gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                      {story.title}
                    </h3>
                    <p className="text-xs font-bold text-[#FF6B00]">
                      {story.subtitle}
                    </p>
                  </div>
                  <span className="self-start text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {story.status}
                  </span>
                </div>

                {/* Before & After — equal frames */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                    <img
                      src={story.beforeImg}
                      alt={`${story.title} Before`}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                    <span className="absolute bottom-2 left-2 z-10 text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md tracking-wider">
                      BEFORE
                    </span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-slate-200 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                    <img
                      src={story.afterImg}
                      alt={`${story.title} After`}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                    <span className="absolute bottom-2 left-2 z-10 text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md tracking-wider">
                      AFTER
                    </span>
                  </div>
                </div>

                {/* Narrative Text */}
                <p className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {story.story}
                </p>

                {/* Action CTA */}
                <button
                  type="button"
                  onClick={handleDonateNow}
                  disabled={donationUnavailable}
                  className="mt-auto w-full py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  Support this recovery — ₹1,000
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Mobile slide pagination indicators */}
          <div className="flex md:hidden items-center justify-center gap-2 pt-1">
            {RESCUE_STORIES.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToStory(index)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeStoryIndex === index
                    ? 'w-7 bg-[#FF6B00]'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                aria-label={`Go to recovery story ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* ── 8. LIVE DONATION BOARD ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div>
                <h2 className="font-display font-black text-base sm:text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                  {t.crowdLiveBoard}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {donorStatus === 'loading' ? t.crowdLoadingDonors : t.crowdLiveSub}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t.verifiedNgo}</span>
            </div>
          </div>

          {donorMessage && <p role="status" className="text-sm text-slate-500 py-3">{donorMessage}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveDonors.map((d) => (
              <div
                key={d.id}
                className="p-3.5 rounded-2xl public-muted-surface dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-black text-slate-900 dark:text-white text-sm truncate">
                    {d.name}
                  </span>
                  <span className="text-xs font-black text-[#FF6B00] dark:text-orange-400 bg-orange-100 dark:bg-[#FF6B00]/15 px-2 py-0.5 rounded-lg shrink-0">
                    ₹{d.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <time dateTime={d.date} className="mt-2 text-xs text-slate-500">{formatRelativeTime(d.date)}</time>
              </div>
            ))}
          </div>
        </div>

        <WhereYourMoneyGoes
          campaignId="c1"
          content={campaignData?.content}
          materials={allocationMaterialsFromProducts(impactCards.map((card) => ({
            name: card.title,
            unitPrice: card.amt,
          })))}
        />

        {/* ── 9. QUESTIONS, ANSWERED (FAQ ACCORDION) ─────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#FF6B00]" />
            <h2 className="font-display font-black text-xl sm:text-2xl text-slate-900 dark:text-white">
              {t.crowdFaqTitle}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-4 py-3.5 text-left font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center justify-between gap-3 public-muted-surface dark:bg-slate-800/40 hover:bg-[var(--public-surface)] cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 py-3 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 10. MISSION SUMMARY BANNER & FOOTER ──────────────────────────── */}
        <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800 p-4 text-center">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
            &ldquo;Shelter, feed, and heal 1,187+ rescued animals in Dehradun — service to animals is service to the Divine.&rdquo;
          </p>
        </div>

      </div>

      {/* ── 11. FIXED BOTTOM PAY BAR (DESKTOP) ─────────── */}
      <div className="hidden sm:block fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#FF6B00] hidden sm:flex items-center justify-center shrink-0">
              <Heart className="w-5 h-5 fill-[#FF6B00]" />
            </div>
            <div>
              <p className="font-black text-base sm:text-xl text-slate-900 dark:text-white leading-tight">
                ₹{getEffectiveAmount().toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block font-medium">
                100% Tax Deductible under 80G • Direct Impact
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDonateNow}
            disabled={donationUnavailable}
            className="px-6 py-2.5 sm:py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#e05e00] text-white font-extrabold text-xs sm:text-base flex items-center gap-2 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <span>{t.stickyPay} ₹{getEffectiveAmount().toLocaleString('en-IN')}</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* ── 11b. FIXED BOTTOM PAY BAR (MOBILE) ─────────── */}
      <div data-mobile-donation-bar className="fixed bottom-0 left-0 right-0 sm:hidden z-40 max-h-[40vh] supports-[height:100dvh]:max-h-[45dvh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        {donationUnavailable && <p role="status" className="mb-2 text-xs text-amber-900">{campaignAvailabilityMessage(campaignStatus)}</p>}
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
          <span className="text-slate-500 font-extrabold text-[11px] tracking-wider uppercase">
            MAKE A DONATION
          </span>
          <span className="text-[#FF6B00] text-[10px] font-bold">
            Every rupee creates a kinder tomorrow 🧡
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {[1000, 2000, 5000, 10000].map((amt) => {
            const isSelected = selectedPreset === amt;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => handleSelectPresetChip(amt)}
                className={`border-2 rounded-xl min-h-11 py-1.5 px-1 text-center font-extrabold text-[11px] transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#FF6B00] bg-[#FFF0E6] text-[#FF6B00] ring-1 ring-[#FF6B00]/30 shadow-2xs'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:border-[#FF6B00] hover:bg-[#FFF0E6]/30 active:scale-95'
                }`}
              >
                ₹{amt.toLocaleString('en-IN')}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex items-stretch overflow-hidden rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]/30">
          <div className="relative flex w-1/2 min-w-0 items-center">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6B00] font-black text-sm">
            ₹
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DONATION_AMOUNT}
            max={MAX_DONATION_AMOUNT}
            aria-label="Donation amount in rupees"
            step="1"
            placeholder="Enter custom amount"
            value={customAmount}
            onChange={handleCustomInputChange}
            className="w-full min-w-0 min-h-12 bg-transparent pl-7 pr-10 py-2 text-base font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
          />
          {customAmount && (
            <button
              type="button"
              onClick={() => handleCustomInputChange({ target: { value: '' } } as any)}
              aria-label="Clear donation amount"
              className="absolute right-0 min-w-11 min-h-11 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
          </div>

          <button
            type="button"
            onClick={handleDonateNow}
            disabled={donationUnavailable}
            className="flex w-1/2 min-w-0 min-h-12 items-center justify-center gap-1 border-l-2 border-orange-200 bg-[#FF6B00] px-2 py-2.5 text-center text-xs font-black leading-tight text-white hover:bg-[#E05300] active:bg-[#C84800] transition-all cursor-pointer"
          >
            <span className="shrink-0">🧡</span>
            <span className="min-w-0 break-words">{t.stickyPay} • ₹{getEffectiveAmount().toLocaleString('en-IN')}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
          <div className="flex items-center gap-1.5 text-left">
            <Lock className="w-3 h-3 text-[#FF6B00] shrink-0" />
            <span className="text-[9px] font-semibold text-[#FF6B00] leading-tight">
              100% Secure &amp; Tax-Deductible
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-left justify-end">
            <ShieldCheck className="w-3 h-3 text-[#FF6B00] shrink-0" />
            <span className="text-[9px] font-semibold text-[#FF6B00] leading-tight">
              Brings real change
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
