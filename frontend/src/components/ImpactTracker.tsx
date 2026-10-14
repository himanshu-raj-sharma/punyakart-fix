import React from 'react';
import { Heart, Sparkles, Activity, Check, Quote, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { translations, authenticCowPhotos } from '../data/content';
import { useRecentDonations } from '../hooks/useRecentDonations';
import { donorFeedMessage, formatRelativeTime } from '../utils/publicDonations';

interface ImpactTrackerProps {
  language: Language;
}

export const ImpactTracker: React.FC<ImpactTrackerProps> = ({ language }) => {
  const t = translations[language];
  const { donations: donors, status: donorStatus } = useRecentDonations('chennai_airport', 9);
  const donorMessage = donorFeedMessage(donorStatus, donors.length);

  return (
    <section id="shelter-census-section" className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6 scroll-mt-40">
      {/* 1. Today's Animals in Shelter & Live Census */}
      <div className="rounded-3xl p-4 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-[#FF6B00] text-white shadow-md shadow-orange-500/20 shrink-0">
            <Heart className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase text-[#FF6B00] dark:text-orange-400 tracking-wider">
                {t.censusLiveLabel}
              </span>
            </div>
            <h2 className="font-display font-black text-xl sm:text-2xl text-neutral-900 dark:text-white tracking-tight mt-0.5">
              {t.shelterCensusTitle}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium">
              {t.shelterCensusSubtitle}
            </p>
          </div>
        </div>

        <div className="story-card relative overflow-hidden rounded-3xl p-6 sm:p-8 text-center">
          <div className="absolute inset-x-0 top-0 header-gold-line" />
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            {t.censusFamilyLabel}
          </div>
          <p className="font-display font-black text-5xl sm:text-7xl text-white tracking-tight mt-3 leading-none">
            1,187<span className="text-[#FF6B00]">+</span>
          </p>
          <p className="mt-3 font-display font-black text-base sm:text-2xl text-white tracking-tight">
            {t.censusSoulsLabel}
          </p>
          <p className="mt-2 text-xs sm:text-sm text-blue-100/80 font-medium max-w-md mx-auto">
            {t.censusSoulsSub}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-blue-50">
              <Heart className="w-3.5 h-3.5 fill-[#FF6B00] text-[#FF6B00]" />
              {t.censusChipShelter}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-blue-50">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {t.censusChipFeed}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-blue-50">
              <Activity className="w-3.5 h-3.5 text-emerald-300" />
              {t.censusChipVet}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 54 Animals Currently Under Active Treatment Card */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-blue-50 via-white to-orange-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Authentic Hospital Care Photo */}
          <div className="lg:col-span-4 relative rounded-2xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-700 h-48 sm:h-56">
            <img
              src={authenticCowPhotos.criticalTreatment}
              alt="Veterinary doctor treating an injured rescued cow with love"
              className="w-full h-full object-cover"
              loading="lazy"
              width={400}
              height={224}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <span className="text-[10px] font-black uppercase bg-red-600 text-white px-2 py-0.5 rounded-full inline-block mb-1">
                Emergency ICU Ward
              </span>
              <p className="text-xs font-bold drop-shadow-sm">
                24x7 Doctor Attendance & Surgical Recovery
              </p>
            </div>
          </div>

          {/* Right Column: Active Treatment Count, Quote & Description */}
          <div className="lg:col-span-8 space-y-3.5 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-black">
              <Activity className="w-4 h-4 text-red-600 animate-pulse" />
              <span>{t.activeTreatmentBanner}</span>
            </div>

            <h3 className="font-display font-black text-lg sm:text-2xl text-neutral-900 dark:text-white tracking-tight leading-snug">
              {t.activeTreatmentBanner}
            </h3>

            {/* Animal Support Quote */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-slate-800/80 border-l-4 border-[#FF6B00] text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 italic font-medium leading-relaxed">
              <Quote className="w-4 h-4 text-[#FF6B00] inline mr-1.5 -mt-1 opacity-80" />
              {t.activeTreatmentQuote}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-black text-[#FF6B00] block text-sm">24/7 ICU</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Continuous Monitoring</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-black text-emerald-600 dark:text-emerald-400 block text-sm">Free Surgery</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Zero Cost to Rescuers</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                <span className="font-black text-[#002D62] dark:text-blue-400 block text-sm">100% Recovery</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">Sanctuary Rehab</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Wall of Compassion */}
      <div className="rounded-3xl p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <h3 className="font-display font-black text-base sm:text-xl text-neutral-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                {t.recentSupporters}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {donorStatus === 'loading' ? t.loadingSupporters : t.recentSupportersSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 self-start sm:self-auto">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t.verifiedReceiptsLabel}</span>
          </div>
        </div>

        {/* Donors Grid */}
        {donorMessage && <p role="status" className="text-sm text-slate-500 py-3">{donorMessage}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {donors.map((d) => (
            <div
              key={d.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-xs transition-all hover:bg-slate-100/80 dark:hover:bg-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-black text-neutral-900 dark:text-white text-sm truncate">
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
    </section>
  );
};
