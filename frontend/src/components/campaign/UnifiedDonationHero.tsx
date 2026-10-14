import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CAMPAIGN_ASSETS, CAMPAIGN_METRICS, CURRENCIES, PRODUCTS_LIST } from '../../data/campaigns';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT } from '../../constants/donation';
import { parseDonationCurrencyAmount } from '../../utils/donationCurrency';
import { Currency, ProductItem, DonationCartItem } from '../../types/campaign';
import {
  Heart,
  ShieldCheck,
  Lock,
  Share2,
  MessageCircle,
  Check,
  MapPin,
  TrendingUp,
  CreditCard,
  Package,
  Calendar,
  Sparkles,
  Plus,
  Minus,
  Sparkle
} from 'lucide-react';

interface UnifiedDonationHeroProps {
  cart: DonationCartItem[];
  onUpdateQuantity: (product: ProductItem, delta: number) => void;
  onDirectDonate: (amount: number, currency: Currency) => void;
  onSelectMonthlyPlan: (amount: number) => void;
  onOpenCheckoutWithCart: () => void;
  onOpenTaxModal: () => void;
}

export const UnifiedDonationHero: React.FC<UnifiedDonationHeroProps> = ({
  cart,
  onUpdateQuantity,
  onDirectDonate,
  onSelectMonthlyPlan,
  onOpenCheckoutWithCart,
  onOpenTaxModal,
}) => {
  // Primary donation tab state: 'one-time' | 'supplies' | 'monthly'
  const [activeDonationTab, setActiveDonationTab] = useState<'one-time' | 'supplies' | 'monthly'>('one-time');

  // Monetary state
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[0]);
  const [selectedAmount, setSelectedAmount] = useState<number>(3000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [taxExemptionRequested, setTaxExemptionRequested] = useState<boolean>(true);

  // Monthly state
  const [monthlyAmount, setMonthlyAmount] = useState<number>(1100);

  // Active story/media thumbnail
  const [activeMedia, setActiveMedia] = useState<'main' | 'story1' | 'story2' | 'story3'>('main');

  const presetAmountsINR = [
    { amount: 500, label: 'Feed 1 Cow (2 Days)', tag: 'Quick Seva' },
    { amount: 1100, label: 'Auspicious Gau Puja & Lucerne Hay', tag: 'Punya' },
    { amount: 2100, label: 'Emergency Trauma Kit & Saline IV', tag: 'Vital' },
    { amount: 3000, label: '1 Week Complete ICU Recovery & Fodder', tag: 'Most Popular', isPopular: true },
    { amount: 5100, label: 'Full Fracture Casting & Surgery Care', tag: 'Lifesaver' },
    { amount: 11000, label: 'Lifetime Sanctuary Bed & Monthly Food', tag: 'Guardian' },
  ];

  const monthlyPresets = [
    { amount: 501, label: 'Feed a Recovering Calf', desc: 'Daily green grass & clean water' },
    { amount: 1100, label: 'Sponsor Medicine & Fodder', desc: 'Antibiotics, wound spray & hay' },
    { amount: 2100, label: 'Adopt 1 Injured Cow in ICU', desc: 'Full veterinary & shelter care', isPopular: true },
    { amount: 5000, label: 'Sponsor a Disabled Gaumata', desc: 'Permanent sanctuary guardian' },
  ];

  const parsedDonationINR = parseDonationCurrencyAmount(customAmount || String(selectedAmount), selectedCurrency.rateFromINR);
  const currentDonationAmount = customAmount ? (parsedDonationINR === null ? 0 : Number(customAmount.trim())) : selectedAmount;
  const currentDonationINR = parsedDonationINR ?? 0;

  const handleSelectPreset = (inrAmount: number) => {
    const converted = Math.round(inrAmount * selectedCurrency.rateFromINR);
    setSelectedAmount(converted);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setAmountError(null);
  };

  const handleCurrencyChange = (curr: Currency) => {
    if (parsedDonationINR === null) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    const inrValue = currentDonationINR;
    setSelectedCurrency(curr);
    if (customAmount) {
      setCustomAmount(Math.round(inrValue * curr.rateFromINR).toString());
    } else {
      setSelectedAmount(Math.round(inrValue * curr.rateFromINR));
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🙏 Please support Punyakart Foundation in saving 250+ injured cows in Uttarakhand. Instant 80G tax exemption available. Donate here: ${window.location.href}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getImpactMessage = (inr: number) => {
    if (inr >= 10000) return 'Provides full surgical extraction, fracture plating, and 1 month of intensive veterinary ICU care.';
    if (inr >= 5000) return 'Sponsors 12 days of sterile antiseptic dressing, pain relief, and dry/green fodder.';
    if (inr >= 3000) return '⭐ Most Impactful: Covers 7 days of high-protein feed, sterile bandages, and clean shelter bed.';
    if (inr >= 2000) return 'Provides emergency medical trauma kit, maggot treatment spray, and saline IV drips.';
    if (inr >= 1000) return 'Sponsors 2 large bundles of nutritious green fodder and daily wound cleaning.';
    if (inr >= 500) return 'Feeds fresh tender grass and clean drinking water to an injured cow for 2 days.';
    return 'Contributes towards food and care for rescued animals.';
  };

  // Cart calculations
  const cartTotalAmount = cart.reduce((acc, item) => acc + item.product.unitPrice * item.quantity, 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const getProductQty = (productId: string) => {
    const found = cart.find((c) => c.product.id === productId);
    return found ? found.quantity : 0;
  };

  const currentMediaImage =
    activeMedia === 'story1'
      ? CAMPAIGN_ASSETS.stories.story1
      : activeMedia === 'story2'
      ? CAMPAIGN_ASSETS.stories.story2
      : activeMedia === 'story3'
      ? CAMPAIGN_ASSETS.stories.story3
      : CAMPAIGN_ASSETS.heroRescue;

  return (
    <section id="donation-hub" className="py-5 sm:py-8 lg:py-10">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        
        {/* Urgent Live Alert Strip with soft breathing ring */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border border-red-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <div className="text-xs sm:text-sm font-bold text-red-900 flex items-center gap-1.5 flex-wrap">
              <span className="uppercase tracking-wide text-red-700 font-extrabold bg-red-100 px-2 py-0.5 rounded text-[10px] sm:text-xs">
                Critical ICU Alert
              </span>
              <span>18 critically injured Gaumatas admitted this week. Urgent fodder &amp; medicine needed.</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold self-end sm:self-auto">
            <span className="text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> 80G Tax Exemption (50% Benefit)
            </span>
          </div>
        </motion.div>

        {/* Main Grid: Emotional Proof Left, Priority Donation Tabs Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Emotional Story, Visual Evidence & Campaign Metrics          */}
          {/* ========================================================================= */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-6 space-y-4 sm:space-y-5"
          >
            
            {/* Headlines & Sacred Shloka */}
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#9F3D00] bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 px-3 py-1.5 rounded-full mb-2.5 shadow-2xs">
                <span className="flex h-2 w-2 rounded-full bg-[#9F3D00] animate-pulse" />
                <span className="font-bold tracking-wide">गो सेवा परमो धर्मः</span>
                <span className="text-amber-700/60">•</span>
                <span>Devbhoomi Rishikesh Sanctuary</span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2942] tracking-tight leading-tight">
                Save 250+ Severely Injured &amp; Abandoned Cows in Rishikesh
              </h1>

              <p className="mt-2.5 text-sm sm:text-base text-slate-700 leading-relaxed">
                They cannot cry out in words. Struck down on dark mountain highways by speeding vehicles or abandoned in steep gorges with shattered bones. <strong>Your sacred seva today is the only living prayer standing between their agony and healing.</strong>
              </p>
            </div>

            {/* Interactive Visual Evidence Card with Smooth Crossfade */}
            <div className="bg-white rounded-2xl border border-[#EAE5DD] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-16/10 bg-slate-900 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentMediaImage}
                    src={currentMediaImage}
                    alt="Emergency rescue in progress by Punyakart veterinary team"
                    initial={{ opacity: 0.4, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0.4 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-black/25 pointer-events-none" />

                {/* Location Tag */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10">
                  <MapPin className="w-3 h-3 text-red-400" />
                  <span>Punyakart Sanctuary, Rishikesh</span>
                </div>

                {/* Status Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-700/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md border border-emerald-400/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                  <span>24/7 ICU Veterinary Care</span>
                </div>

                {/* Caption */}
                <div className="absolute bottom-2.5 left-3 right-3 text-white">
                  <p className="text-xs sm:text-sm font-medium text-slate-100 drop-shadow-xs">
                    {activeMedia === 'story1'
                      ? 'Nandi: Safely hoisted via hydraulic ambulance after highway collision.'
                      : activeMedia === 'story2'
                      ? 'Gauri: Daily antiseptic flush & green fodder bringing recovery after traumatic injury.'
                      : activeMedia === 'story3'
                      ? 'Radha: Recovering peacefully in clean sanctuary shelter beds.'
                      : 'Active Trauma Case #489: Emergency antiseptic dressing and IV hydration.'}
                  </p>
                </div>
              </div>

              {/* Photo Evidence Thumbnails */}
              <div className="p-3 bg-slate-50/90 border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pl-1">
                  Live Proof:
                </span>
                {[
                  { id: 'main', label: 'Current ICU Case', img: CAMPAIGN_ASSETS.heroRescue },
                  { id: 'story1', label: 'Highway Rescue', img: CAMPAIGN_ASSETS.stories.story1 },
                  { id: 'story2', label: 'Wound Dressing', img: CAMPAIGN_ASSETS.stories.story2 },
                  { id: 'story3', label: 'Shelter Recovery', img: CAMPAIGN_ASSETS.stories.story3 },
                ].map((thumb) => (
                  <button
                    key={thumb.id}
                    type="button"
                    onClick={() => setActiveMedia(thumb.id as any)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      activeMedia === thumb.id
                        ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                    }`}
                  >
                    <img
                      src={thumb.img}
                      alt={thumb.label}
                      className="w-5 h-5 rounded-md object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span>{thumb.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Campaign Fundraising Progress with Animated Shimmer Bar */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#EAE5DD] shadow-xs space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Raised by 485 Devotees
                  </span>
                  <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0F2942]">
                    ₹ {CAMPAIGN_METRICS.raisedINR.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-medium text-slate-500 block">Required Target</span>
                  <span className="font-bold text-slate-700 text-sm sm:text-base">
                    ₹ {CAMPAIGN_METRICS.targetINR.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Progress Bar with Shimmer Beam */}
              <div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 via-[#9F3D00] to-[#E85D04] rounded-full relative overflow-hidden shadow-xs"
                    initial={{ width: 0 }}
                    animate={{ width: `${CAMPAIGN_METRICS.percentAchieved}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span className="text-[#9F3D00] font-bold flex items-center gap-1">
                    <Sparkle className="w-3.5 h-3.5 fill-[#9F3D00]" />
                    {CAMPAIGN_METRICS.percentAchieved}% Funded
                  </span>
                  <span className="text-slate-500">485 Kind Souls Donated</span>
                  <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-bold">
                    ⏳ {CAMPAIGN_METRICS.daysLeft} Days Left
                  </span>
                </div>
              </div>

              {/* Social Proof Quote */}
              <div className="pt-2.5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600 italic">
                <span className="text-base leading-none text-[#9F3D00] font-serif">“</span>
                <span>
                  Without timely green fodder and surgical dressings, deep road wounds turn septic in 48 hours. Every rupee brings tangible healing.
                  <strong className="not-italic text-slate-800 block mt-0.5">— Dr. Alok Nautiyal, Chief Veterinary Officer</strong>
                </span>
              </div>
            </div>

            {/* Quick Share Strip */}
            <div className="flex items-center gap-2 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Share on WhatsApp</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs min-h-[38px]"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied' : 'Share'}</span>
              </motion.button>
            </div>

          </motion.div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: PRIORITY DONATION TABS CARD (Front & Center)                 */}
          {/* ========================================================================= */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-6 sticky top-20"
          >
            <div className="bg-white rounded-3xl border-2 border-[#9F3D00]/30 shadow-xl overflow-hidden">
              
              {/* Header Ribbon */}
              <div className="bg-gradient-to-r from-[#0F2942] via-[#153454] to-[#1E3A5F] text-white px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Select Donation Seva</span>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-white">
                    Make a Difference Today
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onOpenTaxModal}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  80G 50% Tax Saved
                </button>
              </div>

              {/* 3 PRIORITY DONATION TABS with Animated Sliding Indicator */}
              <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/90 p-1.5 gap-1.5 relative">
                {/* Tab 1: One-Time */}
                <button
                  id="tab-one-time-donation"
                  type="button"
                  onClick={() => setActiveDonationTab('one-time')}
                  className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer min-h-[52px] ${
                    activeDonationTab === 'one-time'
                      ? 'text-[#9F3D00] font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {activeDonationTab === 'one-time' && (
                    <motion.div
                      layoutId="activeDonationHeroTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-amber-200 ring-2 ring-[#9F3D00]/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-col items-center">
                    <Heart className={`w-4 h-4 mb-0.5 ${activeDonationTab === 'one-time' ? 'fill-[#9F3D00] text-[#9F3D00]' : ''}`} />
                    <span className="text-xs sm:text-sm leading-tight">One-Time Gift</span>
                    <span className="text-[10px] text-slate-400 leading-none mt-0.5">Direct Cash Seva</span>
                  </span>
                </button>

                {/* Tab 2: Sponsor Supplies */}
                <button
                  id="tab-supplies-donation"
                  type="button"
                  onClick={() => setActiveDonationTab('supplies')}
                  className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer min-h-[52px] ${
                    activeDonationTab === 'supplies'
                      ? 'text-[#9F3D00] font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {activeDonationTab === 'supplies' && (
                    <motion.div
                      layoutId="activeDonationHeroTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-amber-200 ring-2 ring-[#9F3D00]/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-col items-center">
                    <Package className="w-4 h-4 mb-0.5 text-amber-700" />
                    <span className="text-xs sm:text-sm leading-tight">Sponsor Items</span>
                    <span className="text-[10px] text-amber-800 font-bold leading-none mt-0.5">
                      {cartItemCount > 0 ? `${cartItemCount} Selected` : 'Fodder & Meds'}
                    </span>
                  </span>
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 z-20 bg-[#9F3D00] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                      {cartItemCount}
                    </span>
                  )}
                </button>

                {/* Tab 3: Monthly Guardian */}
                <button
                  id="tab-monthly-donation"
                  type="button"
                  onClick={() => setActiveDonationTab('monthly')}
                  className={`relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer min-h-[52px] ${
                    activeDonationTab === 'monthly'
                      ? 'text-[#0F2942] font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {activeDonationTab === 'monthly' && (
                    <motion.div
                      layoutId="activeDonationHeroTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xs border border-blue-200 ring-2 ring-blue-600/20"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex flex-col items-center">
                    <Calendar className="w-4 h-4 mb-0.5 text-blue-700" />
                    <span className="text-xs sm:text-sm leading-tight">Monthly Seva</span>
                    <span className="text-[10px] text-blue-700 font-semibold leading-none mt-0.5">Guardian Sankalp</span>
                  </span>
                </button>
              </div>

              {/* TAB 1: ONE-TIME MONETARY CONTRIBUTION */}
              <AnimatePresence mode="wait">
                {activeDonationTab === 'one-time' && (
                  <motion.div
                    key="one-time"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="p-4 sm:p-6 space-y-4"
                  >
                    {/* Currency Switcher */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">Choose Currency:</span>
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {CURRENCIES.map((curr) => (
                          <button
                            key={curr.code}
                            type="button"
                            onClick={() => handleCurrencyChange(curr)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              selectedCurrency.code === curr.code
                                ? 'bg-white text-[#0F2942] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {curr.code} ({curr.symbol})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preset Amount Grid */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2">
                        Select Impact Preset ({selectedCurrency.symbol}):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {presetAmountsINR.map((preset) => {
                          const converted = Math.round(preset.amount * selectedCurrency.rateFromINR);
                          const isSelected = !customAmount && selectedAmount === converted;

                          return (
                            <motion.button
                              key={preset.amount}
                              whileHover={{ scale: 1.025, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => handleSelectPreset(preset.amount)}
                              className={`p-3 rounded-xl text-left transition-all cursor-pointer border relative flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-gradient-to-b from-amber-50 to-orange-50 border-[#9F3D00] ring-2 ring-[#9F3D00]/30 shadow-xs'
                                  : 'bg-[#FDFBF7] border-slate-200 hover:border-amber-300 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-display font-extrabold text-base sm:text-lg text-slate-900">
                                  {selectedCurrency.symbol}{converted.toLocaleString()}
                                </span>
                                {preset.isPopular && (
                                  <span className="bg-[#9F3D00] text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-2xs">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-600 font-medium line-clamp-1 mt-1">
                                {preset.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Amount Input */}
                    <div>
                      <label
                        htmlFor="unified-custom-amount"
                        className="block text-xs font-bold text-slate-600 mb-1"
                      >
                        Or Enter Custom Amount ({selectedCurrency.symbol}):
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-base">
                          {selectedCurrency.symbol}
                        </div>
                        <input
                          id="unified-custom-amount"
                          type="text"
                          inputMode="numeric"
                          min={Math.ceil(MIN_DONATION_AMOUNT * selectedCurrency.rateFromINR)}
                          max={Math.floor(MAX_DONATION_AMOUNT * selectedCurrency.rateFromINR)}
                          step="1"
                          value={customAmount}
                          onChange={handleCustomChange}
                          placeholder={`e.g. ${Math.round(7500 * selectedCurrency.rateFromINR)}`}
                          className="block w-full pl-9 pr-14 py-3 text-base font-bold text-slate-900 bg-[#FDFBF7] border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#9F3D00] focus:border-transparent outline-none transition-all"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                          {selectedCurrency.code}
                        </div>
                      </div>
                    </div>

                    {/* Live Dynamic Impact Statement */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentDonationINR}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950"
                      >
                        <TrendingUp className="w-4 h-4 text-[#9F3D00] flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">
                          <strong>Your Tangible Impact:</strong> {getImpactMessage(currentDonationINR)}
                        </span>
                      </motion.div>
                    </AnimatePresence>

                    {/* 80G Tax Exemption Toggle */}
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={taxExemptionRequested}
                        onChange={(e) => setTaxExemptionRequested(e.target.checked)}
                        className="rounded border-slate-300 text-[#9F3D00] focus:ring-[#9F3D00]"
                      />
                      <span>
                        Claim <strong>80G Tax Exemption Certificate</strong> (50% Tax Saved for Indian citizens)
                      </span>
                    </label>

                    {/* Donate CTA Button with Heartbeat & Radiant Shadow */}
                    {amountError && <p role="alert" className="text-xs text-red-600">{amountError}</p>}
                    <motion.button
                      id="unified-hero-donate-btn"
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        if (!isValidDonationAmount(currentDonationINR)) {
                          setAmountError(DONATION_AMOUNT_ERROR);
                          return;
                        }
                        setAmountError(null);
                        onDirectDonate(currentDonationAmount, selectedCurrency);
                      }}
                      className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#9F3D00] to-[#B34500] hover:from-[#863300] hover:to-[#9F3D00] text-white font-display font-extrabold text-base sm:text-lg shadow-lg shadow-[#9F3D00]/25 hover:shadow-xl hover:shadow-[#9F3D00]/35 transition-all flex items-center justify-center gap-2.5 cursor-pointer min-h-[50px]"
                    >
                      <motion.span
                        animate={{ scale: [1, 1.25, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      >
                        <Heart className="w-5 h-5 fill-white" />
                      </motion.span>
                      <span>
                        Donate {selectedCurrency.symbol}{currentDonationAmount.toLocaleString()} to Save Gaumata
                      </span>
                    </motion.button>
                  </motion.div>
                )}

                {/* TAB 2: SPONSOR TANGIBLE SUPPLIES */}
                {activeDonationTab === 'supplies' && (
                  <motion.div
                    key="supplies"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="p-4 sm:p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Select Physical Relief Supplies</span>
                        <span className="text-[11px] text-slate-500">Every item is purchased &amp; delivered directly to the sanctuary</span>
                      </div>
                      {cartItemCount > 0 && (
                        <span className="text-xs font-bold text-[#9F3D00] bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                          {cartItemCount} item{cartItemCount > 1 ? 's' : ''} added
                        </span>
                      )}
                    </div>

                    {/* Compact Product List */}
                    <div className="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
                      {PRODUCTS_LIST.map((prod) => {
                        const qty = getProductQty(prod.id);
                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              qty > 0
                                ? 'bg-amber-50/70 border-[#9F3D00] ring-1 ring-[#9F3D00]/20'
                                : 'bg-white border-slate-200 hover:border-amber-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={prod.image}
                                alt={prod.name}
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {prod.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {prod.description}
                                </p>
                                <span className="font-display font-extrabold text-xs text-[#9F3D00]">
                                  ₹{prod.unitPrice.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">/ {prod.unitLabel}</span>
                                </span>
                              </div>
                            </div>

                            {/* Stepper with Micro-Interactions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {qty === 0 ? (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  type="button"
                                  onClick={() => onUpdateQuantity(prod, 1)}
                                  className="px-3 py-1.5 bg-amber-50 hover:bg-[#9F3D00] text-[#9F3D00] hover:text-white border border-amber-300 hover:border-transparent rounded-lg font-bold text-xs transition-all cursor-pointer shadow-2xs"
                                >
                                  + Add
                                </motion.button>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-white border border-amber-300 rounded-lg p-0.5 shadow-2xs">
                                  <motion.button
                                    whileTap={{ scale: 0.88 }}
                                    type="button"
                                    onClick={() => onUpdateQuantity(prod, -1)}
                                    className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                    aria-label="Decrease"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </motion.button>
                                  <span className="w-6 text-center font-bold text-xs text-[#0F2942]">
                                    {qty}
                                  </span>
                                  <motion.button
                                    whileTap={{ scale: 0.88 }}
                                    type="button"
                                    onClick={() => onUpdateQuantity(prod, 1)}
                                    className="w-7 h-7 rounded bg-[#9F3D00] hover:bg-[#863300] text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                                    aria-label="Increase"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </motion.button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Cart Action */}
                    <div className="pt-2 border-t border-slate-100">
                      {cartTotalAmount > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>Total Sponsorship:</span>
                            <span className="font-display font-extrabold text-base text-[#9F3D00]">
                              ₹ {cartTotalAmount.toLocaleString()}
                            </span>
                          </div>
                          <motion.button
                            id="unified-sponsor-supplies-btn"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={onOpenCheckoutWithCart}
                            className="w-full py-3.5 px-6 rounded-xl bg-[#9F3D00] hover:bg-[#863300] text-white font-display font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                          >
                            <Package className="w-5 h-5 text-amber-200" />
                            <span>Sponsor These {cartItemCount} Relief Items (₹ {cartTotalAmount.toLocaleString()})</span>
                          </motion.button>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-center text-xs text-amber-900">
                          Select any item above (like Dry Grass ₹416 or Cattle Feed ₹1,317) to sponsor tangible supplies.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: MONTHLY GUARDIAN RECURRING SEVA */}
                {activeDonationTab === 'monthly' && (
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="p-4 sm:p-6 space-y-4"
                  >
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-950">
                        <strong>Gaumata Guardian Circle:</strong> Protect an abandoned soul every month. You receive personal monthly photo/video updates &amp; annual 80G certificate. Cancel anytime with 1 click.
                      </div>
                    </div>

                    <label className="block text-xs font-bold text-slate-700">
                      Select Monthly Contribution:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {monthlyPresets.map((plan) => {
                        const isSelected = monthlyAmount === plan.amount;
                        return (
                          <motion.button
                            key={plan.amount}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() => setMonthlyAmount(plan.amount)}
                            className={`p-3 rounded-xl text-left transition-all cursor-pointer border flex flex-col justify-between ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-600/30 shadow-xs'
                                : 'bg-[#FDFBF7] border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-display font-extrabold text-base text-slate-900">
                                ₹{plan.amount.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">/ mo</span>
                              </span>
                              {plan.isPopular && (
                                <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-800 font-semibold mt-1 block">
                              {plan.label}
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">
                              {plan.desc}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Monthly Perks List */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Monthly WhatsApp video &amp; medical health report</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Yearly consolidated Form 10BE (80G Tax Exemption)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Temple prayer performed in your family&apos;s name</span>
                      </div>
                    </div>

                    {/* Monthly CTA Button */}
                    <motion.button
                      id="unified-monthly-donate-btn"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => onSelectMonthlyPlan(monthlyAmount)}
                      className="w-full py-3.5 px-6 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-display font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                    >
                      <Calendar className="w-5 h-5 text-blue-200" />
                      <span>Become a Monthly Guardian (₹{monthlyAmount.toLocaleString()}/mo)</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Secure Footer Bar */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Lock className="w-3.5 h-3.5" /> 256-Bit SSL
                </span>
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" /> UPI • GPay • Cards
                </span>
                <span className="text-slate-600">
                  Instant 80G Receipt
                </span>
              </div>

            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
};
