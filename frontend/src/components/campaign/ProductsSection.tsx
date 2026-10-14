import React, { useState } from 'react';
import { PRODUCTS_LIST } from '../../data/campaigns';
import { ProductItem, DonationCartItem } from '../../types/campaign';
import {
  Plus,
  Minus,
  ShoppingBag,
  Package,
  ArrowRight,
  Sparkles,
  Wheat,
  Activity,
  Shield,
  Layers,
  Play,
  Pause,
  ArrowLeftRight,
  Gauge,
} from 'lucide-react';

interface ProductsSectionProps {
  cart: DonationCartItem[];
  onUpdateQuantity: (product: ProductItem, delta: number) => void;
  onOpenCheckoutWithCart: () => void;
}

// Category tabs configuration for sliding tabs navigation
const PRODUCT_TABS = [
  { id: 'all', label: 'All Relief Items', shortLabel: 'All', icon: Layers },
  { id: 'prod-dry-grass', label: 'Dry Grass Bales', shortLabel: 'Dry Grass', icon: Wheat, price: '₹416' },
  { id: 'prod-green-grass', label: 'Fresh Green Grass', shortLabel: 'Green Grass', icon: Sparkles, price: '₹416' },
  { id: 'prod-cow-food', label: 'High-Protein Feed (50kg)', shortLabel: 'Cow Food', icon: Package, price: '₹1,317' },
  { id: 'prod-medical-kit', label: 'Medical Trauma Kit', shortLabel: 'Medical Kit', icon: Activity, price: '₹416' },
  { id: 'prod-rescue-equip', label: 'Rescue & Stretcher Gear', shortLabel: 'Rescue Gear', icon: Shield, price: '₹3,100' },
];

export const ProductsSection: React.FC<ProductsSectionProps> = ({
  cart,
  onUpdateQuantity,
  onOpenCheckoutWithCart,
}) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr'); // 'ltr' = sliding from left to right
  const [speed, setSpeed] = useState<'normal' | 'slow' | 'fast'>('normal');

  const getProductQty = (productId: string): number => {
    const item = cart.find((c) => c.product.id === productId);
    return item ? item.quantity : 0;
  };

  const totalCartAmount = cart.reduce((acc, item) => acc + item.product.unitPrice * item.quantity, 0);
  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Speed durations in seconds
  const speedDurations = {
    slow: { products: '48s', tabs: '36s' },
    normal: { products: '32s', tabs: '24s' },
    fast: { products: '18s', tabs: '14s' },
  };

  const isPaused = !isPlaying || isHovered;

  // Render an individual product card
  const renderProductCard = (product: ProductItem, uniqueKey: string, setIndex: number) => {
    const qty = getProductQty(product.id);
    const percentFunded = Math.min(100, Math.round((product.fundedUnits / product.targetUnits) * 100));
    const isHighlighted = activeTab === product.id;

    return (
      <div
        key={uniqueKey}
        className={`w-[290px] sm:w-[330px] md:w-[350px] flex-shrink-0 flex flex-col bg-[#FDFBF7] rounded-2xl border transition-all duration-300 overflow-hidden select-none ${
          qty > 0
            ? 'border-[#9F3D00] ring-2 ring-[#9F3D00]/25 shadow-lg bg-white scale-[1.01]'
            : isHighlighted
            ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-md bg-white'
            : 'border-slate-200 hover:border-amber-300 hover:shadow-md'
        }`}
      >
        {/* Product Image */}
        <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500 pointer-events-none"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          {product.badge && (
            <span className="absolute top-3 left-3 bg-[#0F2942]/90 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-xs">
              {product.badge}
            </span>
          )}
          <span className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg shadow-xs border border-slate-200/60">
            ₹{product.unitPrice.toLocaleString()} / {product.unitLabel}
          </span>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg text-[#0F2942] leading-snug">
              {product.name}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {product.description}
            </p>

            {/* Funding Progress */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span>{product.fundedUnits} of {product.targetUnits} {product.unitLabel}s</span>
                <span className="text-[#9F3D00] font-bold">{percentFunded}% funded</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-[#9F3D00] rounded-full transition-all duration-500"
                  style={{ width: `${percentFunded}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pricing and Stepper Controller */}
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Unit Price</span>
              <span className="font-display font-bold text-slate-900 text-base sm:text-lg">
                ₹{product.unitPrice.toLocaleString()}
              </span>
            </div>

            {qty === 0 ? (
              <button
                id={`add-prod-${product.id}-set-${setIndex}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateQuantity(product, 1);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-[#9F3D00] text-[#9F3D00] hover:text-white border border-amber-300 hover:border-transparent font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-xs min-h-[40px] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Unit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-50 p-1 rounded-xl border border-amber-300">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(product, -1);
                  }}
                  className="w-9 h-9 rounded-lg bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold transition-colors cursor-pointer shadow-2xs active:bg-slate-200"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-display font-bold text-sm sm:text-base text-[#0F2942] w-7 text-center">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(product, 1);
                  }}
                  className="w-9 h-9 rounded-lg bg-[#9F3D00] text-white hover:bg-[#863300] flex items-center justify-center font-bold transition-colors cursor-pointer shadow-2xs active:scale-95"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render a tab button
  const renderTabButton = (tab: (typeof PRODUCT_TABS)[0], uniqueKey: string) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={uniqueKey}
        type="button"
        onClick={() => setActiveTab(tab.id === activeTab ? 'all' : tab.id)}
        className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer min-h-[40px] ${
          isActive
            ? 'bg-[#9F3D00] text-white shadow-md shadow-[#9F3D00]/20 scale-102 ring-2 ring-[#9F3D00]/20'
            : 'bg-[#FDFBF7] text-slate-700 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/60'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-amber-200' : 'text-[#9F3D00]'}`} />
        <span>{tab.label}</span>
        {tab.price && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
              isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
            }`}
          >
            {tab.price}
          </span>
        )}
      </button>
    );
  };

  return (
    <section
      id="products"
      className="py-10 sm:py-16 bg-white border-y border-[#EAE5DD] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9F3D00] bg-amber-50 px-2.5 py-1 rounded-md mb-2">
              <Package className="w-3.5 h-3.5" />
              Direct Tangible Support
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2942]">
              Select Products to Donate
            </h2>
            <p className="mt-1.5 text-xs sm:text-base text-slate-600 max-w-2xl">
              Relief items and category tabs are sliding continuously from left to right. Hover or tap any card to pause and sponsor items.
            </p>
          </div>

          {/* Interactive Controls Toolbar: Play/Pause, Direction, Speed & Cart */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Play/Pause Toggle */}
            <button
              id="continuous-slide-toggle-btn"
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs min-h-[36px] ${
                isPlaying
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={isPlaying ? 'Click to pause sliding' : 'Click to resume continuous sliding'}
            >
              {isPlaying ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <Pause className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isHovered ? 'Paused (Hover)' : 'Sliding Continuously'}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-700 fill-slate-700" />
                  <span>Play Slide</span>
                </>
              )}
            </button>

            {/* Direction Toggle: Left to Right / Right to Left */}
            <button
              id="continuous-slide-direction-btn"
              type="button"
              onClick={() => setDirection(direction === 'ltr' ? 'rtl' : 'ltr')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-amber-50 hover:border-[#9F3D00] transition-all cursor-pointer shadow-2xs min-h-[36px]"
              title="Toggle sliding direction"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#9F3D00]" />
              <span>{direction === 'ltr' ? 'Left to Right ➡️' : 'Right to Left ⬅️'}</span>
            </button>

            {/* Speed Selector */}
            <button
              id="continuous-slide-speed-btn"
              type="button"
              onClick={() => {
                const speeds: ('normal' | 'fast' | 'slow')[] = ['normal', 'fast', 'slow'];
                const nextSpeed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
                setSpeed(nextSpeed);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-amber-50 transition-all cursor-pointer shadow-2xs min-h-[36px]"
              title="Change sliding speed"
            >
              <Gauge className="w-3.5 h-3.5 text-amber-700" />
              <span className="capitalize">{speed}</span>
            </button>

            {/* Cart Header Badge */}
            {totalCartCount > 0 && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 p-2 rounded-xl shadow-xs">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-amber-900 font-medium block">
                    {totalCartCount} item{totalCartCount > 1 ? 's' : ''}
                  </span>
                  <span className="font-display font-extrabold text-sm text-[#9F3D00]">
                    ₹ {totalCartAmount.toLocaleString()}
                  </span>
                </div>
                <button
                  id="products-checkout-quick-btn"
                  type="button"
                  onClick={onOpenCheckoutWithCart}
                  className="inline-flex items-center gap-1 bg-[#9F3D00] hover:bg-[#863300] text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer min-h-[34px]"
                >
                  <span>Proceed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. CONTINUOUS HORIZONTAL SLIDING TABS (Left to Right)                     */}
        {/* ========================================================================= */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9F3D00] animate-ping" />
              Relief Category Tabs (Sliding Continuously)
            </span>
            <span className="text-[11px] text-slate-400">Hover or click any tab to highlight</span>
          </div>

          <div
            className="relative w-full overflow-hidden rounded-2xl bg-amber-50/40 border border-amber-200/60 py-2.5"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setTimeout(() => setIsHovered(false), 2000)}
          >
            {/* Left & Right gradient edge fades */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

            {/* Seamless Double-Set Marquee Track for Continuous Tabs */}
            <div
              className={`flex w-max gap-3 ${
                direction === 'ltr' ? 'animate-tabs-continuous-ltr' : 'animate-tabs-continuous-rtl'
              } ${isPaused ? 'pause-animation' : ''}`}
              style={
                {
                  '--tabs-duration': speedDurations[speed].tabs,
                } as React.CSSProperties
              }
            >
              {/* Set 1 */}
              <div className="flex items-center gap-3">
                {PRODUCT_TABS.map((tab, idx) => renderTabButton(tab, `tab-set1-${tab.id}-${idx}`))}
              </div>
              {/* Set 2 (for seamless loop) */}
              <div className="flex items-center gap-3">
                {PRODUCT_TABS.map((tab, idx) => renderTabButton(tab, `tab-set2-${tab.id}-${idx}`))}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CONTINUOUS HORIZONTAL SLIDING PRODUCTS (Left to Right)                 */}
        {/* ========================================================================= */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5 px-1">
            <span className="font-semibold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#9F3D00]" />
              Relief Supplies Showcase (Continuous Non-Stop Flow)
            </span>
            <span className="text-[11px] text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md font-medium">
              💡 Glides smoothly non-stop • Pauses on hover
            </span>
          </div>

          <div
            className="relative w-full overflow-hidden py-2"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setTimeout(() => setIsHovered(false), 2000)}
          >
            {/* Left & Right gradient edge fades */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

            {/* Seamless Double-Set Marquee Track for Continuous Product Cards */}
            <div
              className={`flex w-max gap-5 sm:gap-6 ${
                direction === 'ltr' ? 'animate-continuous-ltr' : 'animate-continuous-rtl'
              } ${isPaused ? 'pause-animation' : ''}`}
              style={
                {
                  '--marquee-duration': speedDurations[speed].products,
                } as React.CSSProperties
              }
            >
              {/* Set 1 */}
              <div className="flex gap-5 sm:gap-6">
                {PRODUCTS_LIST.map((product) => renderProductCard(product, `prod-set1-${product.id}`, 1))}
              </div>
              {/* Set 2 (for seamless loop) */}
              <div className="flex gap-5 sm:gap-6">
                {PRODUCTS_LIST.map((product) => renderProductCard(product, `prod-set2-${product.id}`, 2))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Cart Checkout Callout */}
        {totalCartCount > 0 && (
          <div className="mt-8 p-4 sm:p-6 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#9F3D00] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-display font-bold text-base sm:text-lg text-[#0F2942]">
                  {totalCartCount} Item{totalCartCount > 1 ? 's' : ''} Ready to Sponsor
                </h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  Total Sponsorship: <strong className="text-[#9F3D00]">₹ {totalCartAmount.toLocaleString()}</strong> (100% Tax Deductible under 80G)
                </p>
              </div>
            </div>

            <button
              id="products-section-donate-cart-btn"
              type="button"
              onClick={onOpenCheckoutWithCart}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-8 rounded-xl bg-[#9F3D00] hover:bg-[#863300] text-white font-display font-bold text-base shadow-md hover:shadow-lg transition-all cursor-pointer transform active:scale-98 min-h-[46px]"
            >
              <span>Donate Selected Items (₹ {totalCartAmount.toLocaleString()})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </section>
  );
};
