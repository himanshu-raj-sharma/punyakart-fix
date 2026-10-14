import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, ChevronRight, Check } from 'lucide-react';
import { Currency } from '../../types/campaign';
import { CURRENCIES, CAMPAIGN_ASSETS } from '../../data/campaigns';
import rescueStory1 from '../../assets/campaigns/story_calf_rescue.jpg';
import rescueStory2 from '../../assets/campaigns/story_feed_cows.jpg';
import rescueStory3 from '../../assets/campaigns/story_monkeys_fruit.jpg';
import type { CampaignContent } from '../../types/campaignCms';

interface RescueRecoverySectionProps {
  onSupportStory: (amount: number, currency: Currency) => void;
  content?: CampaignContent;
}

interface BeforeAfterStory {
  id: string;
  title: string;
  subtitle: string;
  statusBadge: string;
  beforeImg: string;
  afterImg: string;
  description: string;
  supportAmount: number;
}

const STORIES: BeforeAfterStory[] = [
  {
    id: 'case-1',
    title: 'Life-saving surgery',
    subtitle: 'Tumor removal & recovery',
    statusBadge: 'Treated & Healing',
    beforeImg: rescueStory1,
    afterImg: CAMPAIGN_ASSETS.stories.story3,
    description: 'Rescued with a large, painful growth on the flank from an unsafe, garbage-strewn area. Emergency surgery, daily wound care, and sanctuary rest helped this cow stand strong again.',
    supportAmount: 1000,
  },
  {
    id: 'case-2',
    title: 'Gauri & Nandi',
    subtitle: 'Highway Accident Recovery',
    statusBadge: 'Recovered & Fully Healed',
    beforeImg: rescueStory2,
    afterImg: rescueStory3,
    description: 'Rescued from a severe highway collision with head trauma and broken horn. Emergency surgical intervention, daily wound care, and 45 days of continuous sanctuary care brought full healing.',
    supportAmount: 1000,
  },
  {
    id: 'case-3',
    title: 'Bhola & Rani',
    subtitle: 'Severe Malnutrition Rescue',
    statusBadge: 'Healthy & Energetic',
    beforeImg: rescueStory3,
    afterImg: rescueStory1,
    description: 'Found abandoned in critical condition with extreme dehydration and starvation. Intensive IV fluids, green fodder supplements, and shelter warmth restored them to joyful health.',
    supportAmount: 1500,
  },
];

export const RescueRecoverySection: React.FC<RescueRecoverySectionProps> = ({ onSupportStory, content }) => {
  const stories = content?.recovery_stories?.length ? content.recovery_stories : STORIES;
  return (
    <section id="rescue-and-recovery" className="py-4 sm:py-7 bg-[#F4F7FA] border-b border-slate-200/80">
      <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Header Section */}
        <div className="text-center mb-6 sm:mb-8">
          
          {/* Mint Pill Badge */}
          <div className="inline-block mb-2.5">
            <span className="bg-[#E6F9F2] text-[#00875A] text-[11px] sm:text-xs font-black uppercase tracking-wider px-3.5 py-1 rounded-full border border-emerald-300">
              {content?.recovery_eyebrow || 'RESCUE & RECOVERY'}
            </span>
          </div>

          {/* Headline */}
          <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-black text-[#002D62] tracking-tight">
            {content?.recovery_title || 'Real stories. Real healing.'}
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            {content?.recovery_description || 'See the before & after journey of lives your crowd funding has directly transformed. Swipe to explore more.'}
          </p>
        </div>

        {/* Horizontal Scrolling Container */}
        <div className="relative w-full overflow-x-auto pb-4 pt-1 snap-x snap-mandatory flex gap-4 sm:gap-6 scrollbar-thin scrollbar-thumb-slate-300 no-scrollbar">
          {stories.map((story) => (
            <div
              key={story.id}
              className="min-w-[300px] sm:min-w-[380px] max-w-[420px] flex-shrink-0 snap-center bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden p-4 sm:p-5 flex flex-col justify-between hover:border-orange-300 hover:shadow-md transition-all duration-300"
            >
              <div>
                {/* Card Title, Subtitle, & Status Badge */}
                <div className="mb-3.5">
                  <h3 className="font-display font-black text-lg sm:text-xl text-[#002D62] leading-tight">
                    {story.title}
                  </h3>
                  <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
                    <span className="text-[#FF6B00] font-bold text-xs sm:text-sm">
                      {story.subtitle}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-[#E6F9F2] text-[#00875A] text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <Check className="w-3 h-3 stroke-[3]" />
                      {story.statusBadge}
                    </span>
                  </div>
                </div>

                {/* 2 Images Side-by-Side with BEFORE and AFTER Badges */}
                <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                  
                  {/* BEFORE Image */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 shadow-2xs">
                    <img
                      src={story.beforeImg}
                      alt={`${story.title} Before`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2 bg-[#E11D48] text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                      BEFORE
                    </div>
                  </div>

                  {/* AFTER Image */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 shadow-2xs">
                    <img
                      src={story.afterImg}
                      alt={`${story.title} After`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2 bg-[#059669] text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs">
                      AFTER
                    </div>
                  </div>

                </div>

                {/* Description */}
                <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                  {story.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
