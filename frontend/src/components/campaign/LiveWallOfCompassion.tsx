import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { donorFeedMessage, formatRelativeTime, type PublicDonation, type PublicFeedStatus } from '../../utils/publicDonations';
import type { CampaignContent } from '../../types/campaignCms';

interface LiveWallOfCompassionProps {
  donors: PublicDonation[];
  status?: PublicFeedStatus;
  content?: CampaignContent;
}

export const LiveWallOfCompassion: React.FC<LiveWallOfCompassionProps> = ({ donors, content, status = 'ready' }) => {
  const listToDisplay = donors.slice(0, 10);
  const message = donorFeedMessage(status, donors.length);

  return (
    <section className="py-4 sm:py-7 bg-[#F4F7FA] border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-8">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
            <div className="flex items-start sm:items-center gap-3">
              <div className="relative flex h-3 w-3 mt-1.5 sm:mt-0 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div>
                <h2 className="font-display font-black text-xl sm:text-2xl text-[#002D62] tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
                  {content?.donor_wall_title || 'Live Wall of Compassion'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {content?.donor_wall_description || 'Generous hearts joining hands to protect innocent lives'}
                </p>
              </div>
            </div>

            {/* Verified 80G Badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#E6F9F2] text-[#00875A] text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200 self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-[#00875A]" />
              <span>{content?.donor_wall_badge || 'Verified 80G Receipts Generated'}</span>
            </div>
          </div>

          {/* 2-Column Grid of Donors */}
          {message && <p role="status" className="text-sm text-slate-500 py-4">{message}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {listToDisplay.map((item) => (
              <div
                key={item.id}
                className="bg-[#FDFBF7] hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-display font-extrabold text-[#9F3D00] text-xs">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-display font-bold text-sm sm:text-base text-[#002D62]">
                    {item.name}
                    <time dateTime={item.date} className="block text-xs font-normal text-slate-500">{formatRelativeTime(item.date)}</time>
                  </span>
                </div>
                <div className="bg-[#FFF8F0] border border-amber-200/60 text-[#9F3D00] font-display font-black text-xs sm:text-sm px-3 py-1.5 rounded-xl shadow-2xs">
                  ₹{item.amount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
