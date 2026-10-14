import React from 'react';
import {
  Heart,
  ShieldCheck,
  Phone,
  Mail,
  FileText,
  PawPrint,
  Landmark,
  BarChart3,
  Globe,
} from 'lucide-react';
import { Language } from '../types';
import { PunyakartLogo } from './PunyakartLogo';
import { formatRegistration, NGO_DETAILS as NGO } from '../constants/ngo';
import { navigate } from '../navigation';
import { translations } from '../data/content';

interface FooterProps {
  language: Language;
  onOpen80GSearch: () => void;
  onOpenAbout: () => void;
  onQuickDonate: () => void;
}

type FooterLink = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
};

function handleSectionLinkClick(event: React.MouseEvent<HTMLAnchorElement>) {
  const link = event.currentTarget;
  if (
    event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    (link.target && link.target !== '_self') || link.hasAttribute('download')
  ) return;

  event.preventDefault();
  if (link.href === window.location.href) {
    document.getElementById(link.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    navigate(`${link.pathname}${link.search}${link.hash}`);
  }
}

export const Footer: React.FC<FooterProps> = ({
  language,
  onOpen80GSearch,
  onOpenAbout,
  onQuickDonate,
}) => {
  const t = translations[language];

  const exploreLinksCol1: FooterLink[] = [
    { id: 'donate', label: t.footerDonate, icon: <Heart className="w-3.5 h-3.5" />, onClick: onQuickDonate },
    { id: '80g', label: t.footer80G, icon: <FileText className="w-3.5 h-3.5" />, onClick: onOpen80GSearch },
    { id: 'about', label: t.footerAbout, icon: <Landmark className="w-3.5 h-3.5" />, onClick: onOpenAbout },
    { id: 'work', label: t.footerWork, icon: <PawPrint className="w-3.5 h-3.5" />, href: '/#what-we-do-section' },
    { id: 'blog', label: 'Blog', icon: <FileText className="w-3.5 h-3.5" />, onClick: () => navigate('/blogs') },
  ];

  const exploreLinksCol2: FooterLink[] = [
    { id: 'impact', label: t.footerImpact, icon: <BarChart3 className="w-3.5 h-3.5" />, href: '/#shelter-census-section' },
    { id: 'privacy', label: t.footerPrivacy, icon: <Globe className="w-3.5 h-3.5" />, onClick: () => navigate('/privacy') },
    { id: 'terms', label: t.footerTerms, icon: <FileText className="w-3.5 h-3.5" />, onClick: () => navigate('/terms') },
    { id: 'refund', label: t.footerRefunds, icon: <FileText className="w-3.5 h-3.5" />, onClick: () => navigate('/refund') },
  ];

  return (
    <footer id="main-footer" className="footer-shell text-white mt-8 pb-6 border-t border-blue-900/30">
      <div className="footer-gold-line" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start min-w-0">
          {/* Column 1: Brand & Mission */}
          <div className="md:col-span-5 space-y-3 min-w-0">
            <div className="flex items-center gap-2">
              <PunyakartLogo size="md" showTagline={false} theme="dark" />
            </div>
            <p className="text-xs text-slate-300/80 leading-relaxed max-w-sm">
              {t.footerBlurb}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/20 text-[10px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                80G Certified • 50% Tax Relief
              </span>
              <span className="text-[10px] font-mono text-amber-300/80 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                80G {formatRegistration(NGO.panNumber80G, 'on certificate')}
              </span>
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <nav className="md:col-span-3 lg:col-span-4 min-w-0" aria-label="Footer">
            <p className="footer-kicker text-[10px] font-black uppercase text-amber-300/90 mb-3">
              {t.footerExplore}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div className="space-y-2">
                {exploreLinksCol1.map((item) => (
                  <div key={item.id}>
                    {item.href ? (
                      <a href={item.href} onClick={handleSectionLinkClick} className="footer-nav-link">
                        <span className="text-amber-400/80">{item.icon}</span>
                        <span>{item.label}</span>
                      </a>
                    ) : (
                      <button type="button" onClick={item.onClick} className="footer-nav-link cursor-pointer">
                        <span className="text-amber-400/80">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {exploreLinksCol2.map((item) => (
                  <div key={item.id}>
                    {item.href ? (
                      <a href={item.href} onClick={handleSectionLinkClick} className="footer-nav-link">
                        <span className="text-amber-400/80">{item.icon}</span>
                        <span>{item.label}</span>
                      </a>
                    ) : (
                      <button type="button" onClick={item.onClick} className="footer-nav-link cursor-pointer">
                        <span className="text-amber-400/80">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </nav>

          {/* Column 3: Contact Details */}
          <div className="md:col-span-4 lg:col-span-3 min-w-0 space-y-2.5">
            <p className="footer-kicker text-[10px] font-black uppercase text-amber-300/90 mb-3">
              {t.footerContact}
            </p>
            <div className="footer-contact-item">
              <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <a href={`tel:${NGO.phone.replace(/\s/g, '')}`} className="text-xs">
                {NGO.phone}
              </a>
            </div>
            <div className="footer-contact-item">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <a href={`mailto:${NGO.email}`} className="text-xs">
                {NGO.email}
              </a>
            </div>
            <div className="footer-contact-item">
              <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <a href={NGO.website} target="_blank" rel="noopener noreferrer" className="text-xs">
                punyakart.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Clean copyright & note */}
        <div className="pt-4 mt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400/80">
          <p>© {new Date().getFullYear()} Punyakart Foundation. All rights reserved.</p>
          <p className="flex items-center gap-1">
            {t.footerMadeWith} <Heart className="w-3 h-3 fill-red-500 text-red-500 inline" /> {t.footerForSouls}
          </p>
        </div>
      </div>
    </footer>
  );
};
