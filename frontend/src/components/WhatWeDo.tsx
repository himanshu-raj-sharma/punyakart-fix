import React from 'react';
import {
  Heart,
  HeartHandshake,
  HeartPulse,
  Package,
  PawPrint,
  Plus,
  Soup,
  UtensilsCrossed,
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../data/content';

interface WhatWeDoProps {
  language: Language;
  onJoinChange: () => void;
  onDonateForCause: (causeTitle: string) => void;
}

function DiamondRule({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[#FF6B00]">
      <span className="h-px w-8 sm:w-14 bg-gradient-to-r from-transparent to-[#FF6B00]" />
      <span className="w-1.5 h-1.5 rotate-45 bg-[#FF6B00]" />
      {label ? (
        <span className="text-[11px] sm:text-xs font-black tracking-[0.28em] uppercase">{label}</span>
      ) : null}
      <span className="w-1.5 h-1.5 rotate-45 bg-[#FF6B00]" />
      <span className="h-px w-8 sm:w-14 bg-gradient-to-l from-transparent to-[#FF6B00]" />
    </div>
  );
}

type InitiativeView = {
  id: string;
  causeTitle: string;
  title: string;
  titleClass: string;
  iconBg: string;
  Icon: typeof PawPrint;
  image: string;
  imageAlt: string;
  description: string;
  barClass: string;
  barIconClass: string;
  BarIcon: typeof PawPrint;
  slogan: string;
};

const InitiativeCard: React.FC<{ item: InitiativeView; onDonate: (causeTitle: string) => void }> = ({
  item,
  onDonate,
}) => (
  <article className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl overflow-visible flex flex-col min-w-0 shadow-[0_18px_40px_-22px_rgba(0,45,98,0.35)] border border-slate-100 dark:border-slate-800">
    <div className="relative h-16 sm:h-28 lg:h-44 overflow-hidden rounded-t-xl sm:rounded-t-2xl">
      <img src={item.image} alt={item.imageAlt} className="w-full h-full object-cover" />
    </div>
    <div className="relative flex flex-col flex-1 px-1.5 sm:px-3 lg:px-4 pb-2 sm:pb-3 lg:pb-4 pt-5 sm:pt-7 lg:pt-8 text-center">
      <div
        className={`absolute -top-4 sm:-top-6 lg:-top-7 left-1/2 -translate-x-1/2 w-8 h-8 sm:w-11 sm:h-11 lg:w-14 lg:h-14 rounded-full ${item.iconBg} text-white flex items-center justify-center shadow-lg ring-2 sm:ring-4 ring-white dark:ring-slate-900`}
      >
        <item.Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 lg:w-6 lg:h-6" strokeWidth={2.2} />
      </div>
      <h3 className={`font-display font-black text-[8px] sm:text-[11px] lg:text-sm tracking-wide uppercase leading-tight ${item.titleClass}`}>
        {item.title}
      </h3>
      <Heart className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 mx-auto mt-1 mb-1 sm:mt-1.5 sm:mb-2 fill-[#FF6B00] text-[#FF6B00]" />
      <p className="hidden sm:block text-[11px] lg:text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 flex-1">
        {item.description}
      </p>
      <button
        type="button"
        onClick={() => onDonate(item.causeTitle)}
        className={`mt-auto sm:mt-4 ${item.barClass} hover:opacity-90 text-white rounded-lg sm:rounded-xl px-1 py-1 sm:px-3 sm:py-2.5 flex items-center justify-center gap-1 sm:gap-2 text-[7px] sm:text-[10px] lg:text-[11px] font-bold leading-tight w-full active:scale-98 transition-all cursor-pointer`}
      >
        <item.BarIcon className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 shrink-0 ${item.barIconClass}`} />
        <span className="min-w-0">{item.slogan}</span>
      </button>
    </div>
  </article>
);

export const WhatWeDo: React.FC<WhatWeDoProps> = ({ language, onJoinChange, onDonateForCause }) => {
  const t = translations[language];
  const initiatives: InitiativeView[] = [
    {
      id: 'animal',
      causeTitle: t.initiativeAnimalTitle,
      title: t.initiativeAnimalTitle,
      titleClass: 'text-[#FF6B00]',
      iconBg: 'bg-[#002D62]',
      Icon: PawPrint,
      image: '/animal-welfare.jpeg',
      imageAlt: t.initiativeAnimalTitle,
      description: t.initiativeAnimalDesc,
      barClass: 'bg-[#002D62]',
      barIconClass: 'text-[#FF6B00]',
      BarIcon: PawPrint,
      slogan: t.initiativeAnimalSlogan,
    },
    {
      id: 'disaster',
      causeTitle: t.initiativeDisasterCause,
      title: t.initiativeDisasterTitle,
      titleClass: 'text-[#002D62] dark:text-blue-200',
      iconBg: 'bg-[#FF6B00]',
      Icon: HeartHandshake,
      image: '/disaster-relief.jpeg',
      imageAlt: t.initiativeDisasterTitle,
      description: t.initiativeDisasterDesc,
      barClass: 'bg-[#FF6B00]',
      barIconClass: 'text-white',
      BarIcon: Package,
      slogan: t.initiativeDisasterSlogan,
    },
    {
      id: 'hunger',
      causeTitle: t.initiativeHungerTitle,
      title: t.initiativeHungerTitle,
      titleClass: 'text-[#FF6B00]',
      iconBg: 'bg-[#002D62]',
      Icon: Soup,
      image: '/hunger-relief.jpeg',
      imageAlt: t.initiativeHungerTitle,
      description: t.initiativeHungerDesc,
      barClass: 'bg-[#002D62]',
      barIconClass: 'text-[#FF6B00]',
      BarIcon: UtensilsCrossed,
      slogan: t.initiativeHungerSlogan,
    },
    {
      id: 'medical',
      causeTitle: t.initiativeMedicalTitle,
      title: t.initiativeMedicalTitle,
      titleClass: 'text-[#002D62] dark:text-blue-200',
      iconBg: 'bg-[#FF6B00]',
      Icon: Plus,
      image: '/medical-support.jpeg',
      imageAlt: t.initiativeMedicalTitle,
      description: t.initiativeMedicalDesc,
      barClass: 'bg-[#FF6B00]',
      barIconClass: 'text-white',
      BarIcon: HeartPulse,
      slogan: t.initiativeMedicalSlogan,
    },
  ];

  return (
    <section
      id="what-we-do-section"
      className="bg-white dark:bg-[#0A1120] py-10 sm:py-14 scroll-mt-40 overflow-x-clip"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-6 min-w-0">
        <div className="text-center space-y-3 mb-8 sm:mb-10">
          <DiamondRule label={t.whatWeDoKicker} />
          <h2 className="font-display font-black tracking-tight leading-[1.12] uppercase text-2xl sm:text-4xl lg:text-[2.55rem]">
            <span className="block text-[#002D62] dark:text-blue-100">{t.whatWeDoTitle1}</span>
            <span className="block text-[#FF6B00]">{t.whatWeDoTitle2}</span>
          </h2>
          <div className="flex items-center justify-center gap-2 text-[#FF6B00] pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
            <span className="h-px w-12 sm:w-20 bg-[#FF6B00]/80" />
            <HeartHandshake className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span className="h-px w-12 sm:w-20 bg-[#FF6B00]/80" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
          </div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t.whatWeDoIntro}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-5">
          {initiatives.map((item) => (
            <InitiativeCard key={item.id} item={item} onDonate={onDonateForCause} />
          ))}
        </div>

        <div className="mt-8 sm:mt-10 text-center space-y-2">
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline w-1.5 h-1.5 rounded-full bg-[#FF6B00]/80" />
            <span className="hidden sm:inline h-px w-10 bg-[#FF6B00]/70" />
            {t.whatWeDoTogether}
            <span className="hidden sm:inline h-px w-10 bg-[#FF6B00]/70" />
            <span className="hidden sm:inline w-1.5 h-1.5 rounded-full bg-[#FF6B00]/80" />
          </p>
          <button
            type="button"
            onClick={onJoinChange}
            className="font-display font-black text-base sm:text-lg text-[#002D62] dark:text-blue-200 hover:text-[#FF6B00] transition-colors cursor-pointer"
          >
            {t.whatWeDoCta}
          </button>
        </div>
      </div>
    </section>
  );
};
