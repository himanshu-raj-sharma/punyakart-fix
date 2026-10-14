import React, { useState } from 'react';
import { resolveCampaignImage } from '../components/campaign/campaignImages';
import { Heart, ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import { DONATION_AMOUNT_ERROR, isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT, parseDonationAmount } from '../constants/donation';
import { CauseContributionSection, getCauseContributionMaterials } from '../components/campaign/CauseContributionSection';
import { FaqSection } from '../components/campaign/FaqSection';
import { HeroSection } from '../components/campaign/HeroSection';
import { ImpactBanner } from '../components/campaign/ImpactBanner';
import { LiveWallOfCompassion } from '../components/campaign/LiveWallOfCompassion';
import { RescueRecoverySection } from '../components/campaign/RescueRecoverySection';
import { RescueStoriesCarousel } from '../components/campaign/RescueStoriesCarousel';
import { TrustPillars } from '../components/campaign/TrustPillars';
import { WhereYourMoneyGoes } from '../components/campaign/WhereYourMoneyGoes';
import type { Currency, DonationCartItem, ProductItem } from '../types/campaign';
import { useRecentDonations } from '../hooks/useRecentDonations';
import { usePublicCampaign } from '../hooks/usePublicCampaign';
import { campaignDonationAvailable, campaignAvailabilityMessage } from '../utils/publicCampaignPolling';

interface SecondCampaignPageProps {
  onOpenCheckout: (amount: number) => void;
  onOpen80GSearch: () => void;
  campaignId?: string;
}

export const SecondCampaignPage: React.FC<SecondCampaignPageProps> = ({
  onOpenCheckout,
  onOpen80GSearch,
  campaignId = 'c2',
}) => {
  const [cart, setCart] = useState<DonationCartItem[]>([]);
  const [customAmountValue, setCustomAmountValue] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1000);
  const { donations: donors, status: donorStatus } = useRecentDonations(`campaign_${campaignId}`);
  const { campaign: campaignData, status: campaignStatus } = usePublicCampaign(campaignId);
  const donationUnavailable = !campaignDonationAvailable(campaignStatus, campaignData);
  const configuredPresets = campaignData?.donation_presets?.filter((amount) => isValidDonationAmount(amount)) || [];
  const presets = configuredPresets.length ? configuredPresets : [1000, 2000, 5000, 10000];

  const updateCartQuantity = (product: ProductItem, delta: number) => {
    setSelectedPreset(null);
    setCustomAmountValue('');
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing) return delta > 0 ? [...current, { product, quantity: delta }] : current;
      const quantity = existing.quantity + delta;
      if (quantity <= 0) return current.filter((item) => item.product.id !== product.id);
      return current.map((item) =>
        item.product.id === product.id ? { ...item, quantity } : item,
      );
    });
  };

  const handlePresetChange = (preset: number | null) => {
    if (preset !== null) setCart([]);
    setSelectedPreset(preset);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmountValue(value);
    if (value) {
      setSelectedPreset(null);
      setCart([]);
    }
  };

  const cartTotal = cart.reduce((total, item) => total + item.product.unitPrice * item.quantity, 0);
  const directAmount = customAmountValue ? (parseDonationAmount(customAmountValue) ?? 0) : (selectedPreset || 0);
  const openDonation = (amount: number) => {
    if (donationUnavailable) return;
    if ((customAmountValue && parseDonationAmount(customAmountValue) === null) || !isValidDonationAmount(amount)) {
      setAmountError(DONATION_AMOUNT_ERROR);
      return;
    }
    setAmountError(null);
    onOpenCheckout(amount);
  };
  const openDonationWithCurrency = (amount: number, _currency: Currency) => openDonation(amount);

  const finalDonationAmount = customAmountValue ? directAmount : (directAmount || cartTotal || 1000);

  return (
    <div className="public-page text-neutral-900 min-h-screen pb-4 sm:pb-0">
      {donationUnavailable && <p role="status" className="p-3 text-sm text-amber-900 bg-amber-50">{campaignAvailabilityMessage(campaignStatus)}</p>}
      <HeroSection
        onDonateClick={() => openDonation(finalDonationAmount)} 
        image={resolveCampaignImage(campaignId, campaignData?.image)}
        title={campaignData?.content?.hero_title || campaignData?.hero_title || campaignData?.title}
        description={campaignData?.content?.hero_subtitle || campaignData?.description}
      />
      {campaignData?.content?.section_visibility?.contribution !== false && <CauseContributionSection
        onDonateAmount={openDonationWithCurrency}
        onOpenTaxModal={onOpen80GSearch}
        cart={cart}
        onUpdateCartQty={updateCartQuantity}
        customAmountValue={customAmountValue}
        onCustomAmountChange={handleCustomAmountChange}
        selectedPreset={selectedPreset}
        onPresetChange={handlePresetChange}
        content={campaignData?.content}
        presets={presets}
        hideDonationOnMobile
      />}
      {campaignData?.content?.section_visibility?.impact !== false && <ImpactBanner status={campaignStatus} content={campaignData?.content} raised={campaignData?.raised} target={campaignData?.target} donors={campaignData?.donors} />}
      {campaignData?.content?.section_visibility?.about !== false && <RescueStoriesCarousel onSupportStory={openDonationWithCurrency} content={campaignData?.content} />}
      {campaignData?.content?.section_visibility?.recovery !== false && <RescueRecoverySection onSupportStory={openDonationWithCurrency} content={campaignData?.content} />}
      <TrustPillars />
      {campaignData?.content?.section_visibility?.allocation !== false && <WhereYourMoneyGoes
        campaignId={campaignId}
        content={campaignData?.content}
        materials={getCauseContributionMaterials(campaignData?.content)}
      />}
      {campaignData?.content?.section_visibility?.donor_wall !== false && <LiveWallOfCompassion donors={donors} status={donorStatus} content={campaignData?.content} />}
      {campaignData?.content?.section_visibility?.faq !== false && <FaqSection content={campaignData?.content} faqs={campaignData?.faqs} />}

      {/* MOBILE STICKY FLOATING DONATION BAR */}
      <div data-mobile-donation-bar className="fixed bottom-0 left-0 right-0 sm:hidden z-40 max-h-[40vh] supports-[height:100dvh]:max-h-[45dvh] overflow-y-auto overscroll-contain bg-white border-t border-slate-200 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
          <span className="text-[#47607D] font-extrabold text-[11px] tracking-wider uppercase">
            MAKE A DONATION
          </span>
          <span className="text-[#FF6B00] text-[10px] font-bold">
            Every rupee creates a kinder tomorrow 🧡
          </span>
        </div>

        <div className="grid grid-cols-2 min-[360px]:grid-cols-4 gap-2 mb-2.5">
          {presets.map((amt) => {
            const isSelected = selectedPreset === amt;
            return (
              <button
                key={amt}
                type="button"
                onClick={() => { handlePresetChange(amt); setCustomAmountValue(''); setAmountError(null); }}
                className={`border-2 rounded-xl min-h-11 py-1.5 px-1 text-center font-extrabold text-[11px] transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#FF6B00] bg-[#FFF0E6] text-[#FF6B00] ring-1 ring-[#FF6B00]/30 shadow-2xs'
                    : 'border-slate-300 bg-white text-[#002D62] hover:border-[#FF6B00] hover:bg-[#FFF0E6]/30 active:scale-95'
                }`}
              >
                ₹{amt.toLocaleString('en-IN')}
              </button>
            );
          })}
        </div>

        <div className="mb-3 flex items-stretch overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-2xs focus-within:border-[#FF6B00] focus-within:ring-1 focus-within:ring-[#FF6B00]/30">
          <div className="relative flex w-1/2 min-w-0 items-center">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FF6B00] font-black text-sm">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            min={MIN_DONATION_AMOUNT}
            max={MAX_DONATION_AMOUNT}
            step="1"
            aria-label="Donation amount in rupees"
            placeholder="Enter custom amount"
            value={customAmountValue}
            onChange={(e) => { handleCustomAmountChange(e.target.value); setAmountError(null); }}
            className="w-full min-w-0 min-h-12 bg-transparent pl-7 pr-10 py-2 text-base font-bold text-[#002D62] placeholder:text-slate-400 focus:outline-hidden"
          />
          {customAmountValue && (
            <button
              type="button"
              onClick={() => setCustomAmountValue('')}
              aria-label="Clear donation amount"
              className="absolute right-0 min-w-11 min-h-11 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
          </div>

          <button
            type="button"
            onClick={() => openDonation(finalDonationAmount)}
            disabled={donationUnavailable}
            className="flex w-1/2 min-w-0 min-h-12 items-center justify-center gap-1 border-l-2 border-orange-200 bg-[#FF6B00] px-2 py-2.5 text-center text-xs font-black leading-tight text-white hover:bg-[#E05300] active:bg-[#C84800] transition-all cursor-pointer"
          >
            <span className="shrink-0">🧡</span>
            <span className="min-w-0 break-words">Donate Now • ₹{finalDonationAmount.toLocaleString('en-IN')}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        {amountError && <p role="alert" className="mb-2 text-xs text-red-600">{amountError}</p>}

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
