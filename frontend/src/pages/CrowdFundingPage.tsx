import React from 'react';
import { AllCausesBanner } from '../components/campaign/AllCausesBanner';
import { CampaignsDiscoverySection } from '../components/campaign/CampaignsDiscoverySection';
import { FloatingWhatsApp } from '../components/campaign/FloatingWhatsApp';
import type { Language } from '../types';

interface CrowdFundingPageProps {
  language: Language;
  amount: number;
  onAmountAndCauseTitleChange: (amount: number, causeTitle: string) => void;
  onOpenCheckout: (details?: { causeTitle?: string; amount?: number; campaignId?: string }) => void;
  onOpenCampaign: (campaignId: string, campaignTitle: string) => void;
}

const DEFAULT_CAMPAIGN_TITLE = 'Support a campaign';

export const CrowdFundingPage: React.FC<CrowdFundingPageProps> = ({
  language,
  amount,
  onAmountAndCauseTitleChange,
  onOpenCheckout,
  onOpenCampaign,
}) => {
  const openDonation = (
    campaignTitle = DEFAULT_CAMPAIGN_TITLE,
    donationAmount = amount || 500,
    campaignId?: string,
  ) => {
    onAmountAndCauseTitleChange(donationAmount, campaignTitle);
    onOpenCheckout({ causeTitle: campaignTitle, amount: donationAmount, campaignId });
  };

  return (
    <div className="public-page text-slate-900">
      <AllCausesBanner onDonateClick={() => openDonation()} />

      <CampaignsDiscoverySection
        onDonateClick={(campaignTitle, campaignAmount, campaignId) =>
          openDonation(campaignTitle, campaignAmount, campaignId)
        }
        onCampaignClick={onOpenCampaign}
      />

      <FloatingWhatsApp />
    </div>
  );
};
