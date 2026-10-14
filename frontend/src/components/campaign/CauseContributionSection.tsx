import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, Minus, Plus } from 'lucide-react';
import { Currency, DonationCartItem, ProductItem } from '../../types/campaign';
import { CURRENCIES } from '../../data/campaigns';
import medicalKitImg from '../../assets/campaigns/medical_kit.png';
import cowFoodImg from '../../assets/campaigns/cow_food.png';
import greenGrassImg from '../../assets/campaigns/green_grass.png';
import dryGrassImg from '../../assets/campaigns/dry_grass.png';
import type { CampaignContent } from '../../types/campaignCms';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../../constants/donation';
import { allocationMaterialsFromProducts, type AllocationMaterial } from './WhereYourMoneyGoes';
import { resolveCampaignQuantityChange } from '../../utils/campaignQuantity.js';

interface CauseContributionSectionProps {
  onDonateAmount: (amount: number, currency: Currency) => void;
  onOpenTaxModal: () => void;
  cart: DonationCartItem[];
  onUpdateCartQty: (product: ProductItem, delta: number) => void;
  customAmountValue: string;
  onCustomAmountChange: (val: string) => void;
  selectedPreset: number | null;
  onPresetChange: (preset: number | null) => void;
  content?: CampaignContent;
  presets?: number[];
  hideDonationOnMobile?: boolean;
}

export interface ImpactCard {
  id: string;
  price: number;
  unit: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  icon?: string;
}

const CONTRIBUTION_CARDS: ImpactCard[] = [
  {
    id: 'c-1',
    price: 416,
    unit: '/ Set',
    title: 'Dry Grass',
    subtitle: 'Nutritious dry grass for cows and animals',
    image: dryGrassImg,
    tag: 'Daily Essential',
    icon: '🌾',
  },
  {
    id: 'c-2',
    price: 416,
    unit: '/ Set',
    title: 'Fresh Green Grass',
    subtitle: 'Fresh green grass for daily nutrition',
    image: greenGrassImg,
    tag: 'Fresh Nutrition',
    icon: '🌱',
  },
  {
    id: 'c-3',
    price: 1317,
    unit: '/ Set',
    title: 'Cow Food 50 KG',
    subtitle: 'High quality balanced nutrition for cows',
    image: cowFoodImg,
    tag: 'High Impact',
    icon: '🐄',
  },
  {
    id: 'c-4',
    price: 416,
    unit: '/ Set',
    title: 'Medical Kit',
    subtitle: 'Medicines & first aid for injured animals',
    image: medicalKitImg,
    tag: 'Life Saver',
    icon: '🩺',
  },
];

export function getCauseContributionCards(content?: CampaignContent): ImpactCard[] {
  const configuredCards = content?.contribution_cards?.filter((card) => card && isValidDonationAmount(card.price)) || [];
  return configuredCards.length
    ? configuredCards.map((card) => ({ ...card, tag: 'Direct Support' }))
    : CONTRIBUTION_CARDS;
}

export function getCauseContributionMaterials(content?: CampaignContent): AllocationMaterial[] {
  return allocationMaterialsFromProducts(getCauseContributionCards(content).map((card) => ({
    name: card.title,
    unitPrice: card.price,
  })));
}

export const CauseContributionSection: React.FC<CauseContributionSectionProps> = ({
  onDonateAmount,
  cart,
  onUpdateCartQty,
  customAmountValue,
  onCustomAmountChange,
  selectedPreset,
  onPresetChange,
  content,
  presets = [1000, 2000, 5000, 10000],
  hideDonationOnMobile = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('c-1');
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // Local stepper values for the card counter [- 1 +] (default 1)
  const cards = getCauseContributionCards(content);
  const configuredPresets = presets.filter((amount) => isValidDonationAmount(amount));
  const validPresets = configuredPresets.length ? configuredPresets : [1000, 2000, 5000, 10000];
  const [stepperValues, setStepperValues] = useState<Record<string, number>>({});

  const quantities = cards.reduce((acc, card) => {
    const item = cart.find(ci => ci.product.id === card.id);
    acc[card.id] = item ? item.quantity : 0;
    return acc;
  }, {} as Record<string, number>);

  // Handle clicking sliding marquee tabs
  const handleSelectTab = (cardId: string) => {
    setActiveTab(cardId);
    setHighlightedCardId(cardId);

    const el = document.getElementById(`impact-card-${cardId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setTimeout(() => {
      setHighlightedCardId((curr) => (curr === cardId ? null : curr));
    }, 1200);
  };

  const toProductItem = (card: ImpactCard): ProductItem => ({
    id: card.id,
    name: card.title,
    unitPrice: card.price,
    unitLabel: card.unit.replace('/', '').trim(),
    fundedUnits: 142,
    targetUnits: 500,
    image: card.image,
    description: card.subtitle,
  });

  // Before adding, +/- changes the prepared quantity. After adding, it changes the cart.
  const handleStepperChange = (card: ImpactCard, cartQuantity: number, delta: number) => {
    const change = resolveCampaignQuantityChange(
      cartQuantity,
      stepperValues[card.id] || 1,
      delta,
    );
    setStepperValues((prev) => ({ ...prev, [card.id]: change.nextStepperQuantity }));
    if (change.target === 'cart') {
      onUpdateCartQty(toProductItem(card), delta);
    }
  };

  // Add the prepared quantity once. After that, use +/- to change the live cart quantity.
  const handleAddToCart = (card: ImpactCard) => {
    if ((quantities[card.id] || 0) > 0) return;
    const addCount = stepperValues[card.id] || 1;
    onUpdateCartQty(toProductItem(card), addCount);
    setStepperValues((prev) => ({ ...prev, [card.id]: addCount }));
    setActiveTab(card.id);
    setHighlightedCardId(card.id);
    setTimeout(() => {
      setHighlightedCardId((curr) => (curr === card.id ? null : curr));
    }, 1000);
  };

  // Preset button clicked
  const handlePresetClick = (amount: number) => {
    if (selectedPreset === amount) {
      onPresetChange(null);
    } else {
      onPresetChange(amount);
      onCustomAmountChange('');
    }
  };

  // Custom amount change
  const handleCustomAmountChange = (val: string) => {
    onCustomAmountChange(val);
    if (val) {
      onPresetChange(null);
    }
  };

  // Calculate total amount
  const productsTotal = cart.reduce((sum, item) => sum + item.quantity * item.product.unitPrice, 0);

  const [amountError, setAmountError] = useState<string | null>(null);
  const customAmountNum = parseDonationAmount(customAmountValue);
  const directDonation = customAmountValue ? (customAmountNum ?? 0) : (selectedPreset || 0);

  const totalAmount = productsTotal + directDonation;
  const displayAmount = totalAmount;

  const handleDonateClick = () => {
    if ((customAmountValue && customAmountNum === null) || !isValidDonationAmount(displayAmount)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    setAmountError(null);
    onDonateAmount(displayAmount, CURRENCIES[0]);
  };

  return (
    <section id="choose-cause" className="py-8 sm:py-10 lg:py-12 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        {/* Heading and benefit copy */}
        <div className="mb-5 sm:mb-6 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.16em] text-[#FF6B00] bg-orange-50 border border-orange-100 rounded-full px-3 py-1 mb-2">
            Choose your seva
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-[#002D62] tracking-tight leading-tight">
            {content?.contribution_heading || <>Choose your <span className="text-[#FF6B00]">contribution</span></>}
          </h2>
          <p className="text-[#5A6E85] text-sm mt-1.5 font-medium leading-relaxed">
            {content?.contribution_subtitle || 'Pick an impact — see exactly what it funds.'}
          </p>
          <p className="mt-2 text-xs sm:text-sm font-semibold text-[#47607D]">
            Your contribution can help provide food, care, and essential supplies where they are needed most.
          </p>
        </div>

        {/* Detailed contribution cards use the same visual hierarchy at every breakpoint. */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
          {cards.map((card) => {
            const inCartQty = quantities[card.id] || 0;
            const stepperVal = stepperValues[card.id] || 1;
            const isHighlighted = highlightedCardId === card.id;
            return (
              <div
                key={card.id}
                id={`impact-card-${card.id}`}
                className={`group rounded-2xl bg-white border overflow-hidden flex flex-col transition-all duration-300 shadow-[0_4px_18px_rgba(0,45,98,0.06)] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(0,45,98,0.12)] ${
                  isHighlighted || inCartQty > 0
                    ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/15'
                    : 'border-slate-200 hover:border-[#FF6B00]/60'
                }`}
              >
                {/* Image and dark category/tag pill */}
                <div className="relative w-full aspect-[4/3] min-h-32 sm:min-h-36 flex items-center justify-center overflow-hidden bg-[#F7FAFC] p-3">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#0F2942]/95 px-2.5 py-1 text-[10px] font-extrabold text-white shadow-sm">
                    {card.tag}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between min-w-0 p-3 sm:p-4">
                  <div>
                    <h3 className="font-display font-extrabold text-base sm:text-lg text-[#002D62] leading-snug break-words">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5A6E85] mt-1.5 leading-relaxed line-clamp-2">
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Unified orange quantity/price control */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex min-h-12 w-full items-stretch overflow-hidden rounded-xl bg-[#FF6B00] text-white shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleStepperChange(card, inCartQty, -1)}
                        className="flex w-1/4 items-center justify-center border-r border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 cursor-pointer"
                        aria-label={`Decrease quantity of ${card.title}`}
                      >
                        <Minus className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(card)}
                        disabled={inCartQty > 0}
                        className="flex min-w-0 flex-1 items-center justify-center px-2 text-sm font-black tabular-nums hover:bg-[#E05300] active:scale-95 cursor-pointer disabled:cursor-default disabled:hover:bg-[#FF6B00]"
                        aria-label={inCartQty > 0
                          ? `${card.title} added, quantity ${inCartQty}, total ₹${(card.price * inCartQty).toLocaleString('en-IN')}`
                          : `Add ${card.title} worth ₹${(card.price * stepperVal).toLocaleString('en-IN')}`}
                      >
                        {inCartQty > 0 ? (
                          <span className="flex flex-col items-center leading-tight">
                            <span>Added ({inCartQty})</span>
                            <span className="text-[10px] font-bold">₹{(card.price * inCartQty).toLocaleString('en-IN')}</span>
                          </span>
                        ) : (
                          `₹${(card.price * stepperVal).toLocaleString('en-IN')}`
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepperChange(card, inCartQty, 1)}
                        className="flex w-1/4 items-center justify-center border-l border-white/35 text-xl font-black hover:bg-[#E05300] active:scale-95 cursor-pointer"
                        aria-label={`Increase quantity of ${card.title}`}
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* MAKE A DONATION Section */}
        <div className={`${hideDonationOnMobile ? 'hidden sm:block ' : ''}rounded-2xl border border-orange-100 bg-[#FFFDFC] p-4 sm:p-5 lg:p-6 shadow-[0_6px_24px_rgba(255,107,0,0.06)]`}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mb-3">
            <div>
              <span className="text-[#47607D] font-extrabold text-xs tracking-[0.16em] uppercase">
                Make a donation
              </span>
              <p className="mt-1 text-sm font-bold text-[#002D62]">Every contribution creates a kinder tomorrow.</p>
            </div>
            <span className="text-[#FF6B00] text-xs font-bold">
              Choose an amount that feels right 🧡
            </span>
          </div>

          {/* Outlined preset buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {validPresets.map((amt) => {
              const isSelected = selectedPreset === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePresetClick(amt)}
                  className={`border-2 rounded-xl min-h-11 py-2 px-1 text-center font-extrabold text-xs sm:text-sm transition-all cursor-pointer ${
                     isSelected
                       ? 'border-[#FF6B00] bg-[#FF6B00] text-white ring-1 ring-[#FF6B00]/30 shadow-2xs'
                      : 'border-slate-300 bg-white text-[#002D62] hover:border-[#FF6B00] hover:bg-[#FFF0E6]/30 active:scale-95'
                  }`}
                >
                  ₹{amt.toLocaleString('en-IN')}
                </button>
              );
            })}
          </div>

          {amountError && <p role="alert" className="mb-2 text-xs font-semibold text-red-600">{amountError}</p>}

          {/* Custom amount and donation CTA stay together in one balanced row. */}
          <div className="mb-3 flex items-stretch gap-2 rounded-xl border-2 border-slate-300 bg-white p-1 focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]/30">
            <label className="relative flex min-w-0 flex-1 items-center">
              <span className="absolute left-3 text-[#FF6B00] font-black text-sm">
                ₹
              </span>
              <input
                type="text"
                inputMode="numeric"
                min={MIN_DONATION_AMOUNT}
                max={MAX_DONATION_AMOUNT}
                step="1"
                aria-label="Donation amount in rupees"
                placeholder={`Enter custom amount (min ₹${MIN_DONATION_AMOUNT})`}
                value={customAmountValue}
                onChange={(e) => { handleCustomAmountChange(e.target.value); setAmountError(null); }}
                className="w-full min-w-0 min-h-11 pl-7 pr-8 py-2 bg-transparent border-0 text-base sm:text-sm font-bold text-[#002D62] placeholder:text-slate-400 focus:outline-hidden transition-colors"
              />
              {customAmountValue && (
                <button
                  type="button"
                  onClick={() => onCustomAmountChange('')}
                  aria-label="Clear donation amount"
                  className="absolute right-0 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </label>

            <button
              type="button"
              onClick={handleDonateClick}
              className="flex min-w-0 flex-1 min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FF6B00] px-2 py-2.5 text-sm font-black text-white shadow-sm transition-all hover:bg-[#E05300] hover:shadow-md active:bg-[#C84800] cursor-pointer"
            >
              <span>🧡</span>
              <span>Donate Now</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>

          {/* Dual trust labels */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-1">
            <div className="flex items-center gap-1.5 text-left">
              <Lock className="w-4 h-4 text-[#FF6B00] flex-shrink-0" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs font-semibold text-[#47607D] leading-tight">
                100% Secure &amp; Tax-Deductible Donation
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-left">
              <ShieldCheck className="w-4 h-4 text-[#FF6B00] flex-shrink-0" aria-hidden="true" />
              <span className="text-[10px] sm:text-xs font-semibold text-[#47607D] leading-tight">
                Your support brings real change
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
