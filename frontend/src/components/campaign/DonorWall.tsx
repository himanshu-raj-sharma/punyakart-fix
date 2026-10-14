import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Donor } from '../../types/campaign';
import { Users, Trophy, Clock, Heart, Send, Sparkles, ShieldCheck } from 'lucide-react';

interface DonorWallProps {
  donors: Donor[];
  onAddBlessing: (name: string, message: string) => void;
}

export const DonorWall: React.FC<DonorWallProps> = ({ donors, onAddBlessing }) => {
  const [filter, setFilter] = useState<'recent' | 'top'>('recent');
  const [blessingName, setBlessingName] = useState('');
  const [blessingNote, setBlessingNote] = useState('');
  const [blessingSubmitted, setBlessingSubmitted] = useState(false);

  const displayedDonors = filter === 'top'
    ? [...donors].filter((d) => d.isTop).sort((a, b) => b.amount - a.amount)
    : [...donors].filter((d) => d.isRecent).sort((a, b) => a.id.localeCompare(b.id));

  const handleBlessingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blessingName.trim() || !blessingNote.trim()) return;
    onAddBlessing(blessingName.trim(), blessingNote.trim());
    setBlessingName('');
    setBlessingNote('');
    setBlessingSubmitted(true);
    setTimeout(() => setBlessingSubmitted(false), 4500);
  };

  return (
    <section id="donors" className="py-12 sm:py-16 bg-white border-b border-[#EAE5DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9F3D00] bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-full mb-2">
              <Users className="w-3.5 h-3.5" />
              Community of Gausevaks
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2942]">
              Donor Wall of Gratitude
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Honoring the generous devotees across India and abroad whose timely seva is pulling Gaumata through severe trauma and into recovery.
            </p>
          </div>

          {/* Toggle Tab with Animated Pill */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start md:self-auto relative">
            <button
              id="donor-tab-recent"
              type="button"
              onClick={() => setFilter('recent')}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                filter === 'recent' ? 'text-[#0F2942]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter === 'recent' && (
                <motion.div
                  layoutId="donorFilterPill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Recent Donors</span>
              </span>
            </button>
            <button
              id="donor-tab-top"
              type="button"
              onClick={() => setFilter('top')}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                filter === 'top' ? 'text-[#0F2942]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter === 'top' && (
                <motion.div
                  layoutId="donorFilterPill"
                  className="absolute inset-0 bg-white rounded-lg shadow-xs"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Top Donors</span>
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Donors Grid with Smooth Layout Animation */}
          <motion.div
            layout
            className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {displayedDonors.map((donor) => (
                <motion.div
                  key={donor.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  whileHover={{ y: -2 }}
                  className="bg-[#FDFBF7] rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-amber-300 hover:shadow-xs transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-display font-extrabold text-[#9F3D00] text-sm shadow-2xs">
                          {donor.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-sm text-[#0F2942] leading-tight">
                            {donor.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {donor.timeAgo}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-extrabold text-[#9F3D00] text-base sm:text-lg block">
                          ₹{donor.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {donor.note && (
                      <p className="mt-3 text-xs sm:text-sm text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-100">
                        &ldquo;{donor.note}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      80G Receipt Issued
                    </span>
                    {donor.panNumberMasked && (
                      <span className="font-mono text-slate-500">PAN: {donor.panNumberMasked}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Leave a Blessing Form Card */}
          <div className="lg:col-span-4 bg-gradient-to-br from-amber-50 to-orange-50/70 rounded-2xl border border-amber-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#9F3D00]">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-display font-bold text-lg text-[#0F2942]">
                Leave a Blessing for Gaumata
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Send your prayers and heartfelt blessings. Your holy words are read by our shelter caregivers as they tend to the recovering cows in Rishikesh.
            </p>

            <form onSubmit={handleBlessingSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Your Name / Family
                </label>
                <input
                  type="text"
                  required
                  value={blessingName}
                  onChange={(e) => setBlessingName(e.target.value)}
                  placeholder="e.g. Radhika &amp; Family"
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-[#9F3D00] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Your Blessing / Prayer
                </label>
                <textarea
                  required
                  rows={3}
                  value={blessingNote}
                  onChange={(e) => setBlessingNote(e.target.value)}
                  placeholder="e.g. May Gaumata heal completely and graze freely in the green pastures..."
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-300 text-base sm:text-sm focus:ring-2 focus:ring-[#9F3D00] outline-none resize-none transition-all"
                />
              </div>

              <motion.button
                id="submit-blessing-btn"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-3 bg-[#0F2942] hover:bg-[#1A3F64] text-white font-display font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4 text-amber-300" />
                <span>Post Blessing to Wall</span>
              </motion.button>
            </form>

            <AnimatePresence>
              {blessingSubmitted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-emerald-100/90 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium text-center flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Heart className="w-4 h-4 fill-emerald-600 text-emerald-600 animate-pulse" />
                  <span>🙏 Thank you! Your sacred prayer has been recorded and blessed.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
};
