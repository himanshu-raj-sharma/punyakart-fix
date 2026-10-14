import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CAMPAIGN_ASSETS } from '../../data/campaigns';
import {
  ShieldCheck,
  FileCheck,
  Eye,
  Activity,
  ArrowRight,
  MapPin,
  PieChart,
  Heart
} from 'lucide-react';

interface CompactImpactAndTrustProps {
  onOpenTaxModal: () => void;
  onDonateClick: () => void;
}

export const CompactImpactAndTrust: React.FC<CompactImpactAndTrustProps> = ({
  onOpenTaxModal,
  onDonateClick,
}) => {
  const [activeStoryTab, setActiveStoryTab] = useState<'nandi' | 'gauri' | 'radha'>('nandi');

  const stories = [
    {
      id: 'nandi',
      name: 'Nandi (Fractured Femur)',
      rescueTag: 'Highway Trauma',
      location: 'Dehradun Bypass, KM 14',
      image: CAMPAIGN_ASSETS.stories.story1,
      before: 'Hit by a high-speed vehicle at midnight. Left bleeding on cold asphalt for 7 hours with shattered bone fragments.',
      after: 'Emergency hydraulic ambulance extraction. 3-stage fiber casting & daily antibiotic dressing. Today, Nandi is walking peacefully!',
      treatment: '₹5,100 funded for casting & surgical steel splint',
    },
    {
      id: 'gauri',
      name: 'Gauri (Deep Flank Wounds)',
      rescueTag: 'Cruelty Rescue',
      location: 'Haridwar Outskirts',
      image: CAMPAIGN_ASSETS.stories.story2,
      before: 'Attacked with corrosive fluid on her flank. Arrived with 400+ necrotic maggots and a life-threatening 104°F septic fever.',
      after: 'Maggot oil extraction, saline hydrotherapy, and sterile paraffin gauze dressing. Her tissue has 95% healed.',
      treatment: '₹2,100 funded for trauma kit & anti-maggot spray',
    },
    {
      id: 'radha',
      name: 'Radha (80ft Ravine Fall)',
      rescueTag: 'Mountain Rescue',
      location: 'Rishikesh Valley Slopes',
      image: CAMPAIGN_ASSETS.stories.story3,
      before: 'Slipped into a rocky gorge during heavy rains. Dehydrated and hypothermic with head contusions and fear.',
      after: 'Harnessed out by rescue volunteers. Given warm electrolyte mash and fresh lucerne grass in our recovery pen.',
      treatment: '₹3,000 funded for emergency winch rigging & nutrition',
    },
  ];

  const currentStory = stories.find((s) => s.id === activeStoryTab) || stories[0];

  const allocationSlices = [
    { label: 'Fresh Green Fodder & Dry Hay', percent: 45, amount: '₹5,62,500', color: 'bg-amber-500' },
    { label: 'Critical Surgery, IV Drips & Antiseptics', percent: 30, amount: '₹3,75,000', color: 'bg-[#9F3D00]' },
    { label: 'Highway Rescue Ambulance & Winch Logistics', percent: 15, amount: '₹1,87,500', color: 'bg-blue-600' },
    { label: 'Sanctuary Bedding & 24/7 Caretakers', percent: 10, amount: '₹1,25,000', color: 'bg-emerald-600' },
  ];

  return (
    <section id="impact-transparency" className="py-8 sm:py-12 bg-[#FBF9F5] border-y border-[#EAE5DD]">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-xs font-bold text-[#9F3D00] uppercase tracking-wider bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            100% Verified Impact &amp; Transparency
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F2942] mt-2">
            See Where Your Seva Goes &amp; Lives You Save
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Every rupee is accounted for with public purchase bills, veterinary discharge logs, and instant 80G tax certificates.
          </p>
        </div>

        {/* 4 Trust Badges Grid with Gentle Hover */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-start gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#0F2942]">80G Tax Exemption</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">50% Deduction on donations under Indian IT Act</p>
              <button
                type="button"
                onClick={onOpenTaxModal}
                className="text-[11px] font-bold text-[#9F3D00] hover:underline mt-1 inline-block cursor-pointer"
              >
                View Certificate →
              </button>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-start gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#0F2942]">Section 8 Registered</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Govt of India MCA Certified (CIN: U85300UR)</p>
              <span className="text-[11px] font-semibold text-blue-700 mt-1 inline-block">12A &amp; CSR Approved</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-start gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#0F2942]">100% Direct Spending</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Zero middleman. 100% goes to food &amp; medical care</p>
              <span className="text-[11px] font-semibold text-amber-800 mt-1 inline-block">Audited Bills</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-start gap-3 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-[#0F2942]">Open Sanctuary</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Visit anytime in Rishikesh, meet rescued cows</p>
              <span className="text-[11px] font-semibold text-purple-700 mt-1 inline-block">Open 9AM - 5PM Daily</span>
            </div>
          </motion.div>
        </div>

        {/* 2-Column Split: Real Rescues Left vs Financial Allocation Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left: Real Rescue Recovery Stories */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#9F3D00]" />
                <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2942]">
                  Real Rescues &amp; Recovery Journeys
                </h3>
              </div>
              
              {/* Tabs for stories with animated pill */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {stories.map((story) => {
                  const isStoryActive = activeStoryTab === story.id;
                  return (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setActiveStoryTab(story.id as any)}
                      className={`relative px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isStoryActive ? 'text-[#9F3D00]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isStoryActive && (
                        <motion.div
                          layoutId="activeStoryTabPill"
                          className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10">{story.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Story Details with AnimatePresence */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStory.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center"
              >
                <div className="sm:col-span-5 relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 shadow-xs group">
                  <img
                    src={currentStory.image}
                    alt={currentStory.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-2 left-2 bg-[#0F2942]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    {currentStory.rescueTag}
                  </span>
                  <span className="absolute bottom-2 left-2 right-2 text-white text-[10px] bg-black/60 px-2 py-0.5 rounded truncate">
                    📍 {currentStory.location}
                  </span>
                </div>

                <div className="sm:col-span-7 space-y-2.5">
                  <h4 className="font-display font-bold text-base text-[#0F2942]">
                    {currentStory.name}
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-red-50/80 border border-red-200/70 rounded-xl">
                      <span className="font-bold text-red-900 block mb-0.5">The Tragedy:</span>
                      <p className="text-slate-700">{currentStory.before}</p>
                    </div>

                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/70 rounded-xl">
                      <span className="font-bold text-emerald-900 block mb-0.5">The Recovery:</span>
                      <p className="text-slate-700">{currentStory.after}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      ✨ {currentStory.treatment}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={onDonateClick}
                      className="text-[#9F3D00] font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Help Another</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Heartfelt Caretaker Reflection */}
            <div className="p-3 bg-[#FDFBF7] rounded-xl border border-amber-200/70 flex items-start gap-2.5 text-xs text-slate-600 italic">
              <Heart className="w-4 h-4 text-[#9F3D00] fill-[#9F3D00]/20 flex-shrink-0 mt-0.5" />
              <span>
                “Seeing {currentStory.name.split(' ')[0]}&apos;s fear dissolve as fresh grass is placed before them gives our entire veterinary rescue team the stamina to continue working through freezing nights.”
              </span>
            </div>
          </div>

          {/* Right: Where Every Rupee Goes (Audited Allocation) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-700" />
                <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2942]">
                  Where Every Rupee Goes
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                100% Audited
              </span>
            </div>

            {/* Allocation Stacked Bar with smooth entry */}
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 p-0.5 border border-slate-200">
              {allocationSlices.map((slice) => (
                <div
                  key={slice.label}
                  className={`h-full ${slice.color} first:rounded-l-full last:rounded-r-full transition-all`}
                  style={{ width: `${slice.percent}%` }}
                  title={`${slice.label}: ${slice.percent}%`}
                />
              ))}
            </div>

            {/* Allocation Breakdown List */}
            <div className="space-y-2.5 pt-1">
              {allocationSlices.map((slice) => (
                <div
                  key={slice.label}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#FDFBF7] border border-slate-100 hover:border-amber-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${slice.color} flex-shrink-0`} />
                    <span className="font-medium text-slate-700">{slice.label}</span>
                  </div>
                  <div className="text-right flex-shrink-0 font-display font-bold text-slate-900">
                    <span>{slice.percent}%</span>
                    <span className="text-[10px] text-slate-400 block font-normal">{slice.amount}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Direct Link to Donate Seva */}
            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={onDonateClick}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0F2942] hover:bg-[#1a3c5e] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <span>Sponsor Fodder &amp; Surgery Now</span>
                <span>→</span>
              </motion.button>
            </div>

            {/* Transparency Note */}
            <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
              <span>Public ledger of all veterinary invoices updated monthly.</span>
              <span className="font-bold text-blue-800">100% Tax Deductible</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
