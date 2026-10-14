import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Currency } from '../../types/campaign';
import { CURRENCIES } from '../../data/campaigns';
import calfStoryImg from '../../assets/campaigns/story_calf_rescue.jpg';
import monkeyStoryImg from '../../assets/campaigns/story_monkeys_fruit.jpg';
import gauSevaStoryImg from '../../assets/campaigns/story_feed_cows.jpg';
import type { CampaignContent } from '../../types/campaignCms';
import { isValidDonationAmount } from '../../constants/donation';

interface RescueStoriesCarouselProps {
  onSupportStory: (amount: number, currency: Currency) => void;
  content?: CampaignContent;
}

interface RescueCard {
  id: string;
  image: string;
  line1: string;
  line2: string;
  line3: string;
  supportAmount: number;
}

const RESCUE_CARDS: RescueCard[] = [
  {
    id: 'story-1',
    image: calfStoryImg,
    line1: 'Weak & Abandoned,',
    line2: 'Now Safely Healing',
    line3: 'With Tender Care.',
    supportAmount: 1000,
  },
  {
    id: 'story-2',
    image: monkeyStoryImg,
    line1: 'Sacred Vaanar Seva,',
    line2: 'Fresh Bananas For',
    line3: 'Hungry Troops.',
    supportAmount: 1000,
  },
  {
    id: 'story-3',
    image: gauSevaStoryImg,
    line1: 'Pavitra Gau Seva,',
    line2: 'Nutritious Feed For',
    line3: 'Sheltered Cows.',
    supportAmount: 1000,
  },
];

export const RescueStoriesCarousel: React.FC<RescueStoriesCarouselProps> = ({ onSupportStory, content }) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const configuredCards = content?.about_cards?.filter((card) => card && isValidDonationAmount(card.supportAmount)) || [];
  const cards = configuredCards.length ? configuredCards : RESCUE_CARDS;

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section id="rescue-stories" className="py-4 sm:py-6 bg-[#F4F7FA] border-b border-slate-200/80">
      <div className="max-w-4xl lg:max-w-5xl mx-auto px-3 sm:px-6">
        
        {/* Eyebrow Label */}
        <div className="text-left mb-1">
          <span className="text-[#FF6B00] font-black text-[11px] sm:text-[13px] tracking-wider uppercase block">
            {content?.about_eyebrow || 'PROJECT DETAILS'}
          </span>
        </div>

        {/* Section Headline */}
        <div className="text-left mb-3 sm:mb-4">
          <h2 className="font-slab font-black text-xl sm:text-2xl md:text-3xl lg:text-[34px] text-[#002D62] tracking-tight leading-tight">
            {content?.about_title || 'About the Campaign'}
          </h2>
        </div>

        {/* Top Urgency Banner Box */}
        <div className="border border-[#FF6B00] sm:border-2 bg-[#FFF0E6] rounded-xl sm:rounded-2xl py-3 px-3 sm:py-5 sm:px-6 mb-3 sm:mb-5 shadow-2xs text-center">
          <h3 className="font-slab font-bold text-[#A82512] text-[11px] xs:text-xs sm:text-sm md:text-base leading-snug sm:leading-tight max-w-3xl mx-auto mb-1.5 uppercase tracking-wide">
            {content?.about_banner_title || 'HONOR YOUR PITRS THROUGH THE SACRED PATH OF GAU SEVA & JEEV SEVA'}
          </h3>
          <p className="font-sans text-[11px] xs:text-xs sm:text-xs md:text-sm text-slate-700 font-normal leading-relaxed max-w-3xl mx-auto">
            {content?.about_banner_description || '“Pitru Paksha” is a sacred time to remember and honor our ancestors with gratitude. This Pitru Paksha, “Punyakart Foundation” invites you to dedicate a heartfelt act of “Gau Seva & Jeev Seva” in their sacred memory. Your contribution can help provide “food, care, rescue, and medical treatment” to abandoned and injured animals. 🙏'}
          </p>
        </div>

        {/* 3 Cards Grid (always 3 columns matching the uploaded mockup image) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          {cards.map((card) => {
            const hasError = imageErrors[card.id];

            return (
              <div
                key={card.id}
                onClick={() => onSupportStory(card.supportAmount, CURRENCIES[0])}
                className="border border-[#FF6B00]/70 sm:border-2 rounded-xl sm:rounded-2xl bg-white p-1.5 xs:p-2 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-[#FF6B00] transition-all duration-300 flex flex-col justify-between cursor-pointer group select-none min-w-0"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSupportStory(card.supportAmount, CURRENCIES[0]);
                  }
                }}
                aria-label={`Support story: ${card.line1} ${card.line2} ${card.line3}`}
              >
                {/* Image Container with Soft Rounded Corners */}
                <div className="w-full aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden bg-[#E2E8F0] mb-1.5 sm:mb-3 flex items-center justify-center relative">
                  {!hasError ? (
                    <img
                      src={card.image}
                      alt={`${card.line1} ${card.line2} ${card.line3}`}
                      className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError(card.id)}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#DFE4EA] text-slate-400">
                      <ImageIcon className="w-5 h-5 sm:w-10 sm:h-10 opacity-60" />
                    </div>
                  )}
                </div>

                {/* Story title uses the full card width below the image on mobile. */}
                <div className="flex-1 w-full min-w-0">
                  <h4 className="font-slab font-black text-sm sm:text-sm md:text-base text-[#9E1B1B] leading-snug break-words">
                    {card.line1} {card.line2} {card.line3}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>

        {/* Seva Sankalp Banner */}
        <div className="mt-4 sm:mt-6 text-center bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-[#FF6B00]/40 rounded-xl py-3 px-4 shadow-xs">
          <p className="font-slab font-black text-xs xs:text-sm sm:text-base md:text-lg text-[#9E1B1B] tracking-wide">
            {content?.about_closing_text || 'जब एक भूखे जीव को भोजन मिलता है, वहीं से सच्ची करुणा की शुरुआत होती है।'}
          </p>
        </div>

      </div>
    </section>
  );
};
