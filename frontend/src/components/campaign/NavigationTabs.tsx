import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, PieChart, Users, HelpCircle } from 'lucide-react';

export const NavigationTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('donation-hub');

  const tabs = [
    { id: 'donation-hub', label: 'Donation Seva (Priority)', icon: Sparkles },
    { id: 'impact-transparency', label: 'Rescues & 100% Transparency', icon: PieChart },
    { id: 'donors', label: 'Donor Blessings', icon: Users },
    { id: 'faq', label: 'FAQs & Visit', icon: HelpCircle },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160;
      for (let i = tabs.length - 1; i >= 0; i--) {
        const el = document.getElementById(tabs[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveTab(tabs[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 130;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="sticky top-[var(--site-header-height)] z-30 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#EAE5DD] shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-2 sm:py-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                onClick={(e) => handleScrollTo(e, tab.id)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap min-h-[36px] transition-all cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/80 border border-slate-200/80 bg-white/50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavTab"
                    className="absolute inset-0 bg-[#0F2942] rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};

