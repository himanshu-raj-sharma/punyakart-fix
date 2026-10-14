import { deriveTrafficAttribution, sanitizeTrafficAttribution, type TrafficAttribution } from './trafficAttribution';

export const TRAFFIC_ATTRIBUTION_SESSION_KEY = 'punyakart.traffic-attribution.v1';
export const MAX_TRAFFIC_SESSION_LENGTH = 2048;

export interface TrafficSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TrafficBrowserContext {
  url: string;
  referrer: string;
  navigationType?: string;
}

export interface TrafficSessionEnvironment {
  now?: () => number;
  readBrowser?: () => TrafficBrowserContext | undefined;
  getStorage?: () => TrafficSessionStorage | undefined;
}

/** Access browser APIs lazily, so importing this module on the server is safe. */
function readBrowserContext(): TrafficBrowserContext | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  const url = window.location.href;
  const referrer = document.referrer;
  if (typeof url !== 'string' || typeof referrer !== 'string') return undefined;
  let navigationType: string | undefined;
  try {
    navigationType = (window.performance?.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
  } catch {
    // Navigation timing is optional; equality of sanitized hints is the conservative fallback.
  }
  return { url, referrer, navigationType };
}

function hasMeaningfulHints(value: TrafficAttribution): boolean {
  return Boolean(value.utmSource || value.utmMedium || value.utmCampaign || value.utmContent ||
    value.referrerHost || value.hasMetaClick || value.hasGoogleClick);
}

function sameHints(left: TrafficAttribution, right: TrafficAttribution): boolean {
  return (['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'referrerHost',
    'landingPath', 'hasMetaClick', 'hasGoogleClick'] as const).every((key) => left[key] === right[key]);
}

function directSnapshot(candidate: TrafficAttribution): TrafficAttribution {
  return {
    version: 1, source: 'direct_unknown', evidence: 'none', capturedAt: candidate.capturedAt,
    ...(candidate.landingPath ? { landingPath: candidate.landingPath } : {}),
  };
}

/**
 * One instance per document. Initialization is idempotent; SPA moves never recapture document.referrer.
 * A new document can replace the previous touch with explicit UTM/external evidence. Reload/history
 * restores the original timestamp, never extending the 30-minute touch lifetime. Only sanitized
 * snapshots enter sessionStorage, with memory-only fallback when any storage operation is blocked.
 */
export function createTrafficAttributionSession(environment: TrafficSessionEnvironment = {}) {
  const clock = environment.now ?? Date.now;
  const readBrowser = environment.readBrowser ?? readBrowserContext;
  const getStorage = environment.getStorage ?? (() => typeof window === 'undefined' ? undefined : window.sessionStorage);
  let initialized = false;
  let memory: TrafficAttribution | undefined;
  let inherited = false;
  let storage: TrafficSessionStorage | undefined;
  let storageResolved = false;

  function resolveStorage(): TrafficSessionStorage | undefined {
    if (!storageResolved) {
      storageResolved = true;
      try { storage = getStorage(); } catch { storage = undefined; }
    }
    return storage;
  }

  function removeStored(): void {
    try { resolveStorage()?.removeItem(TRAFFIC_ATTRIBUTION_SESSION_KEY); } catch { storage = undefined; }
  }

  function persist(): void {
    if (!memory) { removeStored(); return; }
    const encoded = JSON.stringify(memory);
    if (encoded.length > MAX_TRAFFIC_SESSION_LENGTH) { removeStored(); return; }
    try { resolveStorage()?.setItem(TRAFFIC_ATTRIBUTION_SESSION_KEY, encoded); } catch { storage = undefined; }
  }

  function readStored(now: number): TrafficAttribution | undefined {
    let encoded: string | null | undefined;
    try { encoded = resolveStorage()?.getItem(TRAFFIC_ATTRIBUTION_SESSION_KEY); } catch { storage = undefined; }
    if (!encoded) return undefined;
    if (encoded.length > MAX_TRAFFIC_SESSION_LENGTH) { removeStored(); return undefined; }
    try {
      const snapshot = sanitizeTrafficAttribution(JSON.parse(encoded), now);
      if (snapshot) return snapshot;
    } catch {
      // Malformed/foreign storage is discarded, never reported or logged.
    }
    removeStored();
    return undefined;
  }

  function readArrival(now: number): { snapshot: TrafficAttribution; navigationType?: string } | undefined {
    try {
      const context = readBrowser();
      if (!context || typeof context.url !== 'string' || typeof context.referrer !== 'string') return undefined;
      const snapshot = deriveTrafficAttribution({ url: context.url, referrer: context.referrer, now });
      return snapshot ? { snapshot, navigationType: context.navigationType } : undefined;
    } catch {
      // No accessible browser/URL means no recorded capture, distinct from captured direct/unknown.
      return undefined;
    }
  }

  function result(): Readonly<TrafficAttribution> | undefined {
    return memory ? Object.freeze({ ...memory, ...(inherited ? { inherited: true } : {}) }) : undefined;
  }

  function initialize(): Readonly<TrafficAttribution> | undefined {
    if (initialized) return getForCheckout();
    initialized = true;
    const now = clock();
    const arrival = readArrival(now);
    if (!arrival) return undefined;
    const previous = readStored(now);
    const continuation = arrival.navigationType === 'reload' || arrival.navigationType === 'back_forward';
    const sameArrival = previous && arrival.navigationType !== 'navigate' && sameHints(previous, arrival.snapshot);
    if (previous && (continuation || sameArrival || (hasMeaningfulHints(previous) && !hasMeaningfulHints(arrival.snapshot)))) {
      memory = previous;
      inherited = hasMeaningfulHints(previous);
    } else {
      // Reloaded URLs/referrers can still contain yesterday's ad hints after expiry; do not renew them.
      memory = continuation ? directSnapshot(arrival.snapshot) : arrival.snapshot;
    }
    persist();
    return result();
  }

  function getForCheckout(): Readonly<TrafficAttribution> | undefined {
    if (!initialized) return initialize();
    if (!memory) return undefined;
    const now = clock();
    const valid = sanitizeTrafficAttribution(memory, now);
    if (valid) {
      memory = valid;
      return result();
    }
    // Never renew stale UTM/referrer/click evidence during checkout or an internal SPA navigation.
    memory = undefined;
    inherited = false;
    removeStored();
    const current = readArrival(now);
    if (current) memory = directSnapshot(current.snapshot);
    persist();
    return result();
  }

  function reset(): void {
    memory = undefined;
    inherited = false;
    initialized = false;
    removeStored();
    storage = undefined;
    storageResolved = false;
  }

  return { initialize, getForCheckout, reset };
}

const browserSession = createTrafficAttributionSession();

export const initializeTrafficAttribution = browserSession.initialize;
/** Detached, frozen snapshot for the initial donation request only; verifier/status calls never reattribute. */
export const getTrafficAttributionForCheckout = browserSession.getForCheckout;
export const resetTrafficAttributionSession = browserSession.reset;
