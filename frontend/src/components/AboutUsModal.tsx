import React from 'react';
import { X, Heart, ShieldCheck, MapPin, Phone, Mail, Sparkles } from 'lucide-react';
import { PunyakartLogo } from './PunyakartLogo';
import { formatRegistration, NGO_DETAILS as NGO } from '../constants/ngo';
import { Language } from '../types';
import { translations } from '../data/content';

interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const AboutUsModal: React.FC<AboutUsModalProps> = ({ isOpen, onClose, language }) => {
  if (!isOpen) return null;
  const t = translations[language];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="bg-[#002D62] text-white p-4 sm:p-5 flex items-center justify-between border-b border-blue-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FF6B00] text-white shadow-md">
              <Heart className="w-6 h-6 fill-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                {t.aboutBadge}
              </span>
              <h3 className="font-display font-black text-lg sm:text-xl tracking-tight mt-0.5">
                Punyakart Foundation
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <PunyakartLogo size="lg" lockup />
            <div className="text-left sm:text-right text-xs">
              <span className="text-[#002D62] dark:text-blue-300 font-bold block">{t.about80G}</span>
              <span className="text-[11px] text-neutral-500">{t.aboutLocation}</span>
            </div>
          </div>

          <div>
            <h4 className="font-display font-black text-base text-neutral-900 dark:text-white mb-1.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF6B00]" />
              {t.aboutStoryTitle}
            </h4>
            <p>{t.aboutStoryBody}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/50 text-center">
              <span className="font-display font-black text-lg text-[#FF6B00] block">1,187+</span>
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{t.aboutStatSouls}</span>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-center">
              <span className="font-display font-black text-lg text-red-600 dark:text-red-400 block">54</span>
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{t.aboutStatIcu}</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-center">
              <span className="font-display font-black text-lg text-[#002D62] dark:text-blue-400 block">24x7</span>
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{t.aboutStatAmbulance}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-center">
              <span className="font-display font-black text-lg text-emerald-600 dark:text-emerald-400 block">100%</span>
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{t.aboutStatTax}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <h5 className="font-display font-black text-xs sm:text-sm text-neutral-900 dark:text-white uppercase tracking-wider">
              {t.aboutContactTitle}
            </h5>
            <div className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                <span>
                  <strong>{t.aboutAddress}:</strong> {NGO.address}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#002D62] dark:text-blue-400 shrink-0" />
                <span>
                  <strong>{t.aboutHelpline}:</strong> +91 9105155556
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span>
                  <strong>{t.aboutEmailLabel}:</strong> info@punyakart.com
                </span>
              </p>
              <p className="text-xs pl-6">
                <strong>{t.aboutWebsite}:</strong>{' '}
                <a href="https://punyakart.com" target="_blank" rel="noopener noreferrer" className="underline text-[#FF6B00]">
                  punyakart.com
                </a>
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-[11px] text-[#002D62] dark:text-blue-200">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              {t.aboutCompliance}
            </p>
            <div className="font-mono text-[10px]">
              <span>80G: {formatRegistration(NGO.panNumber80G)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
