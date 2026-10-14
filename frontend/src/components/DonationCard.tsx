import React, { useState } from 'react';
import { Heart, Sparkles, ShieldCheck, Zap, ArrowRight, Flame, Repeat, Info } from 'lucide-react';
import { DonationType, Language, pickLocale } from '../types';
import { translations, oneTimePresetAmounts, monthlyPresetAmounts, impactItems } from '../data/content';
import { getDonationAmountError, getMinimumDonationAmount, isValidDonationAmount, MAX_DONATION_AMOUNT, normalizeDonationSource, parseDonationAmount } from '../constants/donation';

interface DonationCardProps {
  source?: string;
  language: Language;
  donationType: DonationType;
  onDonationTypeChange: (type: DonationType) => void;
  selectedAmount: number;
  onAmountChange: (amount: number) => void;
  onOpenCheckout: (details: {
    amount: number;
    type: DonationType;
    causeTitle: string;
    want80G: boolean;
    source: string;
  }) => void;
}

export const DonationCard: React.FC<DonationCardProps> = ({
  language,
  donationType,
  onDonationTypeChange,
  selectedAmount,
  onAmountChange,
  onOpenCheckout,
  source = 'chennai_airport',
}) => {
  const t = translations[language];
  const [customAmount, setCustomAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const resolvedSource = normalizeDonationSource(source);
  const MIN_DONATION = getMinimumDonationAmount(resolvedSource);
  const amountErrorMessage = getDonationAmountError(resolvedSource);
  const presetAmounts = (donationType === 'one-time' ? oneTimePresetAmounts : monthlyPresetAmounts)
    .filter((amount) => isValidDonationAmount(amount, resolvedSource));
  const FEED_COST_PER_ANIMAL_DAY = 500;

  const resolveAmount = (): number => {
    if (customAmount) {
      return parseDonationAmount(customAmount, resolvedSource) ?? 0;
    }
    return selectedAmount;
  };

  const handlePresetSelect = (amt: number) => {
    setCustomAmount('');
    setAmountError(null);
    onAmountChange(amt);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setAmountError(null);
    const num = parseDonationAmount(val, resolvedSource);
    if (num !== null) {
      onAmountChange(num);
    } else if (val) {
      setAmountError(amountErrorMessage);
    }
  };

  const feedingImpactText = (amt: number) => {
    if (amt < FEED_COST_PER_ANIMAL_DAY) return t.donationContributionImpact;
    const animals = Math.floor(amt / FEED_COST_PER_ANIMAL_DAY);
    const noun = animals === 1 ? t.donationAnimalSingular : t.donationAnimalPlural;
    return (t.donationFeedImpact || '')
      .replace('{animals}', String(animals))
      .replace('{noun}', noun);
  };

  const getDynamicImpactText = (amt: number) => {
    if (amt >= 22000) return t.impactTierSurgery;
    if (amt >= 18000) return t.impactTierMedical;
    if (amt >= 12000) return t.impactTierRescue;
    if (amt >= 8500) return t.impactTierTreatment;
    if (amt >= 5000) return t.impactTierEmergency;
    if (amt >= 3500) return t.impactTierMedicine;
    return feedingImpactText(amt);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAmountError(null);

    const amount = resolveAmount();
    if (!isValidDonationAmount(amount, resolvedSource)) {
      setAmountError(amountErrorMessage);
      return;
    }

    // Keep parent state in sync before opening checkout (fixes custom-amount edge cases)
    onAmountChange(amount);

    const currentImpactItem = impactItems.find((i) => i.amount === amount);
    const causeTitle = currentImpactItem && amount >= 3500
      ? pickLocale(currentImpactItem.title, language)
      : getDynamicImpactText(amount);

    onOpenCheckout({
      amount,
      type: donationType,
      causeTitle,
      want80G: true,
      source: resolvedSource,
    });
  };

  const displayAmount = resolveAmount();

  return (
    <section id="donation-engine-section" className="max-w-4xl mx-auto px-3 sm:px-6 py-4 scroll-mt-40">
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
        {/* Top Header Split: 70% One-Time vs 30% Monthly */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 sm:p-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2.5 max-w-xl mx-auto">
            {/* 70% Focus: One-Time Giving */}
            <button
              type="button"
              id="tab-one-time-donation"
              onClick={() => onDonationTypeChange('one-time')}
              className={`relative py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                donationType === 'one-time'
                  ? 'bg-gradient-to-r from-[#FF6B00] to-[#E05300] text-white shadow-lg shadow-orange-500/25 ring-2 ring-[#FF6B00]/30'
                  : 'bg-white dark:bg-slate-800 text-neutral-600 dark:text-neutral-300 hover:bg-orange-50 dark:hover:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <Flame className={`w-4 h-4 ${donationType === 'one-time' ? 'fill-amber-300 text-amber-300' : 'text-[#FF6B00]'}`} />
              <span className="font-display font-black text-xs sm:text-sm tracking-tight">
                {t.oneTimeTab}
              </span>
            </button>

            {/* Monthly Giving */}
            <button
              type="button"
              id="tab-monthly-donation"
              onClick={() => onDonationTypeChange('monthly')}
              className={`relative py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                donationType === 'monthly'
                  ? 'bg-gradient-to-r from-[#002D62] to-[#0A3D78] text-white shadow-lg shadow-blue-950/25 ring-2 ring-[#002D62]/40'
                  : 'bg-white dark:bg-slate-800 text-neutral-600 dark:text-neutral-300 hover:bg-blue-50 dark:hover:bg-slate-700/50 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <Repeat className={`w-4 h-4 ${donationType === 'monthly' ? 'text-blue-200' : 'text-[#002D62] dark:text-blue-400'}`} />
              <span className="font-display font-black text-xs sm:text-sm tracking-tight">
                {t.monthlyTab}
              </span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-4 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount Selection Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs sm:text-sm font-black text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                  {t.chooseAmount}
                </label>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-bold">
                  {donationType === 'monthly' ? t.donationMonthlyHint : t.donationOneTimeHint}
                </span>
              </div>

              {/* 3x2 Grid for Presets (Highly thumb-friendly on mobile) */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-3.5">
                {presetAmounts.map((amt) => {
                  const isSelected = selectedAmount === amt && !customAmount;
                  const isPopular = amt === 5000;

                  return (
                    <button
                      key={amt}
                      type="button"
                      id={`preset-amt-${amt}`}
                      onClick={() => handlePresetSelect(amt)}
                      className={`relative min-h-[46px] sm:min-h-[52px] rounded-xl flex flex-col items-center justify-center p-1.5 font-display transition-all cursor-pointer active:scale-96 ${
                        isSelected
                          ? donationType === 'one-time'
                            ? 'bg-gradient-to-br from-[#FF6B00] to-[#E05300] text-white font-black shadow-lg shadow-orange-500/25 ring-2 ring-[#FF6B00]/40'
                            : 'bg-gradient-to-br from-[#002D62] to-[#0A3D78] text-white font-black shadow-lg shadow-blue-950/25 ring-2 ring-[#002D62]/40'
                          : isPopular
                          ? 'bg-orange-50/70 dark:bg-slate-800/90 text-neutral-800 dark:text-neutral-100 border-2 border-orange-300 dark:border-orange-500/50 hover:border-[#FF6B00] font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/90 text-neutral-800 dark:text-neutral-100 border border-slate-200/80 dark:border-slate-700 hover:border-[#FF6B00] dark:hover:border-[#FF6B00] font-bold'
                      }`}
                    >
                      {isPopular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-black bg-[#FF6B00] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs whitespace-nowrap">
                          {t.donationMostGiven}
                        </span>
                      )}
                      <span className="text-sm sm:text-base tracking-tight font-black">
                        ₹{amt.toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[9px] font-semibold leading-none mt-0.5 ${
                        isSelected ? 'text-white/85' : 'text-neutral-500 dark:text-neutral-400'
                      }`}>
                        {donationType === 'monthly' ? t.donationPerMonth : t.donationOneTimeTag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Input Box */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <span className="text-neutral-500 dark:text-neutral-400 font-black text-base">₹</span>
                </div>
                <input
                  type="text"
                  id="custom-amount-input"
                  value={customAmount}
                  onChange={handleCustomChange}
                  placeholder={t.customAmountPlaceholder.replace('{min}', String(MIN_DONATION))}
                  inputMode="numeric"
                  min={MIN_DONATION}
                  max={MAX_DONATION_AMOUNT}
                  step="1"
                  aria-label={t.chooseAmount}
                  aria-invalid={Boolean(amountError)}
                  className={`w-full pl-8 pr-4 py-3 rounded-2xl border text-sm sm:text-base font-bold bg-white dark:bg-slate-800 text-neutral-900 dark:text-white transition-all outline-none ${
                    customAmount
                      ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20'
                  }`}
                />
              </div>
              {amountError && (
                <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  {amountError}
                </p>
              )}
            </div>

            {/* Dynamic Real-time Impact Banner */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/80 dark:bg-slate-800/90 border border-[#FF6B00]/30 dark:border-slate-700 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#FF6B00] text-white shrink-0 mt-0.5 shadow-xs">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <div className="text-xs">
                <p className="font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>
                    {(t.donationMakesReal || '').replace(
                      '{amount}',
                      `${displayAmount.toLocaleString('en-IN')}${donationType === 'monthly' ? t.donationPerMonth : ''}`,
                    )}
                  </span>
                </p>
                <p className="text-neutral-700 dark:text-neutral-300 font-semibold mt-0.5 leading-relaxed">
                  {getDynamicImpactText(displayAmount)}
                </p>
              </div>
            </div>

            {/* Big Primary Orange Action Button */}
            <button
              type="submit"
              id="main-donate-cta-btn"
              className={`w-full py-3 px-5 rounded-2xl font-display font-black text-sm sm:text-base flex items-center justify-center gap-2 text-white shadow-xl transition-all active:scale-98 cursor-pointer ${
                donationType === 'one-time'
                  ? 'bg-gradient-to-r from-[#FF6B00] via-[#FF5500] to-[#E05300] hover:brightness-105 shadow-orange-500/30'
                  : 'bg-gradient-to-r from-[#002D62] via-[#083870] to-[#002D62] hover:brightness-110 shadow-blue-950/30'
              }`}
            >
              <Heart className="w-5 h-5 fill-white" />
              <span>
                {t.emergencyRescueCTA} • ₹{displayAmount.toLocaleString('en-IN')}
                {donationType === 'monthly' ? '/mo' : ''}
              </span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>

            {/* Instant Payment Methods Accepted Footer */}
            <div className="text-center pt-1">
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-bold text-neutral-700 dark:text-neutral-300">{t.donationPayVia}</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-neutral-800 dark:text-white border border-slate-200/60 dark:border-slate-700/60">UPI</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-neutral-800 dark:text-white border border-slate-200/60 dark:border-slate-700/60">Cards</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-neutral-800 dark:text-white border border-slate-200/60 dark:border-slate-700/60">NetBanking</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-neutral-800 dark:text-white border border-slate-200/60 dark:border-slate-700/60">Wallets</span>
              </div>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                256-Bit SSL Bank Grade Encryption • 100% Secure Gateway
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
