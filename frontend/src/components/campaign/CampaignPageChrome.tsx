import React, { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';

import { navigate } from '../../navigation';
import { LiveDonationToast } from './LiveDonationToast';

interface CampaignPageChromeProps {
  source: string;
  campaignName: string;
  onDonateClick: () => void;
  suppressed?: boolean;
}

export const CampaignPageChrome: React.FC<CampaignPageChromeProps> = ({
  source,
  campaignName,
  onDonateClick,
  suppressed = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    const shareUrl = typeof window === 'undefined' ? '' : window.location.href;
    const shareData = {
      title: campaignName,
      text: 'Support this campaign with Punyakart Foundation and help create compassionate change.',
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share(shareData).catch(() => {});
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard || !shareUrl) return;
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {});
  };

  return (
    <div
      data-campaign-page-chrome
      className="sticky top-[var(--site-header-height)] z-40 border-b border-orange-100/90 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto w-full max-w-[1200px] px-3.5 sm:px-6">
        <div className="flex min-h-12 items-center gap-2 py-1.5 sm:min-h-14 sm:gap-3 sm:py-2">
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="group inline-flex shrink-0 items-center gap-1.5 py-1 text-xs font-bold text-slate-700 transition-colors hover:text-[#FF6B00] sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 transition-all group-hover:-translate-x-0.5 group-hover:text-[#FF6B00]" />
            <span className="hidden xs:inline">Back to </span>
            <span>Campaigns</span>
          </button>

          <div className="flex min-w-0 flex-1 justify-center">
            <LiveDonationToast
              source={source}
              campaignName={campaignName}
              onDonateClick={onDonateClick}
              suppressed={suppressed}
              compact
            />
          </div>

          <button
            type="button"
            onClick={handleShare}
            aria-label={copiedLink ? 'Campaign link copied' : 'Share campaign'}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-orange-300 hover:text-[#FF6B00] active:scale-95 sm:px-3"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{copiedLink ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
