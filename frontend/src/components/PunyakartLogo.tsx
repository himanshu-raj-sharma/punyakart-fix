import React from 'react';

interface PunyakartLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  theme?: 'auto' | 'light' | 'dark';
  variant?: 'full' | 'icon-only';
  framed?: boolean;
  /** Show official lockup image (icon + wordmark). Best on light backgrounds. */
  lockup?: boolean;
  /** Place wordmark under the icon instead of beside it. */
  stacked?: boolean;
}

const ICON_SRC = '/punyakart-logo-icon.png';
const LOCKUP_SRC = '/punyakart-logo.png';
const TAGLINE = 'People | Animals | A Better Tomorrow';

export const PunyakartLogo: React.FC<PunyakartLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  theme = 'auto',
  variant = 'full',
  framed = false,
  lockup = false,
  stacked = false,
}) => {
  const iconDimensions = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const lockupHeights = {
    sm: 'h-10',
    md: 'h-12 sm:h-14',
    lg: 'h-16 sm:h-20',
    xl: 'h-24 sm:h-28',
  };

  const titleSizes = {
    sm: 'text-[12px] sm:text-sm',
    md: 'text-sm sm:text-base',
    lg: 'text-lg sm:text-xl',
    xl: 'text-2xl sm:text-3xl',
  };

  const taglineSizes = {
    sm: 'text-[8px] sm:text-[9px]',
    md: 'text-[9px] sm:text-[10px]',
    lg: 'text-[10px] sm:text-xs',
    xl: 'text-xs sm:text-sm',
  };

  const titleColor =
    theme === 'dark'
      ? 'text-white'
      : theme === 'light'
        ? 'text-[#002D62]'
        : 'text-neutral-900 dark:text-white';

  // Matches official lockup: "Foundation" in light blue
  const foundationColor =
    theme === 'dark'
      ? 'text-[#7EB8F0]'
      : theme === 'light'
        ? 'text-[#3D8FD4]'
        : 'text-[#3D8FD4] dark:text-[#7EB8F0]';

  const taglineColor =
    theme === 'dark'
      ? 'text-white/85'
      : theme === 'light'
        ? 'text-[#002D62]/75'
        : 'text-neutral-600 dark:text-white/85';

  if (lockup) {
    return (
      <div className={`flex items-center select-none min-w-0 ${className}`}>
        <img
          src={LOCKUP_SRC}
          alt="Punyakart Foundation"
          className={`${lockupHeights[size]} w-auto max-w-full object-contain`}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex select-none min-w-0 ${
        stacked
          ? 'flex-col items-center gap-1.5 text-center'
          : 'flex-row items-center gap-2 sm:gap-2.5'
      } ${className}`}
    >
      <div
        className={`relative shrink-0 ${iconDimensions[size]} flex items-center justify-center overflow-hidden rounded-full ${
          framed
            ? 'bg-white ring-2 ring-white shadow-md p-[3px]'
            : 'bg-white/95 p-[2px]'
        }`}
      >
        <img
          src={ICON_SRC}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {variant === 'full' && (
        <div className={`flex flex-col min-w-0 leading-none ${stacked ? 'items-center' : 'items-start'}`}>
          <span
            className={`font-display font-bold tracking-tight ${titleSizes[size]} ${titleColor} whitespace-nowrap`}
          >
            Punyakart{' '}
            <span className={foundationColor}>Foundation</span>
          </span>
          {showTagline && (
            <p
              className={`font-medium tracking-wide leading-tight mt-0.5 sm:mt-1 ${taglineSizes[size]} ${taglineColor} whitespace-nowrap`}
            >
              {TAGLINE}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
