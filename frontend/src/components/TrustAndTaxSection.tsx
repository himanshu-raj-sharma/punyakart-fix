import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, HelpCircle, Check, Heart, Stethoscope, Truck, Utensils, Activity, Sparkles, Building2, MapPin } from 'lucide-react';
import { Language } from '../types';
import { translations, airportFAQs } from '../data/content';
import { formatRegistration, NGO_DETAILS as NGO } from '../constants/ngo';

interface TrustAndTaxSectionProps {
  language: Language;
  onSelectCalculatedAmount: (amount: number) => void;
}

export const TrustAndTaxSection: React.FC<TrustAndTaxSectionProps> = ({
  language,
  onSelectCalculatedAmount,
}) => {
  const t = translations[language];
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);

  const shelterOperations = [
    {
      title: 'Green Fodder & Wholesome Straw',
      titleHi: 'हरा चारा व पौष्टिक भूसा (दैनिक 45+ क्विंटल)',
      description: 'Daily fresh green fodder, dry straw, and mineral supplements for 1,140 cows, 5 horses, 6 mules, 2 camels, and 3 donkeys.',
      icon: Utensils,
      color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      tag: 'Daily Essential',
    },
    {
      title: '24x7 Veterinary ICU & Surgeries',
      titleHi: '24 घंटे वेटरनरी डॉक्टर, ऑपरेशन व दवाइयां',
      description: 'Daily IV saline drips, wound dressings, trauma surgery theatre, fracture splints, and antibiotics for 54 critical under-treatment animals.',
      icon: Stethoscope,
      color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      tag: 'Critical ICU',
    },
    {
      title: 'Emergency Rescue Ambulances',
      titleHi: 'आपातकालीन रेस्क्यू एम्बुलेंस नेटवर्क',
      description: 'Hydraulic ambulance vans equipped with stretchers and paramedical rescuers operating round-the-clock attending highway distress calls.',
      icon: Truck,
      color: 'bg-orange-100 dark:bg-orange-950/60 text-[#FF6B00] dark:text-orange-300 border-orange-200 dark:border-orange-800',
      tag: 'Rapid Response',
    },
    {
      title: 'Cooked Porridge & Puppy Nutrition',
      titleHi: 'दलिया, दूध, सप्लीमेंट्स व विशेष आहार',
      description: 'Cooked porridge with turmeric, boiled nutrition, calcium tonics, and multivitamin syrup for 23 dogs, monkeys, rescued birds, and calves.',
      icon: Heart,
      color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      tag: 'Health & Recovery',
    },
  ];

  return (
    <section id="trust-and-operations-section" className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6 scroll-mt-40">
      {/* Operations & Transparency Card with Soothing Eye-Friendly Theme */}
      <div className="rounded-3xl p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-2xl bg-[#002D62] text-white shrink-0 shadow-md">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-[#002D62] dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                  {t.trustOpsTitle}
                </span>
                <span className="text-[10px] font-black text-[#FF6B00]">{t.about80G}</span>
              </div>
              <h3 className="font-display font-black text-xl sm:text-2xl mt-1 text-neutral-900 dark:text-white">
                {t.whatWeDoTitle1} {t.whatWeDoTitle2}
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">
                {t.whatWeDoIntro}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/90 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 self-start md:self-auto text-xs shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-neutral-900 dark:text-white">{t.about80G}</p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{t.instantTaxBenefit}</p>
            </div>
          </div>
        </div>

        {/* 4 Operations Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {shelterOperations.map((op, idx) => {
            const Icon = op.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between hover:border-[#FF6B00]/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className={`p-2 rounded-xl border ${op.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-neutral-600 dark:text-neutral-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                      {op.tag}
                    </span>
                  </div>

                  <h4 className="font-display font-black text-sm text-neutral-900 dark:text-white mb-1">
                    {op.title}
                  </h4>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {op.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Official Verified Registrations Bar (Eye-Friendly, Clean Contrast) */}
        <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#FF6B00]" />
              <span className="font-display font-black text-xs sm:text-sm text-neutral-900 dark:text-white">
                Official 80G Tax Exemption:
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-neutral-800 dark:text-neutral-200 font-mono font-bold text-[11px] shadow-2xs">
                <span className="text-[#002D62] dark:text-blue-400 font-sans font-bold">80G URN:</span> {formatRegistration(NGO.panNumber80G)}
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              Registered Office: {NGO.address}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectCalculatedAmount(5000)}
            className="py-2.5 px-5 rounded-xl bg-[#FF6B00] hover:bg-[#E05300] text-white font-display font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20 active:scale-98 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Support Shelter with ₹5,000</span>
          </button>
        </div>
      </div>

      {/* FAQs Accordion */}
      <div className="rounded-3xl p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-[#FF6B00] border border-orange-200 dark:border-orange-800/60">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-lg sm:text-xl text-neutral-900 dark:text-white">
              {t.faqTitle}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Clear answers regarding donations, 80G tax certificates & shelter visits
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {airportFAQs.map((faq, idx) => {
            const isExpanded = expandedFAQ === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFAQ(isExpanded ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 font-bold text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 hover:text-[#FF6B00] dark:hover:text-orange-400 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                    {faq.question}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-slate-200/50 dark:border-slate-800">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
