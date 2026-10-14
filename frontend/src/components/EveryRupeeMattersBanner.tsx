import * as React from 'react';
import everyRupeeBanner from '../assets/every-rupee-matters.png';

export const EveryRupeeMattersBanner: React.FC = () => {
  return (
    <section className="relative py-2 sm:py-3" aria-labelledby="every-rupee-heading">
      <h2 id="every-rupee-heading" className="sr-only">
        Every rupee matters — One donation. Multiple lives changed.
      </h2>

      <div className="relative w-full max-w-full overflow-hidden rounded-2xl sm:rounded-3xl md:rounded-[40px] bg-white shadow-[0_14px_36px_-22px_rgba(255,107,0,0.35)]">
        <img
          src={everyRupeeBanner}
          alt="Every rupee matters. One donation. Multiple lives changed. From flood survivors to injured animals — your crowd contribution reaches those who need it most, fast."
          className="relative z-0 block w-full h-auto max-w-full select-none object-contain"
          draggable={false}
        />

        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-16 z-10 bg-gradient-to-r from-white via-white/70 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-16 z-10 bg-gradient-to-l from-white via-white/70 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-6 z-10 bg-gradient-to-b from-white/80 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 z-10 bg-gradient-to-t from-white/80 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
};
