import React from 'react';
import { Heart, Sparkles, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { siteImages, translations } from '../data/content';

interface HeroBannerProps {
  language: Language;
  onQuickDonate: () => void;
  onOpen80GSearch: () => void;
}

function HeroImage({ className = '', alt }: { className?: string; alt: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-2 border-orange-200/70 dark:border-slate-700 group">
        <img
          src={siteImages.hero}
          alt={alt}
          className="w-full h-56 sm:h-64 md:h-72 object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
      </div>
    </div>
  );
}

export const PassengerBanner: React.FC<HeroBannerProps> = ({
  language,
  onQuickDonate,
  onOpen80GSearch,
}) => {
  const t = translations[language];

  return (
    <section id="hero-banner-section" className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-[#F4F7FA] to-[#F4F7FA] dark:from-[#0A1128] dark:via-[#080E1A] dark:to-[#080E1A] pt-4 sm:pt-6 pb-6 px-3 sm:px-6 transition-colors">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-[#FF6B00]/8 dark:bg-[#FF6B00]/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-0 -ml-16 w-80 h-80 rounded-full bg-[#002D62]/10 dark:bg-[#002D62]/10 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Tax Benefit and Sanctity Tag */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100/90 dark:bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] dark:text-orange-300 text-xs font-bold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 fill-[#FF6B00] text-[#FF6B00]" />
            <span>{t.heroTaxChip}</span>
          </div>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl p-4 sm:p-6 md:p-8 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: Headlines, Mission, Quotes & CTAs */}
            <div className="lg:col-span-7 space-y-4 text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#002D62]/10 dark:bg-blue-900/40 text-[#002D62] dark:text-blue-300 text-xs font-bold border border-blue-200/60 dark:border-blue-700/40">
                <Heart className="w-3.5 h-3.5 fill-[#FF6B00] text-[#FF6B00]" />
                <span>{t.heroBrandPill}</span>
              </div>

              <h1 className="font-serif-hero font-bold text-2xl sm:text-3xl md:text-4xl text-neutral-900 dark:text-white tracking-normal sm:tracking-tight leading-snug sm:leading-[1.25]">
                {t.heroHeadline}
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed font-normal">
                {t.heroSubheadline}
              </p>

              <HeroImage className="lg:hidden" alt={t.heroImageAlt} />

              {/* Action Buttons */}
              <div className="pt-2 flex flex-nowrap items-stretch gap-2 sm:gap-3">
                <button
                  type="button"
                  id="hero-sponsor-cta-btn"
                  onClick={onQuickDonate}
                  className="flex-1 min-w-0 py-2.5 sm:py-3 px-2 sm:px-6 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#E05300] hover:brightness-105 text-white font-display font-black text-[10px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 shadow-lg shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white shrink-0" />
                  <span className="leading-tight text-center">{t.heroSponsorCta}</span>
                </button>

                <button
                  type="button"
                  id="hero-80g-btn"
                  onClick={onOpen80GSearch}
                  className="flex-1 min-w-0 py-2.5 sm:py-3 px-2 sm:px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-neutral-800 dark:text-neutral-200 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
                  <span className="leading-tight text-center">{t.hero80GCta}</span>
                </button>
              </div>
            </div>

            <HeroImage className="hidden lg:block lg:col-span-5" alt={t.heroImageAlt} />
          </div>
        </div>
      </div>
    </section>
  );
};
