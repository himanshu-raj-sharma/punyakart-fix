import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { DonationType, Language } from '../types';
import { translations } from '../data/content';

interface StickyMobileBarProps {
  language: Language;
  amount: number;
  donationType: DonationType;
  onOpenCheckout: () => void;
}

export const StickyMobileBar: React.FC<StickyMobileBarProps> = ({
  language,
  amount,
  donationType,
  onOpenCheckout,
}) => {
  const t = translations[language];
  return (
    <div
      id="sticky-mobile-donate-bar"
      data-mobile-donation-bar
      className="fixed bottom-0 left-0 right-0 w-full max-w-full z-30 p-2.5 sm:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-2xl transition-colors"
    >
      <div className="flex min-w-0 items-center justify-between gap-2.5 max-w-md mx-auto">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-baseline gap-1">
            <span className="font-display font-black text-base text-neutral-900 dark:text-white">
              ₹{amount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold">
              {donationType === 'monthly' ? t.stickyPerMonth : ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          id="mobile-sticky-cta"
          onClick={onOpenCheckout}
          className="flex-1 min-w-0 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF6B00] via-[#FF5500] to-[#E05300] text-white font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/30 active:scale-96 transition-transform cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-white" />
          <span>
            {t.stickyPay} ₹{amount.toLocaleString('en-IN')}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
