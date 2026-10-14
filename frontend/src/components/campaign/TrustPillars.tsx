import React from 'react';
import { ShieldCheck, FileCheck, Lock, Award } from 'lucide-react';

export const TrustPillars: React.FC = () => {
  const pillars = [
    {
      icon: ShieldCheck,
      title: '100% Transparency',
      desc: 'All purchases and feed procurement are tracked and audited by certified accounting professionals.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200'
    },
    {
      icon: FileCheck,
      title: '80G Tax Exemption',
      desc: 'Claim 50% deduction under Section 80G of the Indian Income Tax Act. Instant 80G certificate issued.',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200'
    },
    {
      icon: Award,
      title: 'Section 8 Registered',
      desc: 'Incorporated under the Companies Act 2013 and verified on Govt of India’s NITI Aayog Darpan portal.',
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200'
    },
    {
      icon: Lock,
      title: '256-Bit Safe Payment',
      desc: 'Bank-grade SSL encryption for all UPI, NetBanking, and credit/debit card transactions.',
      color: 'text-purple-600',
      bg: 'bg-purple-50 border-purple-200'
    },
  ];

  return (
    <section className="py-12 bg-white border-b border-[#EAE5DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`p-5 rounded-2xl border ${pillar.bg} transition-all hover:shadow-sm`}
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-2xs mb-3">
                  <Icon className={`w-5 h-5 ${pillar.color}`} />
                </div>
                <h4 className="font-display font-bold text-base text-[#0F2942]">
                  {pillar.title}
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
