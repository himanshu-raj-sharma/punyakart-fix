import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductItem, DonationCartItem, Currency } from '../../types/campaign';
import { CAMPAIGN_ASSETS, PRODUCTS_LIST, CURRENCIES } from '../../data/campaigns';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT } from '../../constants/donation';
import { parseDonationCurrencyAmount } from '../../utils/donationCurrency';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Heart,
  Sparkles,
  Eye,
  FileCheck,
  ShieldCheck,
  Lock,
  Stethoscope,
  Sprout,
  Home,
  Shield,
  Trash2,
  CheckCircle2,
  Check
} from 'lucide-react';

interface MainDonationLayoutProps {
  cart: DonationCartItem[];
  onUpdateCart: (product: ProductItem, delta: number) => void;
  onRemoveCartItem: (productId: string) => void;
  onCheckout: (amount: number, currency: Currency, frequency: 'one-time' | 'monthly') => void;
  onOpenTaxModal: () => void;
}

export const MainDonationLayout: React.FC<MainDonationLayoutProps> = ({
  cart,
  onUpdateCart,
  onRemoveCartItem,
  onCheckout,
}) => {
  // Quantities for the 4 donation products in the grid
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({
    'prod-dry-grass': 1,
    'prod-green-grass': 1,
    'prod-cow-food': 1,
    'prod-medical-kit': 1,
  });

  // Recently added product ID for instant animated feedback
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Selected Preset Amount in the Right Donation Widget
  const [donationFrequency, setDonationFrequency] = useState<'one-time' | 'monthly'>('one-time');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(3000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(CURRENCIES[0]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('PhonePe');

  // Carousel indices
  const [productPage, setProductPage] = useState<number>(0);
  const [storyIndex, setStoryIndex] = useState<number>(0);

  // Live donations board sample stream
  const liveDonations = [
    { name: 'Nandan R.', amount: '₹1', time: 'Just now' },
    { name: 'Rameshwar K.', amount: '₹5,100', time: '2m ago' },
    { name: 'Pooja D.', amount: '₹3,000', time: '4m ago' },
    { name: 'Dr. Arvind P.', amount: '₹2,100', time: '6m ago' },
    { name: 'Anita & Suresh', amount: '₹10,000', time: '12m ago' },
  ];

  // Rescue stories list from Page 3
  const rescueStories = [
    {
      id: 'story-1',
      title: 'His Neck Was Torn Open... Yet He Never Stopped Fighting.',
      highlight: 'His Neck Was Torn Open...',
      rest: 'Yet He Never Stopped Fighting.',
      description:
        'Rescued with a large, painful open wound on the neck from an unsafe, garbage-strewn area. Emergency treatment, daily wound care, and shelter support are helping him recover and live a pain-free life.',
      image: CAMPAIGN_ASSETS.stories.story1,
      recoveryAmount: 1000,
      gender: 'His',
    },
    {
      id: 'story-2',
      title: 'A Huge Open Wound Was Slowly Taking Her Life.',
      highlight: 'A Huge Open Wound Was',
      rest: 'Slowly Taking Her Life.',
      description:
        'Found with a severe open wound and critical injuries. With proper medical care, daily cleaning, nutritious food and a safe shelter, she is now recovering and getting stronger each day.',
      image: CAMPAIGN_ASSETS.stories.story2,
      recoveryAmount: 1000,
      gender: 'Her',
    },
    {
      id: 'story-3',
      title: 'Her Back Was Reduced to A Painful Open Wound.',
      highlight: 'Her Back Was Reduced to',
      rest: 'A Painful Open Wound.',
      description:
        'Rescued with a deep back injury. Regular treatment, medicines and proper care are helping her heal. Today she is safer, healthier and on the path to recovery, all because of kind people like you.',
      image: CAMPAIGN_ASSETS.stories.story3,
      recoveryAmount: 1000,
      gender: 'Her',
    },
  ];

  // Where Your Money Goes table rows from Page 5
  const moneyAllocationRows = [
    {
      id: 'row-med',
      type: 'Medical Treatment',
      icon: <Stethoscope className="w-5 h-5 text-orange-500" />,
      image: CAMPAIGN_ASSETS.moneyGoes.medical,
      whatItCovers: 'Veterinary checkup, medicines, surgery and wound care.',
      supportAmount: '₹416',
      impact: 'Helps an injured cow get treatment and heal.',
      impactIcon: <Heart className="w-4 h-4 text-red-500 fill-red-500" />,
      badgeColor: 'text-[#FF4A22]',
    },
    {
      id: 'row-food',
      type: 'Nutritious Food',
      icon: <Sprout className="w-5 h-5 text-emerald-600" />,
      image: CAMPAIGN_ASSETS.moneyGoes.food,
      whatItCovers: 'Dry fodder, green grass and balanced diet.',
      supportAmount: '₹416',
      impact: 'Provides daily nutrition and keeps them healthy.',
      impactIcon: <Sprout className="w-4 h-4 text-emerald-600" />,
      badgeColor: 'text-emerald-700',
    },
    {
      id: 'row-shelter',
      type: 'Shelter & Care',
      icon: <Home className="w-5 h-5 text-rose-500" />,
      image: CAMPAIGN_ASSETS.moneyGoes.shelter,
      whatItCovers: 'Clean shelter, daily care, staff support and a safe environment.',
      supportAmount: '₹1,317',
      impact: 'Gives a safe home and love to rescued cows.',
      impactIcon: <Home className="w-4 h-4 text-rose-500" />,
      badgeColor: 'text-rose-600',
    },
    {
      id: 'row-rescue',
      type: 'Rescue & Rehabilitation',
      icon: <Shield className="w-5 h-5 text-blue-600" />,
      image: CAMPAIGN_ASSETS.moneyGoes.rescue,
      whatItCovers: 'Rescue operations, transportation and long-term rehabilitation.',
      supportAmount: '₹3,100',
      impact: 'Helps in rescue, recovery and a better life.',
      impactIcon: <Shield className="w-4 h-4 text-blue-600" />,
      badgeColor: 'text-blue-700',
    },
  ];

  // Adjust product quantity in left cards
  const handleProductQuantityChange = (productId: string, delta: number) => {
    setProductQuantities((prev) => {
      const current = prev[productId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Add product from left card to right donation widget
  const handleAddProduct = (product: ProductItem) => {
    const qty = productQuantities[product.id] || 1;
    onUpdateCart(product, qty);
    setSelectedPreset(null);
    setCustomAmount('');
    setRecentlyAddedId(product.id);
    setTimeout(() => {
      setRecentlyAddedId((curr) => (curr === product.id ? null : curr));
    }, 1200);
  };

  // Support emergency case directly
  const handleSupportRescueCase = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount('');
    // Smooth scroll to donation widget on mobile if needed
    const widget = document.getElementById('donation-sidebar-widget');
    if (widget) {
      widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Calculate cart total
  const cartTotal = cart.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);

  // Effective Total for the Donation Widget
  let effectiveTotal = 0;
  if (customAmount) {
    effectiveTotal = parseDonationCurrencyAmount(customAmount, selectedCurrency.rateFromINR) ?? 0;
  } else if (cartTotal > 0) {
    effectiveTotal = cartTotal;
  } else if (selectedPreset !== null) {
    effectiveTotal = selectedPreset;
  }

  // Currency converted value
  const displayTotal = Math.round(effectiveTotal * selectedCurrency.rateFromINR);

  // Handle Preset selection
  const handleSelectPreset = (amount: number) => {
    setSelectedPreset(amount);
    setCustomAmount('');
  };

  // Handle Custom Amount Input
  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    setAmountError(null);
    if (val) {
      setSelectedPreset(null);
    }
  };

  // Primary Donate Now Handler
  const handleDonateNow = (frequency?: 'one-time' | 'monthly') => {
    if (!isValidDonationAmount(effectiveTotal)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    setAmountError(null);
    onCheckout(effectiveTotal, selectedCurrency, frequency || donationFrequency);
  };

  // The 4 main products from Page 2
  const mainProducts = PRODUCTS_LIST.slice(0, 4);

  return (
    <div id="donation-products" className="py-10 sm:py-16 bg-[#F6F8FB] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Two Column Layout: Left Content (lg:col-span-8) + Right Sticky Widget (lg:col-span-4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: Products, Cases, Live Board, Monthly, Table */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* ---------------------------------------------------- */}
            {/* 1. DONATION PRODUCTS SECTION (Page 2)                 */}
            {/* ---------------------------------------------------- */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative">
              
              {/* Section Header */}
              <div className="mb-6">
                <span className="text-[#FF4A22] text-xs sm:text-sm font-extrabold uppercase tracking-wider block mb-1">
                  DONATION PRODUCTS
                </span>
                <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[#0B2545] tracking-tight">
                  Choose your <span className="text-[#FF4A22]">contribution</span>
                </h2>
                <p className="mt-1 text-sm sm:text-base text-slate-500 font-medium">
                  Pick an impact — see exactly what it funds.
                </p>
              </div>

              {/* Navigation Chevrons on sides */}
              <button
                type="button"
                onClick={() => setProductPage((p) => (p === 0 ? 1 : 0))}
                className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-300 shadow-md items-center justify-center text-[#0B2545] hover:bg-slate-50 transition-all z-10 cursor-pointer"
                aria-label="Previous products"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setProductPage((p) => (p === 0 ? 1 : 0))}
                className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-300 shadow-md items-center justify-center text-[#0B2545] hover:bg-slate-50 transition-all z-10 cursor-pointer"
                aria-label="Next products"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* 2x2 Product Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {mainProducts.map((prod) => {
                  const qty = productQuantities[prod.id] || 1;
                  const isRecentlyAdded = recentlyAddedId === prod.id;
                  return (
                    <motion.div
                      key={prod.id}
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between hover:border-amber-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all group"
                    >
                      <div>
                        {/* Image */}
                        <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-50 mb-3.5 flex items-center justify-center border border-slate-100">
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* Title & Short Description */}
                        <h3 className="font-display font-bold text-base sm:text-lg text-[#0B2545] leading-snug">
                          {prod.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {prod.description}
                        </p>
                      </div>

                      {/* Price + Stepper + Add Button */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {/* Price */}
                        <div>
                          <span className="font-display font-black text-[#FF4A22] text-lg sm:text-xl">
                            ₹{prod.unitPrice.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400 font-medium ml-1">
                            /{prod.unitLabel}
                          </span>
                        </div>

                        {/* Stepper & Add */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 rounded-xl border border-slate-200 p-0.5 sm:p-1">
                            <button
                              type="button"
                              onClick={() => handleProductQuantityChange(prod.id, -1)}
                              className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white active:scale-90 transition-all cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-slate-800">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleProductQuantityChange(prod.id, 1)}
                              className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white active:scale-90 transition-all cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Add+ Button with Animated Feedback */}
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className={`font-bold text-xs sm:text-sm px-3.5 py-2 min-h-[36px] rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1 ${
                              isRecentlyAdded
                                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                                : 'bg-[#FF4A22] hover:bg-[#E03A14] text-white shadow-orange-900/10'
                            }`}
                          >
                            <AnimatePresence mode="wait">
                              {isRecentlyAdded ? (
                                <motion.span
                                  key="added"
                                  initial={{ opacity: 0, scale: 0.7 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.7 }}
                                  className="flex items-center gap-1 text-white"
                                >
                                  <Check className="w-3.5 h-3.5 text-white" />
                                  <span>Added!</span>
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="add"
                                  initial={{ opacity: 0, scale: 0.7 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.7 }}
                                  className="flex items-center gap-1"
                                >
                                  <span>Add</span>
                                  <Plus className="w-3.5 h-3.5" />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Carousel Pagination Dots */}
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setProductPage(0)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    productPage === 0 ? 'w-6 bg-[#FF4A22]' : 'w-2.5 bg-slate-300'
                  }`}
                  aria-label="Slide 1"
                />
                <button
                  type="button"
                  onClick={() => setProductPage(1)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    productPage === 1 ? 'w-6 bg-[#0B2545]' : 'w-2.5 bg-slate-300'
                  }`}
                  aria-label="Slide 2"
                />
                <button
                  type="button"
                  onClick={() => setProductPage(0)}
                  className="w-2.5 h-2.5 rounded-full bg-slate-300 cursor-pointer"
                  aria-label="Slide 3"
                />
              </div>

            </div>

            {/* ---------------------------------------------------- */}
            {/* 2. REAL RESCUE STORIES / EMERGENCY CASES (Page 3)    */}
            {/* ---------------------------------------------------- */}
            <div id="rescue-cases" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#FF4A22] text-xs sm:text-sm font-extrabold uppercase tracking-wider block mb-1">
                    DONATION PRODUCTS
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2545]">
                    Choose your <span className="text-[#FF4A22]">contribution</span>
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
                    Pick an impact — see exactly what it funds.
                  </p>
                </div>

                {/* Carousel Chevrons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStoryIndex((i) => (i === 0 ? rescueStories.length - 1 : i - 1))}
                    className="w-8 h-8 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Previous story"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoryIndex((i) => (i === rescueStories.length - 1 ? 0 : i + 1))}
                    className="w-8 h-8 rounded-full border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Next story"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3 Story Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {rescueStories.map((story) => (
                  <motion.div
                    key={story.id}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-amber-300 hover:shadow-lg hover:shadow-slate-200/50 transition-all group"
                  >
                    <div>
                      {/* Story Image */}
                      <div className="w-full aspect-[4/3] bg-slate-100 overflow-hidden relative">
                        <img
                          src={story.image}
                          alt={story.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* Content */}
                      <div className="p-4 sm:p-5">
                        <h3 className="font-display font-bold text-sm sm:text-base text-[#0B2545] leading-snug">
                          {story.highlight}{' '}
                          <span className="text-[#FF4A22]">{story.rest}</span>
                        </h3>
                        <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                          {story.description}
                        </p>
                      </div>
                    </div>

                    {/* Support Button */}
                    <div className="p-4 sm:p-5 pt-0">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => handleSupportRescueCase(story.recoveryAmount)}
                        className="w-full py-2.5 px-3 bg-[#FF4A22] hover:bg-[#E03A14] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer group/btn"
                      >
                        <Heart className="w-3.5 h-3.5 fill-white text-white group-hover/btn:scale-110 transition-transform" />
                        <span>Support {story.gender} Recovery — ₹{story.recoveryAmount.toLocaleString()} →</span>
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Green Callout Alert Box (Page 3) */}
              <div className="bg-[#EBF7EE] border border-[#BDEBD0] rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-[#0B5631]">
                <div className="w-10 h-10 rounded-full bg-white/80 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600 shadow-2xs">
                  <Heart className="w-5 h-5 fill-emerald-600 text-emerald-600" />
                </div>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                  These are not isolated cases. Every day, injured and abandoned Gaumatas arrive at our shelter with life-threatening injuries. Your donation helps us rescue, treat, and protect them before it&apos;s too late.
                </p>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 3. LIVE COMPASSION BOARD & MONTHLY GIVING (Page 4)   */}
            {/* ---------------------------------------------------- */}
            <div id="give-monthly" className="space-y-6">
              
              {/* Top Card: Live compassion board */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="font-display font-extrabold text-base sm:text-lg text-[#0B2545]">
                    Live compassion board
                  </h3>
                </div>
                <p className="text-xs text-slate-500 -mt-2 mb-4 font-medium">
                  Real donations coming in right now
                </p>

                {/* Donation items list / ticker */}
                <div className="space-y-2">
                  {liveDonations.map((donor, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-amber-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-bold text-xs text-amber-800">
                          {donor.name.charAt(0)}
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          {donor.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-[#FF4A22] text-sm sm:text-base">
                          {donor.amount}
                        </span>
                        <span className="text-[10px] text-slate-400">{donor.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Card: Support this cause every month */}
              <div className="bg-gradient-to-r from-[#0B3B6D] to-[#072445] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Left Side: Call to Action */}
                  <div className="md:col-span-7 space-y-4">
                    <span className="text-amber-400 text-xs font-extrabold uppercase tracking-wider block">
                      GIVE EVERY MONTH
                    </span>
                    <h3 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                      Support this cause <br />
                      <span className="text-[#FF6B00]">every month</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md">
                      Your monthly contribution helps us provide regular care, timely support and consistent help to those who need it most.
                    </p>
                    <div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => handleDonateNow('monthly')}
                        className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-[#E85D04] active:scale-95 text-white font-bold text-sm px-6 py-3 rounded-full transition-all shadow-md cursor-pointer"
                      >
                        <span>Donate Monthly →</span>
                      </motion.button>
                    </div>
                  </div>

                  {/* Right Side: 4 Circular Trust Badges */}
                  <div className="md:col-span-5 grid grid-cols-2 gap-4">
                    
                    {/* Badge 1: 100% Transparency */}
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-white/60 flex items-center justify-center text-white mb-2 shadow-sm">
                        <Eye className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">
                        100%<br />Transparency
                      </span>
                    </motion.div>

                    {/* Badge 2: 80G Tax Benefits */}
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-white/60 flex items-center justify-center text-white mb-2 shadow-sm">
                        <FileCheck className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">
                        80G<br />Tax Benefits
                      </span>
                    </motion.div>

                    {/* Badge 3: NGO Verified */}
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-white/60 flex items-center justify-center text-white mb-2 shadow-sm">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">
                        NGO<br />Verified
                      </span>
                    </motion.div>

                    {/* Badge 4: Safe Payment */}
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full border-2 border-white/60 flex items-center justify-center text-white mb-2 shadow-sm">
                        <Lock className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-white leading-tight">
                        Safe<br />Payment
                      </span>
                    </motion.div>

                  </div>

                </div>
              </div>

            </div>

            {/* ---------------------------------------------------- */}
            {/* 4. WHERE YOUR MONEY GOES? TABLE (Page 5)             */}
            {/* ---------------------------------------------------- */}
            <div id="where-money-goes" className="space-y-6">
              <div>
                <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[#0B2545] tracking-tight">
                  Where Your Money <span className="text-[#FF6B00]">Goes?</span>
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                  Your contribution directly helps us rescue, treat and care for injured and abandoned Gaumatas.
                </p>
              </div>

              {/* Table Container */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0B2545] text-white text-xs font-bold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Support Type</th>
                        <th className="py-3.5 px-4 text-center">Image</th>
                        <th className="py-3.5 px-4">What It Covers</th>
                        <th className="py-3.5 px-4 text-center">Your Support</th>
                        <th className="py-3.5 px-4">Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {moneyAllocationRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 font-bold text-[#0B2545] flex items-center gap-2">
                            {row.icon}
                            <span>{row.type}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="w-16 h-12 rounded-lg overflow-hidden mx-auto border border-slate-200 bg-slate-100">
                              <img
                                src={row.image}
                                alt={row.type}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-600 max-w-xs leading-relaxed">
                            {row.whatItCovers}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`font-display font-black text-base ${row.badgeColor}`}>
                              {row.supportAmount}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-700">
                            <div className="flex items-center gap-2">
                              {row.impactIcon}
                              <span>{row.impact}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Card Rows */}
                <div className="md:hidden divide-y divide-slate-100 p-3">
                  {moneyAllocationRows.map((row) => (
                    <div key={row.id} className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm text-[#0B2545]">
                          {row.icon}
                          <span>{row.type}</span>
                        </div>
                        <span className={`font-display font-black text-base ${row.badgeColor}`}>
                          {row.supportAmount}
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                          <img
                            src={row.image}
                            alt={row.type}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <p className="text-xs text-slate-600 leading-snug">
                          {row.whatItCovers}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700 pt-1 border-t border-slate-50">
                        {row.impactIcon}
                        <span>{row.impact}</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Green Callout Alert Box repeated as in Page 5 */}
              <div className="bg-[#EBF7EE] border border-[#BDEBD0] rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-[#0B5631]">
                <div className="w-10 h-10 rounded-full bg-white/80 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600 shadow-2xs">
                  <Heart className="w-5 h-5 fill-emerald-600 text-emerald-600" />
                </div>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                  These are not isolated cases. Every day, injured and abandoned Gaumatas arrive at our shelter with life-threatening injuries. Your donation helps us rescue, treat, and protect them before it&apos;s too late.
                </p>
              </div>

            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: STICKY "MAKE A DONATION" WIDGET (Pages 2-5) */}
          {/* ======================================================== */}
          <div
            id="donation-sidebar-widget"
            className="lg:col-span-4 lg:sticky lg:top-24 space-y-4"
          >
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-lg shadow-slate-200/50">
              
              {/* Header */}
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-display text-xl sm:text-2xl font-black text-[#0B2545]">
                  Make a <span className="text-[#FF4A22]">Donation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  Choose products, fixed amount, or enter your own amount.
                </p>

                {/* Giving Frequency Tabs */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setDonationFrequency('one-time')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      donationFrequency === 'one-time'
                        ? 'bg-white text-[#0B2545] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    One-Time
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setDonationFrequency('monthly')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      donationFrequency === 'monthly'
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Give Monthly 🧡
                  </motion.button>
                </div>
              </div>

              {/* Preset Fixed Amounts Grid (Row 1: 1000, 2000, 3000(Most Donated); Row 2: 5000, 10000) */}
              <div className="space-y-2 mb-4">
                
                {/* Row 1 */}
                <div className="grid grid-cols-3 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleSelectPreset(1000)}
                    className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      selectedPreset === 1000 && !customAmount && cartTotal === 0
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'bg-[#EAF2FA] text-[#0B2545] hover:bg-[#dbe9f6]'
                    }`}
                  >
                    ₹1,000
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleSelectPreset(2000)}
                    className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      selectedPreset === 2000 && !customAmount && cartTotal === 0
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'bg-[#EAF2FA] text-[#0B2545] hover:bg-[#dbe9f6]'
                    }`}
                  >
                    ₹2,000
                  </motion.button>

                  {/* ₹3,000 with "Most Donated" badge */}
                  <div className="relative">
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#0B2545] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-2xs z-10 animate-pulse">
                      Most Donated
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => handleSelectPreset(3000)}
                      className={`w-full py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        selectedPreset === 3000 && !customAmount && cartTotal === 0
                          ? 'bg-[#FF6B00] text-white shadow-xs'
                          : 'bg-[#FF6B00] text-white hover:bg-[#E85D04]'
                      }`}
                    >
                      ₹3,000
                    </motion.button>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleSelectPreset(5000)}
                    className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      selectedPreset === 5000 && !customAmount && cartTotal === 0
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'bg-[#EAF2FA] text-[#0B2545] hover:bg-[#dbe9f6]'
                    }`}
                  >
                    ₹5,000
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => handleSelectPreset(10000)}
                    className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      selectedPreset === 10000 && !customAmount && cartTotal === 0
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'bg-[#EAF2FA] text-[#0B2545] hover:bg-[#dbe9f6]'
                    }`}
                  >
                    ₹10,000
                  </motion.button>
                </div>

              </div>

              {/* Currency Selector */}
              <div className="mb-3">
                <label htmlFor="main-custom-amount" className="block text-xs font-semibold text-slate-600 mb-1">
                  Currency
                </label>
                <div className="relative">
                  <select
                    value={selectedCurrency.code}
                    onChange={(e) => {
                      const found = CURRENCIES.find((c) => c.code === e.target.value);
                      if (found) setSelectedCurrency(found);
                    }}
                    className="w-full bg-[#F6F8FB] border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} {c.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Amount Input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Custom Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    {selectedCurrency.symbol}
                  </span>
                  <input
                    id="main-custom-amount"
                    type="text"
                    inputMode="numeric"
                    min={Math.ceil(MIN_DONATION_AMOUNT * selectedCurrency.rateFromINR)}
                    max={Math.floor(MAX_DONATION_AMOUNT * selectedCurrency.rateFromINR)}
                    step="1"
                    placeholder={`Enter amount (minimum ₹${MIN_DONATION_AMOUNT} equivalent)`}
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className="w-full pl-8 pr-3 py-2 bg-[#F6F8FB] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-[#FF4A22] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {amountError && <p role="alert" className="mb-2 text-xs text-red-600">{amountError}</p>}
              {/* Cart Items List (Selected products from left side) */}
              <div className="mb-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Selected Items
                  </span>
                  {cart.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      {cart.length} product{cart.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                    Click <span className="font-bold text-[#FF4A22]">&ldquo;Add +&rdquo;</span> on products above to see impact.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-9 h-9 object-contain rounded bg-white p-0.5 border border-slate-100 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">
                              {item.product.name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Qty: {item.quantity}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="font-bold text-[#FF4A22] text-xs sm:text-sm">
                            ₹{(item.product.unitPrice * item.quantity).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveCartItem(item.product.id)}
                            className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Select Payment Method Grid (4x2 icons) */}
              <div className="mb-5 pt-3 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-600 mb-2">
                  Select Payment Method
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  {[
                    { id: 'PhonePe', label: 'PhonePe', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                    { id: 'GPay', label: 'GPay', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    { id: 'BHIM', label: 'BHIM', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                    { id: 'Paytm', label: 'Paytm', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                    { id: 'Card', label: 'Card', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { id: 'NetBanking', label: 'NetBanking', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { id: 'Wallet', label: 'Wallet', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                    { id: 'UPI', label: 'UPI', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  ].map((method) => {
                    const isSelected = selectedPaymentMethod === method.id;
                    return (
                      <motion.button
                        key={method.id}
                        whileTap={{ scale: 0.93 }}
                        whileHover={{ scale: 1.03 }}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#FF4A22] bg-orange-50/70 ring-1 ring-[#FF4A22]'
                            : `${method.color} hover:opacity-80`
                        }`}
                      >
                        <span className="font-bold text-[10px] sm:text-[11px] truncate">
                          {method.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Sticky Action: Donation Total + Donate Now */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Donation Total
                  </span>
                  <span className="font-display font-black text-2xl sm:text-3xl text-[#0B2545]">
                    {selectedCurrency.symbol}
                    {displayTotal.toLocaleString()}
                  </span>
                </div>

                <div className="text-right">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => handleDonateNow('one-time')}
                    className="bg-[#FF6B00] hover:bg-[#E85D04] active:scale-95 text-white font-extrabold text-sm sm:text-base px-6 py-3 rounded-2xl transition-all shadow-md shadow-orange-950/20 cursor-pointer flex flex-col items-center"
                  >
                    <span className="flex items-center gap-1">
                      <span>Donate Now</span>
                      <span>→</span>
                    </span>
                    <span className="text-[10px] font-medium text-amber-100">
                      Tax benefits available
                    </span>
                  </motion.button>
                </div>
              </div>

            </div>

            {/* Quick 80G Trust Callout */}
            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-center gap-2 text-xs text-amber-900 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                <strong>50% Tax Deduction:</strong> Instant 80G certificate issued with Govt seal.
              </span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
