import React, { useState } from 'react';
import { Sparkles, HeartHandshake, Heart } from 'lucide-react';
import { Language, LocalizedString, pickLocale } from '../types';
import { translations } from '../data/content';
import { DONATION_AMOUNT_ERROR, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../constants/donation';

interface DisasterDonateCardProps {
  language: Language;
  onDonate: (amount: number, causeTitle: string) => void;
  embedded?: boolean;
}

const DISASTER_CAUSE: LocalizedString = {
  en: 'Disaster Management',
  hi: 'आपदा प्रबंधन',
  ta: 'பேரிடர் நிவாரணம்',
};

export const DisasterDonateCard: React.FC<DisasterDonateCardProps> = ({ language, onDonate, embedded }) => {
  const t = translations[language];
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDonate = () => {
    const parsed = parseDonationAmount(amount);
    if (parsed === null) {
      setError(DONATION_AMOUNT_ERROR);
      return;
    }
    setError(null);
    onDonate(parsed, pickLocale(DISASTER_CAUSE, language));
  };

  return (
    <div
      id={embedded ? undefined : 'disaster-donate-section'}
      className={embedded ? 'mb-5 min-w-0' : 'max-w-6xl mx-auto px-3 sm:px-6 py-5 min-w-0'}
    >
      <div className="rounded-2xl sm:rounded-3xl bg-[#002D62] text-white border border-blue-900/60 shadow-lg overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FF6B00] text-white shrink-0 shadow-md shadow-orange-500/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h2 className="font-display font-black text-base sm:text-xl tracking-tight leading-tight">
              {t.disasterDonateTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 text-[11px] sm:text-xs text-amber-300 font-bold self-start sm:self-auto border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t.disasterTaxChip}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex flex-nowrap items-stretch gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500 dark:text-neutral-400 font-black text-base pointer-events-none">
                ₹
              </span>
              <input
                type="text"
                inputMode="numeric"
                min={MIN_DONATION_AMOUNT}
                max={MAX_DONATION_AMOUNT}
                step="1"
                aria-label={t.chooseAmount}
                aria-invalid={Boolean(error)}
                id="disaster-custom-amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDonate();
                }}
                placeholder={t.disasterAmountPlaceholder}
                className="w-full h-full pl-8 pr-3 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm sm:text-base font-bold text-neutral-900 dark:text-white outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20"
              />
            </div>
            <button
              type="button"
              onClick={handleDonate}
              className="shrink-0 px-5 sm:px-7 py-3 rounded-2xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-display font-black text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-white" />
              {t.navDonate}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};
