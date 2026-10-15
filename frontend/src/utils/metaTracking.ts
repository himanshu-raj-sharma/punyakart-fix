export interface MetaTrackingPayload {
  consent: boolean;
  sourceUrl?: string;
  fbp?: string;
  fbc?: string;
}

interface MetaTrackingContext {
  cookie?: string;
  sourceUrl?: string;
}

export interface VerifiedMetaDonation {
  id?: string;
  amount?: number;
  /** Supplied by verification/status from the consent stored on the server. */
  metaTrackingAllowed?: boolean;
}

type MetaPixel = (...args: unknown[]) => void;

const LEGACY_PIXEL_ID = '922745934005234';
const OPT_IN_PIXEL_ID = '1112592431188643';
const MAX_IDENTIFIER_LENGTH = 255;
const MAX_SOURCE_URL_LENGTH = 2048;

/** Native Meta tracking is allowed only on the two canonical production hosts. */
export function isAllowedMetaBrowserHost(hostname: unknown): boolean {
  return typeof hostname === 'string' &&
    (hostname.toLowerCase() === 'punyakart.com' || hostname.toLowerCase() === 'www.punyakart.com');
}

function browserTrackingHostAllowed(): boolean {
  try {
    // The helper is also unit-tested in a non-browser process. Real browser
    // sessions always have window, so preview hosts are explicitly rejected.
    if (typeof window === 'undefined') return true;
    return isAllowedMetaBrowserHost(window.location.hostname);
  } catch {
    return false;
  }
}

function readIdentifier(cookie: unknown, name: '_fbp' | '_fbc'): string | undefined {
  if (typeof cookie !== 'string' || cookie.length > 32768) return undefined;
  const entry = cookie.split(';').find((part) => part.trim().startsWith(`${name}=`));
  if (!entry) return undefined;
  const rawValue = entry.trim().slice(name.length + 1);
  if (rawValue.length > MAX_IDENTIFIER_LENGTH * 3) return undefined;
  try {
    const value = decodeURIComponent(rawValue);
    if (value.length > MAX_IDENTIFIER_LENGTH) return undefined;
    const pattern = name === '_fbp'
      ? /^fb\.\d{1,3}\.\d{10,16}\.\d+$/
      : /^fb\.\d{1,3}\.\d{10,16}\.[A-Za-z0-9_-]+$/;
    return pattern.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192 || /[\u0000-\u0020\u007f]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    // URL.origin excludes credentials; query strings and fragments never leave checkout.
    const sourceUrl = `${url.origin}${url.pathname}`;
    if (sourceUrl.length > MAX_SOURCE_URL_LENGTH || /%(?![0-9a-f]{2})/i.test(url.pathname)) return undefined;
    return sourceUrl;
  } catch {
    return undefined;
  }
}

/** Pure payload construction: no context fields are accessed without explicit opt-in. */
export function createMetaTrackingPayload(consent: boolean, context: MetaTrackingContext = {}): MetaTrackingPayload {
  if (consent !== true) return { consent: false };
  const payload: MetaTrackingPayload = { consent: true };
  const sourceUrl = sanitizeSourceUrl(context.sourceUrl);
  const fbp = readIdentifier(context.cookie, '_fbp');
  const fbc = readIdentifier(context.cookie, '_fbc');
  if (sourceUrl) payload.sourceUrl = sourceUrl;
  if (fbp) payload.fbp = fbp;
  if (fbc) payload.fbc = fbc;
  return payload;
}

/** Read browser attribution only when creating an opted-in payment session. */
export function collectMetaTrackingPayload(consent: boolean): MetaTrackingPayload {
  if (consent !== true) return { consent: false };
  const context: MetaTrackingContext = {};
  try {
    if (typeof window !== 'undefined') context.sourceUrl = window.location.href;
  } catch {
    // Browser privacy settings can deny access. Consent does not require attribution.
  }
  try {
    if (typeof document !== 'undefined') context.cookie = document.cookie;
  } catch {
    // Cookies may be inaccessible or disabled.
  }
  return createMetaTrackingPayload(true, context);
}

/** Called only for a verified donation; targets each Pixel without broadcasting. */
export function dispatchMetaPurchase(
  donation: VerifiedMetaDonation | null | undefined,
  fbq: MetaPixel | undefined,
  trackedDonationIds: Set<string>,
): boolean {
  if (!browserTrackingHostAllowed()) return false;
  const amount = Number(donation?.amount);
  const donationId = typeof donation?.id === 'string' && donation.id.trim() ? donation.id : '';
  if (!Number.isFinite(amount) || amount <= 0 || typeof fbq !== 'function') return false;
  if (donationId && trackedDonationIds.has(donationId)) return false;

  const params = { value: Math.round(amount * 100) / 100, currency: 'INR' };
  let dispatched = false;
  const send = (pixelId: string, options?: { eventID: string }) => {
    try {
      if (options) fbq('trackSingle', pixelId, 'Purchase', params, options);
      else fbq('trackSingle', pixelId, 'Purchase', params);
      dispatched = true;
    } catch {
      // A blocked/broken third-party tracker must not interrupt a successful checkout.
    }
  };
  if (donationId) {
    // The exact donation ID is also the server-side CAPI event_id.
    const options = { eventID: donationId };
    send(LEGACY_PIXEL_ID, options);
    if (donation?.metaTrackingAllowed === true) {
      send(OPT_IN_PIXEL_ID, options);
    }
    if (dispatched) trackedDonationIds.add(donationId);
  } else {
    // Preserve legacy tracking, but never send the opt-in Pixel without a dedup ID.
    send(LEGACY_PIXEL_ID);
  }
  return dispatched;
}

/** Send checkout-start measurement only after the server has created a valid payment session. */
export function dispatchMetaInitiateCheckout(
  donationId: string,
  amountInput: number,
  consent: boolean,
  fbq: MetaPixel | undefined,
): boolean {
  if (!browserTrackingHostAllowed()) return false;
  const amount = Number(amountInput);
  if (consent !== true || typeof fbq !== 'function' ||
      typeof donationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(donationId) ||
      !Number.isFinite(amount) || amount <= 0) return false;
  try {
    fbq('trackSingle', OPT_IN_PIXEL_ID, 'InitiateCheckout',
      { value: Math.round(amount * 100) / 100, currency: 'INR' },
      { eventID: donationId });
    return true;
  } catch {
    // Tracking failure must never interrupt donation checkout.
    return false;
  }
}

export interface MetaAddToCartItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

function createMetaCartEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `atc_${crypto.randomUUID()}`;
    }
  } catch {
    // Fallback below is sufficient for a browser-only AddToCart event.
  }
  return `atc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

/** Track an actual campaign cart addition using its live unit price and quantity. */
export function dispatchMetaAddToCart(
  item: MetaAddToCartItem,
  fbq: MetaPixel | undefined,
): boolean {
  if (!browserTrackingHostAllowed()) return false;

  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  const unitPrice = Number(item.unitPrice);
  const quantity = Number(item.quantity);
  const value = Math.round(unitPrice * quantity * 100) / 100;

  if (
    !id || id.length > 128 || /[\u0000-\u001f\u007f]/.test(id) ||
    !name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name) ||
    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000 ||
    !Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 10_000_000 ||
    !Number.isFinite(value) || value <= 0
  ) return false;

  const eventId = createMetaCartEventId();
  const contents = [{ id, quantity, item_price: Math.round(unitPrice * 100) / 100 }];
  const params = {
    value,
    currency: 'INR',
    content_ids: [id],
    content_type: 'product',
    content_name: name,
    contents,
  };
  let dispatched = false;

  // This legacy Pixel already receives the site's browser Purchase events.
  // The CAPI-connected Pixel remains opt-in only; no consent is inferred here.
  if (typeof fbq === 'function') {
    try {
      fbq('trackSingle', LEGACY_PIXEL_ID, 'AddToCart', params, { eventID: eventId });
      dispatched = true;
    } catch {
      // A third-party tracking failure must never interrupt adding to cart.
    }
  }

  // Also expose a clean ecommerce object for GTM/GA4 variables; no donor data.
  try {
    if (typeof window !== 'undefined') {
      const browser = window as Window & { dataLayer?: Array<Record<string, unknown>> };
      if (!Array.isArray(browser.dataLayer)) browser.dataLayer = [];
      browser.dataLayer.push({
        event: 'add_to_cart',
        event_id: eventId,
        ecommerce: {
          currency: 'INR',
          value,
          items: [{ item_id: id, item_name: name, price: Math.round(unitPrice * 100) / 100, quantity }],
        },
      });
      dispatched = true;
    }
  } catch {
    // A blocked or missing GTM dataLayer must not interrupt cart behavior.
  }

  return dispatched;
}
