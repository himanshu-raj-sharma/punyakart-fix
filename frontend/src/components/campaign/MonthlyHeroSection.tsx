import React from 'react';
import { Repeat, Heart, Check, Sparkles, Shield, Video } from 'lucide-react';

interface MonthlyHeroSectionProps {
  onSelectMonthlyPlan: (amount: number) => void;
}

export const MonthlyHeroSection: React.FC<MonthlyHeroSectionProps> = ({ onSelectMonthlyPlan }) => {
  const plans = [
    {
      id: 'plan-1',
      title: 'Sponsor 1 Cow',
      amount: 1500,
      period: '/ month',
      description: 'Provides daily fresh green fodder, clean drinking water, and regular veterinary checkups.',
      badge: 'Most Loved',
      isPopular: true
    },
    {
      id: 'plan-2',
      title: 'Sponsor 2 Cows',
      amount: 3000,
      period: '/ month',
      description: 'Covers full nutritional intake and protective medical trauma supplements for 2 rescued cows.',
      isPopular: false
    },
    {
      id: 'plan-3',
      title: 'Critical Trauma Patron',
      amount: 5000,
      period: '/ month',
      description: 'Funds active post-surgery recovery, daily sterile dressings, painkillers, and protein mash.',
      isPopular: false
    }
  ];

  return (
    <section id="monthly-hero" className="py-12 sm:py-16 bg-[#0F2942] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 bg-white/10 backdrop-blur-xs px-3 py-1 rounded-full mb-3 border border-white/15">
            <Repeat className="w-3.5 h-3.5" />
            Monthly Hero Initiative
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
            Support This Sacred Cause Every Month
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            A one-time donation saves a life from immediate death; recurring monthly support ensures they heal, eat well, and live peacefully for decades to come.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all ${
                plan.isPopular
                  ? 'bg-gradient-to-b from-[#9F3D00] to-[#732C00] border-2 border-amber-300/60 shadow-xl scale-102'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-xs font-black uppercase px-3 py-0.5 rounded-full shadow-md">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="font-display font-bold text-xl text-white">
                  {plan.title}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display font-extrabold text-3xl sm:text-4xl text-white">
                    ₹{plan.amount.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-slate-300">{plan.period}</span>
                </div>
                <p className="mt-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {plan.description}
                </p>

                {/* Features */}
                <div className="mt-6 pt-5 border-t border-white/15 space-y-2.5 text-xs text-slate-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    <span>Instant 80G tax receipt on every transaction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-amber-300 flex-shrink-0" />
                    <span>Monthly photo &amp; video update on WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-300 flex-shrink-0" />
                    <span>Cancel or modify anytime with 1 click</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  id={`sponsor-monthly-btn-${plan.id}`}
                  type="button"
                  onClick={() => onSelectMonthlyPlan(plan.amount)}
                  className={`w-full py-3 px-4 rounded-xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    plan.isPopular
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-white/20 hover:bg-white text-white hover:text-slate-900 border border-white/30'
                  }`}
                >
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Join as Monthly Hero</span>
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
