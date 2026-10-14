import React, { useState } from 'react';
import { Heart, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { Language } from '../types';
import { rescueStories, translations } from '../data/content';

interface RescueStoriesProps {
  language: Language;
  onDonateForRescue: (amount: number) => void;
}

export const RescueStories: React.FC<RescueStoriesProps> = ({
  language,
  onDonateForRescue,
}) => {
  const t = translations[language];
  const [activeStoryTab, setActiveStoryTab] = useState<'before' | 'after'>('after');

  return (
    <section id="rescue-stories-section" className="max-w-6xl mx-auto px-3 sm:px-6 py-6 scroll-mt-40">
      <div className="text-center mb-6">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#FF6B00] dark:text-orange-300 bg-orange-100 dark:bg-[#FF6B00]/15 px-3.5 py-1 rounded-full border border-orange-200/50 dark:border-orange-500/20">
          {t.storiesKicker}
        </span>
        <h2 className="font-display font-black text-xl sm:text-3xl text-neutral-900 dark:text-white mt-2.5">
          {t.beforeAfterTitle}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto mt-1">
          {t.storiesSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rescueStories.map((story) => (
          <div
            key={story.id}
            className="story-card rounded-3xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-display font-black text-sm sm:text-base text-white">
                  {story.name}
                </h3>
                <span className="text-[10px] font-black text-emerald-200 bg-emerald-400/15 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300/25">
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                  {story.daysInShelter}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="relative rounded-2xl overflow-hidden h-36 bg-[#001226] border border-white/10">
                  <img
                    src={story.beforeImage}
                    alt="Rescue condition before"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                    {t.storiesBefore}
                  </span>
                </div>
                <div className="relative rounded-2xl overflow-hidden h-36 bg-[#001226] border border-white/10">
                  <img
                    src={story.afterImage}
                    alt="Healthy recovered after"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {t.storiesAfter}
                  </span>
                </div>
              </div>

              <p className="text-xs text-blue-100/80 leading-relaxed mb-4 font-medium">
                {story.story}
              </p>
            </div>

            <button
              onClick={() => onDonateForRescue(500)}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer shadow-md shadow-orange-500/20"
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              <span>{t.storiesCta}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Seva Sankalp Banner */}
      <div className="mt-6 sm:mt-8 text-center bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:bg-neutral-800 dark:border-orange-500/30 border border-[#FF6B00]/40 rounded-xl py-3.5 px-4 shadow-xs">
        <p className="font-slab font-black text-xs xs:text-sm sm:text-base md:text-lg text-[#9E1B1B] dark:text-orange-400 tracking-wide">
          जब एक भूखे जीव को भोजन मिलता है, वहीं से सच्ची करुणा की शुरुआत होती है।
        </p>
      </div>
    </section>
  );
};
