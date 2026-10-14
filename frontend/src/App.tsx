import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { DonationCard } from './components/DonationCard';
import { DonationModal } from './components/DonationModal';
import { ReceiptModal } from './components/ReceiptModal';
import { StickyMobileBar } from './components/StickyMobileBar';
import { Footer } from './components/Footer';
import { AboutUsModal } from './components/AboutUsModal';
import { Fetch80GModal } from './components/Fetch80GModal';
import { AdminTab } from './admin/adminTypes';
import { DonationSubmission, DonationType, ImpactItem, Language, DonorDedication, DonationSource, pickLocale } from './types';
import { impactItems, translations } from './data/content';
import { DonorAuthProvider } from './components/DonorAuthContext';
import { DonorLoginModal } from './components/DonorLoginModal';
import { migrateLegacyHash, navigate } from './navigation';
import { hydrateNgoDetails } from './constants/ngo';
import { normalizeDonationSource } from './constants/donation';
import { getQuickDonationSource } from './utils/donationSource';
import { CampaignPageChrome } from './components/campaign/CampaignPageChrome';
import { hasGenericMobileDonationBar, observeMobileDonationBar } from './utils/mobileLayout';
import { campaignPathForId, canonicalCampaignId } from './utils/campaignRoutes';
import { parseAppRoute, type ActivePage } from './utils/appRoutes';
import { usePathname } from './hooks/usePathname';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { CrowdFundingPage } from './pages/CrowdFundingPage';
import { LegacyCrowdFundingPage } from './pages/LegacyCrowdFundingPage';
import { SecondCampaignPage } from './pages/SecondCampaignPage';
import { TuesdayCampaignPage } from './pages/TuesdayCampaignPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';

const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })));
const WhatWeDo = lazy(() => import('./components/WhatWeDo').then(({ WhatWeDo }) => ({ default: WhatWeDo })));
const QuickScanScroll = lazy(() => import('./components/QuickScanScroll').then(({ QuickScanScroll }) => ({ default: QuickScanScroll })));
const ImpactTracker = lazy(() => import('./components/ImpactTracker').then(({ ImpactTracker }) => ({ default: ImpactTracker })));
const RescueStories = lazy(() => import('./components/RescueStories').then(({ RescueStories }) => ({ default: RescueStories })));
const TrustAndTaxSection = lazy(() => import('./components/TrustAndTaxSection').then(({ TrustAndTaxSection }) => ({ default: TrustAndTaxSection })));
const FourthCampaignPage = TuesdayCampaignPage;
const LegalPage = lazy(() => import('./pages/LegalPage').then(({ LegalPage }) => ({ default: LegalPage })));
const MyDonationsPage = lazy(() => import('./pages/MyDonationsPage').then(({ MyDonationsPage }) => ({ default: MyDonationsPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then(({ BlogPage }) => ({ default: BlogPage })));
const ThankYouPage = lazy(() => import('./pages/ThankYouPage').then(({ ThankYouPage }) => ({ default: ThankYouPage })));
const PassengerBanner = lazy(() => import('./components/PassengerBanner').then(({ PassengerBanner }) => ({ default: PassengerBanner })));

function pathForAdminTab(tab: AdminTab): string {
  if (tab === 'blogs') return '/admin/blogs';
  if (tab === 'campaigns') return '/admin/campaigns';
  if (tab === 'donors') return '/admin/donors';
  if (tab === 'certificates') return '/admin/certificates';
  if (tab === 'receipt') return '/admin/receipt';
  if (tab === 'manual') return '/admin/manual';
  if (tab === 'staff') return '/admin/staff';
  if (tab === 'autopay') return '/admin/autopay';
  return '/admin';
}

function getLiveCampaignConfig(
  activePage: string,
  campaignId?: string,
): { source: string; campaignName: string } | null {
  const names: Record<string, string> = {
    'second-campaign': 'Pitru Paksha Seva',
    'tuesday-campaign': 'Tuesday Seva',
    'fourth-campaign': 'Gau Seva',
    'fifth-campaign': 'Thursday Gau Seva',
    'birthday-campaign': 'Birthday Seva',
    'navratri-campaign': 'Navratri Seva',
  };
  if (activePage === 'campaign-detail' || Object.prototype.hasOwnProperty.call(names, activePage)) {
    const source = getQuickDonationSource(activePage, campaignId);
    return {
      source,
      campaignName: activePage === 'campaign-detail'
        ? campaignId && campaignId !== 'detail' ? `Campaign ${campaignId}` : 'Rescue & Relief Seva'
        : names[activePage],
    };
  }
  return null;
}

function AppContent() {
  const [language, setLanguage] = useState<Language>('en');
  const [donationType, setDonationType] = useState<DonationType>('one-time');
  const [selectedAmount, setSelectedAmount] = useState<number>(5000); // Default to ₹5,000 (Most Given)
  const [selectedCauseTitle, setSelectedCauseTitle] = useState<string>('Emergency Treatment & Trauma Stabilization');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>();
  const pathname = usePathname();
  const { activePage, adminTab, campaignId } = parseAppRoute(pathname);

  useLayoutEffect(() => {
    if (activePage === 'admin') return;
    return observeMobileDonationBar();
  }, [activePage, campaignId]);

  // Checkout & Receipt Modals State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [is80GSearchOpen, setIs80GSearchOpen] = useState<boolean>(false);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [eightyGReferencePrefill, setEightyGReferencePrefill] = useState<string>('');
  const [portalMode, setPortalMode] = useState<'80g' | 'receipt'>('80g');
  const [lastSubmission, setLastSubmission] = useState<DonationSubmission | null>(() => {
    try {
      const stored = sessionStorage.getItem('punyakart_last_submission');
      return stored ? JSON.parse(stored) as DonationSubmission : null;
    } catch {
      return null;
    }
  });
  const [modalWant80G, setModalWant80G] = useState<boolean>(true);
  const [modalDedication, setModalDedication] = useState<DonorDedication | undefined>(undefined);
  const [modalSource, setModalSource] = useState<DonationSource>('chennai_airport');

  const [, setNgoReady] = useState(0);

  useEffect(() => {
    void hydrateNgoDetails().then(() => setNgoReady((n) => n + 1));
  }, []);

  // Site stays light on all devices (OS dark mode should not change the brand UI).
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('punyakart_theme');
  }, []);

  useEffect(() => {
    document.title =
      activePage === 'crowd' || activePage === 'campaign-detail' || activePage === 'second-campaign' || activePage === 'tuesday-campaign' || activePage === 'fourth-campaign' || activePage === 'fifth-campaign' || activePage === 'birthday-campaign' || activePage === 'navratri-campaign'
        ? 'Campaigns | Punyakart Foundation'
        : 'Punyakart Foundation';
  }, [activePage]);

  // Open 80G / receipt portal from WhatsApp / shared links: /?80g=1&q=… or /?receipt=1&q=…
  useEffect(() => {
    const openFromUrl = () => {
      migrateLegacyHash();
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#/, '').toLowerCase();
      const wantsReceipt =
        params.get('receipt') === '1' ||
        params.get('receipt') === 'true' ||
        hash === 'receipt' ||
        hash === 'donation-receipt';
      const wants80g =
        params.get('80g') === '1' ||
        params.get('80g') === 'true' ||
        hash === '80g' ||
        hash === '80g-certificate';
      if (!wants80g && !wantsReceipt) return;

      const receiptParam = (params.get('receipt') || '').trim();
      const receiptAsQuery =
        receiptParam && receiptParam !== '1' && receiptParam.toLowerCase() !== 'true'
          ? receiptParam
          : '';
      const prefill = (params.get('q') || params.get('txn') || receiptAsQuery || '').trim();
      setPortalMode(wantsReceipt ? 'receipt' : '80g');
      setEightyGReferencePrefill(prefill);
      setIs80GSearchOpen(true);
    };

    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, []);

  const prevActivePageRef = useRef<ActivePage | null>(null);
  useEffect(() => {
    if (prevActivePageRef.current === activePage) return;
    prevActivePageRef.current = activePage;

    if (activePage !== 'crowd' && activePage !== 'campaign-detail' && activePage !== 'second-campaign' && activePage !== 'tuesday-campaign' && activePage !== 'fourth-campaign' && activePage !== 'fifth-campaign' && activePage !== 'birthday-campaign' && activePage !== 'navratri-campaign') return;
    const initialAmount = 1000;
    const item = impactItems.find((i) => i.amount === initialAmount);

    setDonationType('one-time');
    setSelectedAmount(initialAmount);
    setSelectedCauseTitle(item ? pickLocale(item.title, language) : translations[language].fallbackCauseFeed);
  }, [activePage, language]);

  const openDocumentPortal = (mode: '80g' | 'receipt' = '80g') => {
    setPortalMode(mode);
    setIs80GSearchOpen(true);
  };

  const handleSelectAmount = (amount: number, item?: ImpactItem) => {
    setSelectedAmount(amount);
    if (item) {
      setSelectedCauseTitle(pickLocale(item.title, language));
    }
  };

  const openCheckout = (source?: DonationSource) => {
    const finalSource = normalizeDonationSource(source ?? getQuickDonationSource(activePage, campaignId));
    setSelectedCampaignId(finalSource.startsWith('campaign_') ? finalSource.slice('campaign_'.length) : undefined);
    setModalSource(finalSource);
    setIsCheckoutOpen(true);
  };

  const handleQuickDonate = () => {
    if (activePage === 'navratri-campaign') {
      document.getElementById('choose-cause')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    openCheckout();
  };

  const handleInstantDonate = (amount: number, item?: ImpactItem) => {
    setSelectedAmount(amount);
    if (item) {
      setSelectedCauseTitle(pickLocale(item.title, language));
    }
    openCheckout('chennai_airport');
  };

  const handleOpenCheckoutWithDetails = (details?: {
    amount?: number;
    type?: DonationType;
    causeTitle?: string;
    campaignId?: string;
    want80G?: boolean;
    dedication?: DonorDedication;
    source?: DonationSource;
  }) => {
    const nextAmount = details?.amount ?? selectedAmount;
    const nextType = details?.type ?? donationType;
    const nextCauseTitle = details?.causeTitle ?? selectedCauseTitle;
    const nextCampaignId = details?.campaignId ? canonicalCampaignId(details.campaignId) : undefined;
    const nextWant80G = details?.want80G ?? modalWant80G;

    setSelectedAmount(nextAmount);
    setDonationType(nextType);
    setSelectedCauseTitle(nextCauseTitle);
    setSelectedCampaignId(nextCampaignId);
    setModalWant80G(nextWant80G);
    setModalDedication(details?.dedication);
    openCheckout(details?.source || (nextCampaignId ? `campaign_${nextCampaignId}` : undefined));
  };

  const handleCompleteDonation = (submission: DonationSubmission) => {
    setLastSubmission(submission);
    try { sessionStorage.setItem('punyakart_last_submission', JSON.stringify(submission)); } catch {
      // Private-mode/storage failures must not interrupt the verified thank-you flow.
    }
    setIsCheckoutOpen(false);
    navigate('/thank-you');
  };

  if (activePage === 'admin') {
    return (
      <RouteErrorBoundary resetKey={`${activePage}:${adminTab}`}>
      <Suspense fallback={<PageLoading />}>
        <AdminPage
          tab={adminTab}
          onTabChange={(next) => {
            navigate(pathForAdminTab(next));
          }}
          onLeave={() => {
            navigate('/', true);
          }}
        />
      </Suspense>
      </RouteErrorBoundary>
    );
  }

  const liveCampaignConfig = getLiveCampaignConfig(activePage, campaignId);
  const showGenericMobileBar = hasGenericMobileDonationBar(activePage, campaignId);
  const isSharedModalOpen = isCheckoutOpen || isReceiptOpen || isAboutOpen || is80GSearchOpen || isLoginOpen;

  return (
    <div className="print-app min-h-screen min-w-0 bg-[var(--public-surface)] dark:bg-[#070D18] text-neutral-900 dark:text-neutral-50 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <Header
        language={language}
        onLanguageChange={setLanguage}
        onOpenQuickDonate={handleQuickDonate}
        onOpen80GSearch={openDocumentPortal}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Content Area */}
       <main className={`pt-[var(--site-header-height)] flex-1 min-w-0 ${activePage === 'crowd' || activePage === 'campaign-detail' || activePage === 'my-donations' ? 'pb-0' : (activePage === 'second-campaign' || activePage === 'tuesday-campaign' || activePage === 'fourth-campaign' || activePage === 'fifth-campaign' || activePage === 'birthday-campaign' || activePage === 'navratri-campaign') ? 'pb-24 sm:pb-0' : 'pb-16 sm:pb-8'}`}>
         {liveCampaignConfig && (
           <CampaignPageChrome
             source={liveCampaignConfig.source}
             campaignName={liveCampaignConfig.campaignName}
             onDonateClick={handleQuickDonate}
             suppressed={isSharedModalOpen}
           />
         )}
         <RouteErrorBoundary resetKey={pathname}>
         <Suspense fallback={<PageLoading />}>
        {activePage === 'privacy' || activePage === 'terms' || activePage === 'refund' ? (
          <LegalPage kind={activePage} language={language} />
        ) : activePage === 'blogs' ? (
          <BlogPage pathname={pathname} />
        ) : activePage === 'thank-you' ? (
          <ThankYouPage language={language} submission={lastSubmission} />
        ) : activePage === 'my-donations' ? (
          <MyDonationsPage language={language} />
        ) : activePage === 'landing' ? (
          <>
            <HomeSectionScroll />
            {/* Airport Hero & Urgency Banner */}
            <PassengerBanner
              language={language}
              onQuickDonate={() => openCheckout('chennai_airport')}
              onOpen80GSearch={() => openDocumentPortal('80g')}
            />
            <WhatWeDo
              language={language}
              onJoinChange={() => openCheckout('chennai_airport')}
              onDonateForCause={(causeTitle) => {
                setDonationType('one-time');
                setSelectedCauseTitle(causeTitle);
                openCheckout('chennai_airport');
              }}
            />

            {/* Primary Donation Card (70% One-Time / 30% Monthly Engine) */}
            <DonationCard
              source="chennai_airport"
              language={language}
              donationType={donationType}
              onDonationTypeChange={setDonationType}
              selectedAmount={selectedAmount}
              onAmountChange={(amt) => setSelectedAmount(amt)}
              onOpenCheckout={handleOpenCheckoutWithDetails}
            />

            {/* 05-Second Quick Scan Impact Scroll Bar */}
            <QuickScanScroll
              language={language}
              selectedAmount={selectedAmount}
              onSelectAmount={handleSelectAmount}
              onInstantDonate={handleInstantDonate}
              onDisasterDonate={(amt, causeTitle) => {
                setSelectedAmount(amt);
                setDonationType('one-time');
                setSelectedCauseTitle(causeTitle);
                openCheckout('crowd_funding');
              }}
            />

            {/* Live Airport Passenger Goal Progress & Donor Feed */}
            <ImpactTracker language={language} />

            {/* Real Animal Welfare Rescue & Healing Stories */}
            <RescueStories
              language={language}
              onDonateForRescue={(amt) => handleInstantDonate(amt)}
            />

            {/* 80G Tax Exemption Calculator & Sanctuary Transparency */}
            <TrustAndTaxSection
              language={language}
              onSelectCalculatedAmount={(amt) => handleInstantDonate(amt)}
            />
          </>
        ) : activePage === 'fifth-campaign' ? (
          <FourthCampaignPage
            campaignId="c5"
            onOpenCheckout={(amount, causeTitle) => {
              setSelectedAmount(amount);
              setSelectedCauseTitle(causeTitle || 'This Thursday, Let’s Feed 1,400+ Gaumata');
              setSelectedCampaignId('c5');
              openCheckout('campaign_c5');
            }}
            onOpen80GSearch={() => openDocumentPortal('80g')}
          />
        ) : activePage === 'birthday-campaign' ? (
          <TuesdayCampaignPage
            campaignId="c6"
            onOpenCheckout={(amount, causeTitle) => {
              setSelectedAmount(amount);
              setSelectedCauseTitle(causeTitle || 'Celebrate Your Special Day by Sharing Happiness');
              setSelectedCampaignId('c6');
              openCheckout('campaign_c6');
            }}
            onOpen80GSearch={() => openDocumentPortal('80g')}
          />
        ) : activePage === 'navratri-campaign' ? (
          <TuesdayCampaignPage
            campaignId="c7"
            onOpen80GSearch={() => openDocumentPortal('80g')}
            onOpenCheckout={(amount, causeTitle) => {
              setDonationType('one-time');
              setSelectedAmount(amount);
              setSelectedCauseTitle(causeTitle || 'Navratri');
              setSelectedCampaignId('c7');
              openCheckout('campaign_c7');
            }}
          />
        ) : activePage === 'campaign-detail' ? (
          campaignId && !['c1', 'detail'].includes(campaignId) ? (
            <CampaignDetailPage
              campaignId={campaignId}
              language={language}
              onOpenCheckout={(amount, causeTitle) => {
                setSelectedAmount(amount);
                setSelectedCauseTitle(causeTitle);
                setSelectedCampaignId(campaignId);
                openCheckout(`campaign_${campaignId}`);
              }}
            />
          ) : (
            <LegacyCrowdFundingPage
              language={language === 'hi' ? 'hi' : 'en'}
              amount={selectedAmount}
              onAmountAndCauseTitleChange={(amt, causeTitle) => {
                setDonationType('one-time');
                setSelectedAmount(amt);
                setSelectedCauseTitle(causeTitle);
              }}
               onOpenCheckout={() => {
                 setSelectedCampaignId('c1');
                 openCheckout('campaign_c1');
               }}
             />
          )
        ) : activePage === 'tuesday-campaign' ? (
          <TuesdayCampaignPage
            onOpenCheckout={(amount, causeTitle) => {
              setSelectedAmount(amount);
              const title = causeTitle || 'This Tuesday, Turn Your Faith Into Seva';
              setSelectedCauseTitle(title);
              setSelectedCampaignId('c3');
              openCheckout('campaign_c3');
            }}
            onOpen80GSearch={() => openDocumentPortal('80g')}
          />
        ) : activePage === 'fourth-campaign' ? (
          <FourthCampaignPage
            campaignId="c4"
            onOpenCheckout={(amount, causeTitle) => {
              setSelectedAmount(amount);
              setSelectedCauseTitle(causeTitle || '1,400+ Lives Depend on Your Kindness — Donate Today');
              setSelectedCampaignId('c4');
              openCheckout('campaign_c4');
            }}
            onOpen80GSearch={() => openDocumentPortal('80g')}
          />
        ) : activePage === 'second-campaign' ? (
          <SecondCampaignPage
            campaignId="c2"
            onOpenCheckout={(amount) => {
              setSelectedAmount(amount);
              const title = 'Pitru Paksha Campaign';
              setSelectedCauseTitle(title);
              setSelectedCampaignId('c2');
              openCheckout('campaign_c2');
            }}
            onOpen80GSearch={() => openDocumentPortal('80g')}
          />
        ) : (
          <CrowdFundingPage
            language={language}
            amount={selectedAmount}
            onAmountAndCauseTitleChange={(amt, causeTitle) => {
              setDonationType('one-time');
              setSelectedAmount((prev) => (prev === amt ? prev : amt));
              setSelectedCauseTitle((prev) => (prev === causeTitle ? prev : causeTitle));
            }}
            onOpenCheckout={handleOpenCheckoutWithDetails}
            onOpenCampaign={(campaignId) =>
              navigate(
               campaignPathForId(campaignId)
              )
            }
          />
        )}
         </Suspense>
         </RouteErrorBoundary>
      </main>

      {/* Checkout Modal with instant UPI QR & One-Tap Apps */}
      <DonationModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        language={language === 'hi' ? 'hi' : 'en'}
        amount={selectedAmount}
        type={donationType}
        causeTitle={selectedCauseTitle}
        campaignId={selectedCampaignId}
        want80G={modalWant80G}
        source={modalSource}
        dedication={modalDedication}
        onCompleteDonation={handleCompleteDonation}
      />

      {/* 80G Tax Exemption Receipt & Kindness Certificate Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        language={language === 'hi' ? 'hi' : 'en'}
        submission={lastSubmission}
      />

      {/* About Sanctuary Modal */}
      <AboutUsModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        language={language}
      />

      {/* 80G Tax Certificate Fetch & Download Portal */}
      <Fetch80GModal
        isOpen={is80GSearchOpen}
        onClose={() => {
          setIs80GSearchOpen(false);
          setEightyGReferencePrefill('');
          setPortalMode('80g');
        }}
        language={language}
        initialReferenceId={eightyGReferencePrefill}
        mode={portalMode}
      />

      {/* Campaign-specific pages own their donation widgets. */}
      {showGenericMobileBar && (
        <StickyMobileBar
          language={language}
          amount={selectedAmount}
          donationType={donationType}
          onOpenCheckout={() => openCheckout()}
        />
      )}

      {/* Keep one shared site footer across every public page. */}
      <Footer
        language={language}
        onOpen80GSearch={() => openDocumentPortal('80g')}
        onOpenAbout={() => setIsAboutOpen(true)}
        onQuickDonate={handleQuickDonate}
      />

      <DonorLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        language={language}
      />
    </div>
  );
}

// Mount inside the landing-page Suspense boundary so lazy sections exist before scrolling.
function HomeSectionScroll() {
  useLayoutEffect(() => {
    const scrollToSection = () => {
      if (window.location.pathname !== '/') return;
      const id = window.location.hash.slice(1);
      if (id !== 'what-we-do-section' && id !== 'shelter-census-section') return;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    scrollToSection();
    window.addEventListener('popstate', scrollToSection);
    window.addEventListener('hashchange', scrollToSection);
    return () => {
      window.removeEventListener('popstate', scrollToSection);
      window.removeEventListener('hashchange', scrollToSection);
    };
  }, []);

  return null;
}

function PageLoading() {
  return <div className="min-h-screen bg-[#F4F7FA]" aria-label="Loading page" />;
}

export default function App() {
  return (
    <DonorAuthProvider>
      <AppContent />
    </DonorAuthProvider>
  );
}
