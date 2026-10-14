import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import type { CampaignContent } from '../../types/campaignCms';
import { publicStat, type PublicFeedStatus } from '../../utils/publicDonations';

export const ImpactBanner: React.FC<{ content?: CampaignContent; raised?: number; target?: number; donors?: number; status?: PublicFeedStatus }> = ({ content, raised, target, donors, status = 'ready' }) => {
  const actualRaised = publicStat(raised);
  const actualTarget = publicStat(target);
  const actualDonors = publicStat(donors);
  const progress = actualRaised !== null && actualTarget !== null && actualTarget > 0
    ? Math.min(100, Math.round(actualRaised / actualTarget * 100)) : null;
  return (
    <section className="py-4 px-3.5 sm:px-4 bg-[#F4F7FA]">
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto space-y-3.5">
        
        {/* Soft pale cream card matching PDF */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative bg-gradient-to-r from-[#FFFDF7] via-[#FFF6EE] to-[#FFFDF7] border border-[#FFD9BE] rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2">
            
            {/* Left Graphic: Glowing Heart with sparkle */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-[#FFF0E6] border border-[#FFD9BE] shadow-inner">
              <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="Heart">
                ❤️
              </span>
            </div>

            {/* Center Text Block */}
            <div className="flex-1 text-center px-1 sm:px-2 min-w-0">
              {/* Eyebrow */}
              <div className="flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-black text-[#FF6B00] uppercase tracking-widest mb-1">
                <Sparkles className="w-2.5 h-2.5 text-[#FFB347]" />
                <span>EVERY RUPEE MATTERS</span>
                <Sparkles className="w-2.5 h-2.5 text-[#FFB347]" />
              </div>

              {/* Headline */}
              <h3 className="font-display font-black text-sm sm:text-base text-[#002D62] leading-snug">
                {content?.impact_title || 'One donation. Multiple lives changed.'}
              </h3>

              {/* Subtext */}
              <p className="text-[10.5px] sm:text-xs text-slate-600 mt-1 leading-relaxed max-w-xs mx-auto">
                {content?.impact_description || 'From flood survivors to injured animals — your crowd contribution reaches those who need it most, fast.'}
              </p>
            </div>

            {/* Right Graphic: Golden Rupee Coins */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-amber-100/70 border border-amber-200 shadow-inner">
              <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="Coins">
                🪙
              </span>
            </div>

          </div>

        </motion.div>

        {/* Progress Bar Card matching Screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs"
        >
          {status !== 'ready' && <p role="status" className="text-sm text-slate-500 mb-3">{status === 'loading' ? 'Loading campaign totals…' : 'Campaign totals are temporarily unavailable.'}</p>}
          {progress !== null && <div className="relative mb-5">
            <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
              <div 
                className="bg-gradient-to-r from-orange-500 to-[#FF6B00] h-full rounded-full relative transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* 29% Pill */}
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(7, Math.min(93, progress))}%` }}>
              <span className="bg-[#FF6B00] text-white font-display font-extrabold text-[11px] px-3 py-0.5 rounded-full shadow-xs border border-white/20">
              {progress}%
              </span>
            </div>
          </div>}

          {/* Three Metrics: Goal, Raised, Donors */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
            
            {/* Goal */}
            <div className="px-2 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF6B00] font-bold text-xs">
                  ₹
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">Goal</span>
              </div>
              <span className="font-display font-black text-sm sm:text-base text-[#002D62]">
                {actualTarget === null ? '—' : actualTarget === 0 ? 'No fixed target' : formatCompactMoney(actualTarget)}
              </span>
            </div>

            {/* Raised */}
            <div className="px-2 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF6B00] font-bold text-xs">
                  ₹
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">Raised</span>
              </div>
              <span className="font-display font-black text-sm sm:text-base text-[#FF6B00]">
                {actualRaised === null ? '—' : formatCompactMoney(actualRaised)}
              </span>
            </div>

            {/* Donors */}
            <div className="px-2 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 font-bold text-xs">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wide">Donors</span>
              </div>
              <span className="font-display font-black text-sm sm:text-base text-[#002D62]">
                {actualDonors === null ? '—' : actualDonors.toLocaleString('en-IN')}
              </span>
            </div>

          </div>

        </motion.div>

      </div>
    </section>
  );
};

function formatCompactMoney(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
}
