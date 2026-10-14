import React from 'react';

export const QuoteBanner: React.FC = () => {
  return (
    <section className="py-6 px-4 bg-[#FFFDF7] border-b border-[#FDE68A]/60 text-center">
      <div className="max-w-md sm:max-w-lg md:max-w-xl mx-auto">
        <p className="font-display font-semibold text-xs sm:text-sm text-[#334155] italic leading-relaxed">
          &ldquo;Shelter, feed, and heal 1,187+ rescued animals in Dehradun — service to animals is service to the Divine.&rdquo;
        </p>
      </div>
    </section>
  );
};
