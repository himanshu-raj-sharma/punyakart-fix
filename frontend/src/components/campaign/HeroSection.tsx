import React from 'react';
import { motion } from 'motion/react';
import heroImage from '../../assets/campaigns/regenerated_image_1789631745062.jpg';
import { Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onDonateClick: () => void;
  image?: string;
  title?: string;
  description?: string;
}

function renderHeroTitle(title: string): React.ReactNode {
  const emphasis = /((?:Pitru Paksha|Sacred Memory|Navratri|Devotion|Hope|Tuesday|Seva|Gau Seva|Thursday|Gaumata|Special Day|Happiness))/gi;
  const parts = title.split(emphasis);
  return parts.map((part, index) => /(?:Pitru Paksha|Sacred Memory|Navratri|Devotion|Hope|Tuesday|Seva|Gau Seva|Thursday|Gaumata|Special Day|Happiness)/i.test(part)
    ? <span key={`${part}-${index}`} className="text-[#FF6B00] italic">{part}</span>
    : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>);
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onDonateClick, image, title, description }) => {
  return (
    <section id="top" className="relative bg-[#FFFBF5] text-slate-900 pt-6 pb-10 sm:py-12 md:py-16 overflow-hidden border-b border-orange-100">
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Top Tagline */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-100/80 border border-orange-200/80 text-orange-900 font-bold text-[11px] sm:text-xs tracking-wider uppercase mb-4 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>YOUR SMALL DONATION MAKES A BIG CHANGE</span>
        </motion.div>

        {/* Main Headline with Playfair Display Font style */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="font-display text-[1.65rem] sm:text-2xl md:text-4xl font-black text-[#002D62] leading-[1.16] tracking-[-0.035em] mb-4 sm:mb-6"
        >
          {title ? renderHeroTitle(title) : <>This <span className="text-[#FF6B00]">Pitru Paksha</span>, Offer Seva in the <span className="text-[#FF6B00] italic font-playfair font-normal">Sacred Memory</span> of Your Ancestors</>}
        </motion.h1>

        {/* Hero Photo Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-4 border-orange-200/60 aspect-[16/10] sm:aspect-[16/9] max-w-3xl mx-auto mb-6 bg-slate-100"
        >
          <img
            src={image || heroImage}
            alt="Animal rescue and care"
            className="w-full h-full object-cover"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          {/* Subtle gradient scrim at bottom of image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        {/* Subtext description */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="text-xs sm:text-sm md:text-base text-slate-700 max-w-2xl mx-auto leading-relaxed mb-6 font-normal px-2"
        >
          {description || 'Pitru Paksha is a sacred period dedicated to remembering and expressing gratitude towards our ancestors. It is a time to pause, remember those who came before us, and dedicate our thoughts and actions to their memory.'}
        </motion.p>

      </div>
    </section>
  );
};
