import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Heart, Globe, FileText, ChevronDown, Menu, X, Search } from 'lucide-react';
import { Language } from '../types';
import { SITE_LANGUAGES, getLanguageMeta } from '../data/languages';
import { PunyakartLogo } from './PunyakartLogo';
import { useDonorAuth } from './DonorAuthContext';
import { navigate } from '../navigation';
import { translations } from '../data/content';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenQuickDonate: () => void;
  onOpen80GSearch: (mode?: '80g' | 'receipt') => void;
  onOpenAbout: () => void;
  onOpenLogin?: () => void;
}

type NavItem =
  | { id: string; labelKey: string; kind: 'about' | '80g-menu' }
  | { id: string; labelKey: string; kind: 'hash'; href: string }
  | { id: string; labelKey: string; kind: 'path'; href: string };

const NAV_ITEMS: NavItem[] = [
  { id: 'about', labelKey: 'navAbout', kind: 'about' },
  { id: 'crowd', labelKey: 'navCrowd', kind: 'path', href: '/campaigns' },
  { id: 'work', labelKey: 'navWork', kind: 'hash', href: '#what-we-do-section' },
  { id: 'impact', labelKey: 'navImpact', kind: 'hash', href: '#shelter-census-section' },
  { id: 'stories', labelKey: 'navStories', kind: 'hash', href: '#rescue-stories-section' },
  { id: 'blog', labelKey: 'navBlog', kind: 'path', href: '/blogs' },
  { id: 'involved', labelKey: 'navInvolved', kind: 'hash', href: '#donation-engine-section' },
  { id: '80g', labelKey: 'nav80G', kind: '80g-menu' },
];

function scrollToHash(href: string) {
  const id = href.replace('#', '');
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const LanguageDropdown: React.FC<{
  language: Language;
  onLanguageChange: (lang: Language) => void;
  align?: 'left' | 'right';
}> = ({ language, onLanguageChange, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const current = getLanguageMeta(language);
  const t = translations[language];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SITE_LANGUAGES;
    return SITE_LANGUAGES.filter(
      (lang) =>
        lang.label.toLowerCase().includes(q) ||
        lang.native.toLowerCase().includes(q) ||
        lang.id.toLowerCase().includes(q) ||
        lang.short.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        id="header-language-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/10 border border-white/15 text-[12px] font-bold text-white hover:border-[#FF6B00]/50 hover:bg-white/16 transition-colors cursor-pointer max-w-[9.5rem]"
      >
        <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        <span className="truncate">{current.native}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={menuId}
          className={`absolute top-[calc(100%+6px)] z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <label className="relative block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.headerSearchLang}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-2.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-[#FF6B00]"
                aria-label={t.headerSearchLang}
              />
            </label>
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1 overscroll-contain">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-slate-500">{t.headerNoLang}</li>
            ) : (
              filtered.map((lang) => (
                <li key={lang.id} role="option" aria-selected={language === lang.id}>
                  <button
                    type="button"
                    id={`lang-btn-${lang.id}`}
                    onClick={() => {
                      onLanguageChange(lang.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between gap-3 cursor-pointer ${
                      language === lang.id
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-[#FF6B00]'
                        : 'text-neutral-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{lang.native}</span>
                      <span className="block text-[10px] font-semibold opacity-60 truncate">{lang.label}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide opacity-70 shrink-0">{lang.short}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  onOpenQuickDonate,
  onOpen80GSearch,
  onOpenAbout,
  onOpenLogin,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const docsRef = useRef<HTMLDivElement>(null);
  const docsMenuId = useId();
  const mobileMenuId = useId();
  const { isLoggedIn, logout } = useDonorAuth();
  const t = translations[language];

  useLayoutEffect(() => {
    const row = headerRowRef.current;
    if (!row) return;
    const root = document.documentElement;
    const previousHeight = root.style.getPropertyValue('--site-header-height');
    const previousPriority = root.style.getPropertyPriority('--site-header-height');
    const measure = () => {
      const height = row.getBoundingClientRect().height;
      // Ignore hidden print layouts; only the main row determines page offsets.
      if (height > 0) root.style.setProperty('--site-header-height', `${height}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(row);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      if (previousHeight) root.style.setProperty('--site-header-height', previousHeight, previousPriority);
      else root.style.removeProperty('--site-header-height');
    };
  }, [language]);

  // Restore this lock before a newly opened modal installs its own scroll lock.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const style = document.body.style;
    const previousOverflow = ['overflow-x', 'overflow-y'].map((property) => ({
      property,
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    }));
    style.overflow = 'hidden';
    return () => {
      style.removeProperty('overflow');
      previousOverflow.forEach(({ property, value, priority }) => {
        if (value) style.setProperty(property, value, priority);
      });
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = () => setMenuOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', closeMenu);
    window.addEventListener('hashchange', closeMenu);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', closeMenu);
      window.removeEventListener('hashchange', closeMenu);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1280) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!docsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!docsRef.current?.contains(e.target as Node)) setDocsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDocsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [docsOpen]);

  const openDocs = (mode: '80g' | 'receipt') => {
    setDocsOpen(false);
    setMenuOpen(false);
    onOpen80GSearch(mode);
  };

  const handleNav = (item: NavItem) => {
    setMenuOpen(false);
    setDocsOpen(false);
    if (item.kind === 'about') {
      onOpenAbout();
      return;
    }
    if (item.kind === '80g-menu') {
      openDocs('80g');
      return;
    }
    if (item.kind === 'path') {
      navigate(item.href);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (item.kind === 'hash') {
      if (window.location.pathname !== '/') {
        navigate(`/${item.href}`);
      } else if (window.location.hash !== item.href) {
        window.location.hash = item.href;
      }
      window.setTimeout(() => scrollToHash(item.href), 150);
    }
  };

  const docsMenu = (
    <div className="py-1">
      <button
        type="button"
        id="header-80g-certificate-btn"
        onClick={() => openDocs('80g')}
        className="w-full text-left px-3 py-2.5 text-xs font-bold text-neutral-800 dark:text-neutral-100 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-[#FF6B00] cursor-pointer"
      >
        {t.nav80GCertificate || '80G Certificate'}
      </button>
      <button
        type="button"
        id="header-donation-receipt-btn"
        onClick={() => openDocs('receipt')}
        className="w-full text-left px-3 py-2.5 text-xs font-bold text-neutral-800 dark:text-neutral-100 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-[#FF6B00] cursor-pointer"
      >
        {t.navDonationReceipt || 'Donation Receipt'}
      </button>
    </div>
  );

  return (
    <header
      id="main-header"
      className="header-shell fixed inset-x-0 top-0 z-[45] w-full min-w-0 transition-colors"
    >
      <div ref={headerRowRef} className="max-w-[1400px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between xl:justify-start gap-2 sm:gap-3 lg:gap-4 min-w-0 border-b border-white/10">
        <div
          className="header-brand flex items-center gap-2 cursor-pointer min-w-0 xl:flex-none xl:shrink-0"
          onClick={() => {
            setMenuOpen(false);
            if (window.location.pathname !== '/') {
              navigate('/');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <PunyakartLogo
            size="sm"
            showTagline={true}
            theme="dark"
            framed
            className="header-logo origin-left"
          />
        </div>

        <nav className="hidden xl:flex flex-1 items-center justify-center gap-0.5 xl:gap-2 min-w-0" aria-label="Primary">
          {NAV_ITEMS.map((item) =>
            item.kind === '80g-menu' ? (
              <div key={item.id} className="relative shrink-0" ref={docsRef}>
                <button
                  type="button"
                  id="header-80g-portal-btn"
                  aria-haspopup="menu"
                  aria-expanded={docsOpen}
                  aria-controls={docsMenuId}
                  onClick={() => setDocsOpen((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF6B00] text-white font-bold text-[12px] hover:bg-[#E05300] transition-colors cursor-pointer shrink-0"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  {t[item.labelKey]}
                  <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
                </button>
                {docsOpen && (
                  <div
                    id={docsMenuId}
                    role="menu"
                    className="absolute top-[calc(100%+6px)] right-0 z-50 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
                  >
                    {docsMenu}
                  </div>
                )}
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                id={item.kind === 'about' ? 'header-about-btn' : `header-nav-${item.id}`}
                onClick={() => handleNav(item)}
                className="px-2 xl:px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[13px] font-bold text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t[item.labelKey]}
              </button>
            ),
          )}
        </nav>

        <div className="hidden xl:block shrink-0">
          <LanguageDropdown language={language} onLanguageChange={onLanguageChange} />
        </div>

        {isLoggedIn ? (
          <button
            type="button"
            id="header-my-donations-btn"
            onClick={() => {
              setMenuOpen(false);
              navigate('/my-donations');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="hidden xl:block px-2 xl:px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[13px] font-bold text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.navDonorDashboard || 'My Dashboard'}
          </button>
        ) : (
          <button
            type="button"
            id="header-login-btn"
            onClick={() => {
              setMenuOpen(false);
              onOpenLogin?.();
            }}
            className="hidden xl:block px-2 xl:px-2.5 py-1.5 rounded-lg text-[12px] xl:text-[13px] font-bold text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.navLogin || 'Donor Login'}
          </button>
        )}

        <button
          type="button"
          id="header-quick-donate-btn"
          onClick={() => {
            setMenuOpen(false);
            onOpenQuickDonate();
          }}
          className="header-donate ml-auto inline-flex items-center gap-2 shrink-0 px-3.5 sm:px-5 py-2.5 rounded-2xl text-white font-display font-black text-xs sm:text-sm tracking-tight active:scale-98 transition-all cursor-pointer"
        >
          <Heart className="header-donate-heart w-4 h-4 fill-white text-white" />
          <span>{t.navDonate}</span>
        </button>

        <button
          type="button"
          id="header-menu-btn"
          ref={menuButtonRef}
          className="xl:hidden min-h-11 min-w-11 flex items-center justify-center p-2 rounded-xl border border-white/20 bg-white/10 text-white cursor-pointer shrink-0"
          aria-label={menuOpen ? t.headerCloseMenu : t.headerOpenMenu}
          aria-expanded={menuOpen}
          aria-controls={mobileMenuId}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div id={mobileMenuId} className="header-mobile-panel xl:hidden bg-[#001833]">
          <nav className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 flex flex-col gap-1" aria-label="Mobile">
            {NAV_ITEMS.map((item) =>
              item.kind === '80g-menu' ? (
                <div key={item.id} className="rounded-xl bg-[#FF6B00]/15 border border-[#FF6B00]/40 overflow-hidden">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-orange-200 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    {t[item.labelKey]}
                  </p>
                  <button
                    type="button"
                    onClick={() => openDocs('80g')}
                    className="w-full text-left px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
                  >
                    {t.nav80GCertificate || '80G Certificate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDocs('receipt')}
                    className="w-full text-left px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
                  >
                    {t.navDonationReceipt || 'Donation Receipt'}
                  </button>
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item)}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm font-bold cursor-pointer text-blue-50 hover:bg-white/10"
                >
                  {t[item.labelKey]}
                </button>
              ),
            )}
            <div className="pt-2 px-1 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-200/50 mb-0.5">{t.headerLanguage}</p>
              <LanguageDropdown language={language} onLanguageChange={onLanguageChange} align="left" />

              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/my-donations');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm font-bold cursor-pointer bg-white/5 border border-white/10 text-white hover:bg-white/10"
                >
                  {t.navDonorDashboard || 'My Dashboard'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenLogin?.();
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl text-sm font-bold cursor-pointer bg-white/5 border border-white/10 text-white hover:bg-white/10"
                >
                  {t.navLogin || 'Donor Login'}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
