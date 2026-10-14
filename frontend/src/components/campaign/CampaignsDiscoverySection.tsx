import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Heart, 
  Gift, 
  PawPrint, 
  GraduationCap, 
  Users, 
  HeartHandshake, 
  CloudRain, 
  Accessibility, 
  Sparkles,
  Baby,
  Share2,
  X
} from 'lucide-react';
import { CAMPAIGN_ASSETS } from '../../data/campaigns';
import tuesdaySevaBanner from '../../assets/images/regenerated_image_1790524556850.jpg';
import emergencyReliefImg from '../../assets/images/photo-1488521787991-ed7bbaae773c.jpg';
import pitrPakshaBanner from '../../assets/campaigns/regenerated_image_1789631745062.jpg';
import gauSevaBanner from '../../assets/campaigns/gau-seva-campaign.jpg';
import thursdayGauSevaBanner from '../../assets/campaigns/thursday-gau-seva-campaign.png';
import c6HeroBanner from '../../assets/campaigns/c6-hero.jpg';
import { NAVRATRI_CAMPAIGN_ID, NAVRATRI_DEFAULT_CAMPAIGN } from '../../data/navratriCampaign';
import { resolveCampaignImage } from './campaignImages';
import {
  getCampaignDonationSelection,
  getCampaignProgress,
  getCampaignWhatsAppUrl,
  isCampaignCardActivation,
  mergeDiscoveryCampaigns,
  parseDiscoveryCampaigns,
  canDonateToCampaignCard,
} from '../../utils/campaignDiscovery';
import { startPublicSnapshotPolling, type PublicSnapshot } from '../../utils/publicCampaignPolling';
import type { CampaignCardItem } from '../../utils/campaignDiscovery';

export type { CampaignCardItem } from '../../utils/campaignDiscovery';

export const CAMPAIGNS_LIST: CampaignCardItem[] = [
  {
    id: 'c1',
    title: 'Support Emergency Rescue & Relief Operations Across India',
    category: 'All Causes',
    organizer: 'Punyakart Foundation',
    image: emergencyReliefImg,
    hasTaxBenefit: true,
  },
  {
    id: 'c2',
    title: 'Let this Pitr Paksha be a time of remembrance, gratitude and compassion.',
    category: 'Faith',
    organizer: 'Punyakart Foundation',
    image: pitrPakshaBanner,
    hasTaxBenefit: true,
  },
  {
    id: 'c3',
    title: 'This Tuesday, Turn Your Faith Into Seva',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    image: tuesdaySevaBanner,
    hasTaxBenefit: true,
  },
  {
    id: 'c4',
    title: '1,400+ Lives Depend on Your Kindness — Donate Today',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    image: gauSevaBanner,
    hasTaxBenefit: true,
  },
  {
    id: 'c5',
    title: 'This Thursday, Let’s Feed 1,400+ Gaumata',
    category: 'Animals',
    organizer: 'Punyakart Foundation',
    image: thursdayGauSevaBanner,
    hasTaxBenefit: true,
  },
  {
    id: 'c6',
    title: 'Celebrate Your Special Day by Sharing Happiness',
    category: 'Children',
    organizer: 'Punyakart Foundation',
    image: c6HeroBanner,
    hasTaxBenefit: true,
  },
];

const NAVRATRI_PREVIEW_CARD: CampaignCardItem = {
  id: NAVRATRI_CAMPAIGN_ID,
  title: NAVRATRI_DEFAULT_CAMPAIGN.title,
  category: NAVRATRI_DEFAULT_CAMPAIGN.category,
  organizer: NAVRATRI_DEFAULT_CAMPAIGN.organizer,
  image: NAVRATRI_DEFAULT_CAMPAIGN.image,
  hasTaxBenefit: false,
  donationPresets: NAVRATRI_DEFAULT_CAMPAIGN.donation_presets,
  isActive: false,
  isApiConfirmed: false,
};

interface CampaignsDiscoverySectionProps {
  onDonateClick: (campaignTitle: string, amount: number, campaignId?: string) => void;
  onCampaignClick?: (campaignId: string, campaignTitle: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const CampaignsDiscoverySection: React.FC<CampaignsDiscoverySectionProps> = ({
  onDonateClick,
  onCampaignClick,
  selectedCategory: externalCategory,
  onSelectCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCategory, setInternalCategory] = useState('All Causes');
  
  const selectedCategory = externalCategory !== undefined ? externalCategory : internalCategory;
  const setSelectedCategory = (category: string) => {
    setInternalCategory(category);
    if (onSelectCategory) {
      onSelectCategory(category);
    }
  };

  const [activeFilter, setActiveFilter] = useState('Active');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const visibleCount = 12;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 8);
  };

  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === 'left' ? -200 : 200;
    scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(checkScroll, 320);
  };

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftStart.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.4;
    if (Math.abs(walk) > 4) {
      hasDragged.current = true;
    }
    scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
    checkScroll();
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const categories = [
    { id: 'All Causes', label: 'All Causes', icon: Sparkles },
    { id: 'Animals', label: 'Animals', icon: PawPrint },
    { id: 'Children', label: 'Children', icon: Baby },
    { id: 'Elderly', label: 'Elderly', icon: HeartHandshake },
    { id: 'Education', label: 'Education', icon: GraduationCap },
    { id: 'Faith', label: 'Faith', icon: Heart },
    { id: 'Women', label: 'Women', icon: Users },
    { id: 'Disaster Relief', label: 'Disaster Relief', icon: CloudRain },
    { id: 'Specially Abled', label: 'Specially Abled', icon: Accessibility },
  ];

  const [listing, setListing] = useState<PublicSnapshot<CampaignCardItem[]>>({ source: '/api/campaigns', data: null, status: 'loading' });
  useEffect(() => startPublicSnapshotPolling('/api/campaigns', parseDiscoveryCampaigns, setListing), []);
  const campaigns = useMemo(() => mergeDiscoveryCampaigns(
    [...CAMPAIGNS_LIST, NAVRATRI_PREVIEW_CARD],
    listing.status === 'ready' ? listing.data ?? [] : undefined,
  ).map(card => ({ ...card, image: resolveCampaignImage(card.id, card.image) })), [listing]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesCategory =
        selectedCategory === 'All Causes' ||
        campaign.category === selectedCategory ||
        (campaign.id === 'c1' && (selectedCategory === 'Children' || selectedCategory === 'Disaster Relief')) ||
        (campaign.id === 'c2' && (selectedCategory === 'Animals' || selectedCategory === 'Faith'));
      const matchesSearch =
        campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.organizer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery, campaigns]);

  return (
    <section id="causes-discovery" className="w-full bg-[#FAF7F2] py-3 sm:py-7 md:py-9 px-2.5 sm:px-5 lg:px-8">
      <div className="max-w-[1440px] mx-auto">
        {listing.status !== 'ready' && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {listing.status === 'loading' ? 'Loading campaign availability.' : 'Campaign availability could not be refreshed.'} All cards below are previews; donations and live totals are unavailable until confirmed.
        </p>}
        
        {/* 1. Compact Single-Row Search Bar & Filter on Mobile */}
        <div className="flex flex-wrap min-[360px]:flex-nowrap items-center gap-2 sm:gap-3 max-w-4xl mx-auto mb-3 sm:mb-5">
          
          {/* Search Input Pill */}
          <div className="relative flex-1 basis-full min-[360px]:basis-0 min-w-0">
            <div className="flex items-center bg-white rounded-full border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] pl-3 sm:pl-4 pr-1 py-1 sm:py-1.5 focus-within:ring-2 focus-within:ring-[#FF6000]/40 transition-all min-h-[44px] sm:min-h-[46px]">
              <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search causes, campaigns, NGO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search causes, campaigns, NGO"
                className="w-full min-w-0 bg-transparent text-base sm:text-sm md:text-base text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-11 h-11 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 mr-1 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-[#001738] hover:bg-[#002D62] active:scale-95 text-white flex items-center justify-center flex-shrink-0 shadow-xs transition-all cursor-pointer min-w-[36px] min-h-[36px]"
                aria-label="Search causes"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Filter Dropdown Pill */}
          <div className="relative flex-shrink-0 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 bg-white border border-slate-200/90 shadow-[0_2px_6px_rgba(0,0,0,0.03)] hover:bg-slate-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold text-slate-700 transition-colors cursor-pointer min-h-[44px] sm:min-h-[46px]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>{activeFilter}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-25 bg-black/10 sm:bg-transparent"
                  onClick={() => setIsFilterDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-40 sm:w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-150">
                  {['Active', 'Almost Funded', 'Urgent', 'All'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setActiveFilter(status);
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-3 hover:bg-orange-50/60 transition-colors ${
                        activeFilter === status ? 'text-[#FF6000] font-bold bg-orange-50/40' : ''
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        {/* 2. Compact Category Icon Tabs Row with quick scroll controls */}
        <div className="relative w-full min-w-0 max-w-full mb-3.5 sm:mb-6 group/cat">
          {/* Subtle edge fades for mobile indicating horizontal swipeability */}
          {canScrollLeft && (
            <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-7 bg-gradient-to-r from-[#FAF7F2] to-transparent z-10" />
          )}
          {canScrollRight && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-7 bg-gradient-to-l from-[#FAF7F2] to-transparent z-10" />
          )}

          {/* Left Arrow Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="absolute left-0.5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all cursor-pointer min-w-[36px] min-h-[36px]"
              aria-label="Previous categories"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
          )}

          {/* Right Arrow Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="absolute right-0.5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-white text-slate-700 shadow-md border border-slate-200/90 flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all cursor-pointer min-w-[36px] min-h-[36px]"
              aria-label="Next categories"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          )}

          {/* Scroll container */}
          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full max-w-full overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-none pb-2 touch-pan-x cursor-grab active:cursor-grabbing -webkit-overflow-scrolling-touch"
          >
            <div className="flex items-center justify-start lg:justify-center gap-2.5 sm:gap-5 min-w-max px-2.5 sm:px-6">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={(e) => {
                      if (hasDragged.current) return;
                      setSelectedCategory(cat.id);
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }}
                    className={`group flex flex-col items-center gap-1 sm:gap-1.5 cursor-pointer transition-all flex-shrink-0 min-w-[58px] sm:min-w-[66px] py-1 ${
                      isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[#001738] text-white shadow-sm ring-2 ring-[#001738]/20'
                          : 'bg-white text-slate-600 border border-slate-200 group-hover:border-[#FF6000] group-hover:text-[#FF6000]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10.5px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                        isSelected ? 'text-[#001738] font-bold' : 'text-slate-600 group-hover:text-slate-900'
                      }`}
                    >
                      {cat.label}
                    </span>
                    {isSelected ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6000] -mt-0.5" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-transparent -mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Filter Feedback on Mobile */}
        {(selectedCategory !== 'All Causes' || searchQuery || activeFilter !== 'Active') && (
          <div className="flex items-center justify-between gap-2 px-1 mb-3 text-xs text-slate-600">
            <span className="min-w-0 font-medium break-words sm:truncate">
              Showing {filteredCampaigns.length} cause{filteredCampaigns.length !== 1 ? 's' : ''} {selectedCategory !== 'All Causes' ? `in "${selectedCategory}"` : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All Causes');
                setSearchQuery('');
                setActiveFilter('Active');
              }}
              className="min-h-11 sm:min-h-0 text-[#FF6000] font-bold hover:underline flex-shrink-0 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}

        {/* 3. Responsive Campaign Cards Grid (Optimized mobile padding and heights) */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-10 sm:py-16 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-6 shadow-xs">
            <p className="text-slate-500 font-medium text-xs sm:text-sm">No campaigns found matching your criteria.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All Causes');
                setActiveFilter('Active');
              }}
              className="mt-2.5 text-xs sm:text-sm font-bold text-[#FF6000] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {filteredCampaigns.slice(0, visibleCount).map((card) => {
              const percent = getCampaignProgress(card.raised, card.target);
              const raised = typeof card.raised === 'number' && Number.isFinite(card.raised) ? card.raised : undefined;
              const isConfirmed = canDonateToCampaignCard(card);
              const donation = getCampaignDonationSelection(card);

              return (
                <div
                  key={card.id}
                  role={onCampaignClick ? 'link' : undefined}
                  tabIndex={onCampaignClick ? 0 : undefined}
                  onClick={() => onCampaignClick?.(card.id, card.title)}
                  onKeyDown={(event) => {
                    if (onCampaignClick && isCampaignCardActivation(event.key, true)) {
                      event.preventDefault();
                      onCampaignClick(card.id, card.title);
                    }
                  }}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group cursor-pointer"
                >
                  {/* Campaign Image */}
                  <div className="relative aspect-[16/9] sm:aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        style={{ objectPosition: card.imagePosition || 'center' }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = CAMPAIGN_ASSETS.heroRescue;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-900/60 text-xs font-bold">
                        Campaign image placeholder
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 bg-[#001738]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      {card.category}
                    </div>

                    {card.hasTaxBenefit && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-amber-500/95 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        <Gift className="w-3 h-3 text-white" />
                        <span>80G Tax Benefit</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content with compact mobile spacing */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
                    
                    {/* Title */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-base sm:text-[15px] leading-snug break-words sm:line-clamp-2 group-hover:text-[#002D62] transition-colors">
                        {card.title}
                      </h3>
                      {!isConfirmed && <p className="mt-1 text-xs font-bold text-amber-800">Preview — donations unavailable</p>}

                      {/* Organizer */}
                      <p className="text-slate-500 font-medium text-xs mt-1 break-words sm:truncate">
                        By <span className="text-[#002D62] font-semibold">{card.organizer}</span>
                      </p>
                    </div>

                    {/* Metrics: Raised & Donors */}
                    <div className="pt-1">
                      {percent === null ? (
                        <div className="text-[11.5px] sm:text-xs font-bold text-slate-600 mb-1.5">
                          <p>{card.target === 0 ? 'No fixed target' : 'Progress unavailable'}</p>
                          <p>Raised: {raised === undefined ? '—' : `₹${raised.toLocaleString('en-IN')}`} · Donors: {card.donors ?? '—'}</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap sm:flex-nowrap gap-x-2 gap-y-1 items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                          <span>
                            Raised: <span className="text-slate-900 font-extrabold">₹{raised?.toLocaleString('en-IN')}</span>
                            <span className="text-xs text-[#FF6000] font-bold ml-1">({percent}%)</span>
                          </span>
                          <span>
                            Donors: <span className="text-slate-900 font-extrabold">{card.donors ?? '—'}</span>
                          </span>
                        </div>
                      )}

                      {/* Progress Bar (Punyakart Orange) */}
                      {percent !== null && (
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[#FF6000] to-[#FF8C38] h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Donate Now + Direct WhatsApp Share */}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isConfirmed) return;
                          onDonateClick(...donation);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        disabled={!isConfirmed}
                        className="flex-1 bg-gradient-to-r from-[#FF6000] to-[#FF5100] hover:from-[#E55600] hover:to-[#D04A00] active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm py-2.5 px-3 rounded-xl shadow-[0_2px_6px_rgba(255,96,0,0.25)] hover:shadow-[0_4px_10px_rgba(255,96,0,0.35)] transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <Heart className="w-4 h-4 fill-white" />
                        <span>{!isConfirmed ? 'Unavailable' : 'Donate Now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(getCampaignWhatsAppUrl(card), '_blank');
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-600 border border-emerald-200/80 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer"
                        title="Share on WhatsApp"
                        aria-label="Share campaign on WhatsApp"
                      >
                        <Share2 className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
