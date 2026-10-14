/** Campaign-owned controls take precedence; informational pages need no fixed CTA. */
export function hasGenericMobileDonationBar(activePage: string, campaignId?: string): boolean {
  return activePage === 'landing' ||
    (activePage === 'campaign-detail' && Boolean(campaignId) && !['c1', 'detail'].includes(campaignId!));
}

/** Reserve space for the visible page-owned bar, including lazy-loaded pages. */
export function observeMobileDonationBar(): () => void {
  const root = document.documentElement;
  const property = '--mobile-donation-bar-height';
  const selector = '[data-mobile-donation-bar]';
  const mobile = window.matchMedia('(max-width: 639px)');
  let bars: HTMLElement[] = [];
  let frame = 0;

  const measure = () => {
    frame = 0;
    let height = 0;
    if (mobile.matches) {
      bars.forEach((bar) => {
        const rect = bar.getBoundingClientRect();
        const style = window.getComputedStyle(bar);
        if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight &&
          style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          height = Math.max(height, rect.height);
        }
      });
    }
    const value = `${Math.ceil(height)}px`;
    if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value);
  };
  const scheduleMeasure = () => {
    if (!frame) frame = window.requestAnimationFrame(measure);
  };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
  const discover = () => {
    const next = Array.from(document.querySelectorAll<HTMLElement>(selector));
    bars.filter((bar) => !next.includes(bar)).forEach((bar) => resizeObserver?.unobserve(bar));
    next.filter((bar) => !bars.includes(bar)).forEach((bar) => resizeObserver?.observe(bar));
    bars = next;
  };
  const mutationObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === 'childList')) {
      discover();
      scheduleMeasure();
    } else if (mutations.some(({ target }) => target !== root &&
      bars.some((bar) => target === bar || (target instanceof Element && target.contains(bar))))) {
      scheduleMeasure();
    }
  });

  discover();
  measure();
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'hidden'],
  });
  // Resize also covers browsers without ResizeObserver and breakpoint changes.
  window.addEventListener('resize', scheduleMeasure);
  window.visualViewport?.addEventListener('resize', scheduleMeasure);

  return () => {
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleMeasure);
    window.visualViewport?.removeEventListener('resize', scheduleMeasure);
    root.style.removeProperty(property);
  };
}
