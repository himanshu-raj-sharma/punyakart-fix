import React, { useEffect, useRef } from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { ImpactItem, Language, pickLocale } from '../types';
import { impactItems, translations } from '../data/content';
import { DisasterDonateCard } from './DisasterDonateCard';

interface QuickScanScrollProps {
  language: Language;
  selectedAmount: number;
  onSelectAmount: (amount: number, item?: ImpactItem) => void;
  onInstantDonate: (amount: number, item?: ImpactItem) => void;
  onDisasterDonate: (amount: number, causeTitle: string) => void;
}

interface SponsorshipCardProps {
  item: ImpactItem;
  language: Language;
  isSelected: boolean;
  isPopular: boolean;
  cardId?: string;
  onSelectAmount: (amount: number, item?: ImpactItem) => void;
  onInstantDonate: (amount: number, item?: ImpactItem) => void;
}

const SponsorshipCard: React.FC<SponsorshipCardProps> = ({
  item,
  language,
  isSelected,
  isPopular,
  cardId,
  onSelectAmount,
  onInstantDonate,
}) => {
  const t = translations[language];
  return (
  <div
    id={cardId}
    onClick={() => onSelectAmount(item.amount, item)}
    className={`shrink-0 w-[88vw] sm:w-[340px] md:w-[380px] rounded-2xl sm:rounded-3xl flex flex-col transition-all duration-200 cursor-pointer border-2 relative overflow-hidden select-none bg-white dark:bg-slate-900 shadow-md hover:shadow-lg ${
      isSelected
        ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/30 bg-orange-50/40 dark:bg-orange-950/20'
        : isPopular
        ? 'border-orange-300 dark:border-orange-700/60 hover:border-[#FF6B00]'
        : 'border-slate-200 dark:border-slate-800 hover:border-[#FF6B00]/50'
    }`}
  >
    <div className="relative w-full h-56 sm:h-64 md:h-72 shrink-0">
      <img
        src={item.image}
        alt={pickLocale(item.title, language)}
        className="w-full h-full object-cover pointer-events-none"
      />
    </div>

    <div className="p-3 sm:p-4 flex flex-col gap-3">
      <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/50 dark:border-orange-900/40">
        <p className="text-xs sm:text-sm font-bold text-orange-900 dark:text-orange-300 line-clamp-2 flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6B00] shrink-0 mt-0.5" />
          <span>{pickLocale(item.impactPill, language)}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInstantDonate(item.amount, item);
        }}
        className="w-full py-2.5 sm:py-3 px-3 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
      >
        <Zap className="w-4 h-4 fill-white text-white" />
        <span>{(t.quickScanSponsor || 'Sponsor ₹{amount}').replace('{amount}', item.amount.toLocaleString('en-IN'))}</span>
      </button>
    </div>
  </div>
  );
};

function wrapLoop(el: HTMLDivElement) {
  const half = el.scrollWidth / 2;
  if (half <= 0) return;
  if (el.scrollLeft >= half) el.scrollLeft -= half;
  else if (el.scrollLeft <= 0) el.scrollLeft += half;
}

function SponsorshipMarquee({ children }: { children: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const movedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    el.scrollLeft = 1;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const tick = () => {
      if (!pausedRef.current && !draggingRef.current && !reduceMotion) {
        el.scrollLeft += 0.55;
        wrapLoop(el);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pauseNow = () => {
    pausedRef.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  };

  const resumeSoon = () => {
    draggingRef.current = false;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 2200);
  };

  return (
    <div
      ref={scrollerRef}
      className="sponsorship-marquee no-scrollbar pb-3 -mx-3 sm:-mx-6 px-3 sm:px-6"
      onScroll={(e) => wrapLoop(e.currentTarget)}
      onPointerDown={(e) => {
        pauseNow();
        movedRef.current = false;
        startXRef.current = e.clientX;
        startScrollRef.current = scrollerRef.current?.scrollLeft ?? 0;
        if (e.pointerType === 'mouse') {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerMove={(e) => {
        if (Math.abs(e.clientX - startXRef.current) > 8) movedRef.current = true;
        if (!draggingRef.current || e.pointerType !== 'mouse' || !scrollerRef.current) return;
        scrollerRef.current.scrollLeft = startScrollRef.current - (e.clientX - startXRef.current);
      }}
      onPointerUp={resumeSoon}
      onPointerCancel={resumeSoon}
      onClickCapture={(e) => {
        if (!movedRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        movedRef.current = false;
      }}
    >
      <div className="flex w-max gap-4 sm:gap-5">{children}</div>
    </div>
  );
}

export const QuickScanScroll: React.FC<QuickScanScrollProps> = ({
  language,
  selectedAmount,
  onSelectAmount,
  onInstantDonate,
  onDisasterDonate,
}) => {
  const loopedItems = [...impactItems, ...impactItems];

  return (
    <section id="sponsorship-cards-section" className="max-w-6xl mx-auto px-3 sm:px-6 py-5 min-w-0 overflow-x-clip">
      <DisasterDonateCard language={language} onDonate={onDisasterDonate} embedded />

      <SponsorshipMarquee>
        {loopedItems.map((item, index) => {
          const isSelected = selectedAmount === item.amount;
          const isPopular = item.popular || item.amount === 5000;

          return (
            <SponsorshipCard
              key={`${item.id}-${index}`}
              item={item}
              language={language}
              isSelected={isSelected}
              isPopular={isPopular}
              cardId={index < impactItems.length ? `impact-card-${item.id}` : undefined}
              onSelectAmount={onSelectAmount}
              onInstantDonate={onInstantDonate}
            />
          );
        })}
      </SponsorshipMarquee>
    </section>
  );
};
