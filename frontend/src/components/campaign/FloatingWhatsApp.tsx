import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';

export const FloatingWhatsApp: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-5 sm:bottom-6 right-3.5 sm:right-6 z-35 flex items-center gap-3">
      <>
        {showTooltip && (
          <div
            className="hidden sm:flex items-center gap-2 bg-white text-slate-800 text-xs py-2 px-3.5 rounded-full shadow-lg border border-slate-200"
          >
            <span>Need help with your donation or 80G?</span>
            <button
              type="button"
              onClick={() => setShowTooltip(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </>

      <a
        href="https://wa.me/919876543210?text=Namaste%20Punyakart%20Foundation%2C%20I%20would%20like%20to%20know%20more%20about%20the%20Gauseva%20campaign."
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xl flex items-center justify-center cursor-pointer group"
        aria-label="Chat on WhatsApp with Punyakart Helpdesk"
      >
        <span className="absolute -inset-1 rounded-full bg-[#25D366]/30 animate-ping opacity-60 pointer-events-none" />
        <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 fill-white group-hover:scale-105 transition-transform relative z-10" />
      </a>
    </div>
  );
};
