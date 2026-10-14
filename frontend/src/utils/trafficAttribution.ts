/** A best-effort arrival hint, never proof of identity or of paid advertising. */
export interface TrafficAttribution {
  version: 1;
  source: string;
  evidence: 'utm' | 'referrer' | 'click_id' | 'none';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  referrerHost?: string;
  landingPath?: string;
  capturedAt: string;
  inherited?: boolean;
  hasMetaClick?: boolean;
  hasGoogleClick?: boolean;
}

export const TRAFFIC_ATTRIBUTION_TTL_MS = 30 * 60 * 1000;
export const MAX_TRAFFIC_UTM_LENGTH = 100;
const MAX_URL_LENGTH = 8192;

const SOURCE_ALIASES: Record<string, string> = {
  fb: 'facebook', facebook: 'facebook',
  ig: 'instagram', instagram: 'instagram',
  wa: 'whatsapp', whatsapp: 'whatsapp',
  google: 'google', bing: 'bing', youtube: 'youtube', yt: 'youtube',
  linkedin: 'linkedin', telegram: 'telegram', tg: 'telegram',
  twitter: 'x', x: 'x', meta: 'meta',
  // Meta placement macros can also identify Messenger/Audience Network, not Facebook itself.
  msg: 'meta', messenger: 'meta', an: 'meta', audience_network: 'meta',
};

const REFERRER_DOMAINS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['facebook', ['facebook.com', 'fb.com', 'fb.me', 'fb.watch']],
  ['instagram', ['instagram.com']],
  ['whatsapp', ['whatsapp.com', 'wa.me']],
  ['google', ['google.com', 'google.co.in', 'google.co.uk', 'google.com.au', 'google.ca',
    'google.de', 'google.fr', 'google.co.jp', 'google.co.nz', 'google.com.sg', 'google.ae', 'g.co']],
  ['bing', ['bing.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['linkedin', ['linkedin.com', 'lnkd.in']],
  ['telegram', ['telegram.org', 'telegram.me', 't.me']],
  ['x', ['twitter.com', 'x.com', 't.co']],
];

function isDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Reject rather than truncate/repair unsafe labels, so private input cannot become a partial label. */
export function sanitizeTrafficUtm(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length > MAX_TRAFFIC_UTM_LENGTH || /[^\u0020-\u007e]/.test(input)) {
    return undefined;
  }
  const value = input.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_. -]*$/.test(value)) return undefined;
  // Dotted campaign labels remain usable, but obvious URLs, phone numbers and ad-template labels do not.
  if (/\bwww\./i.test(value) || /\.(?:com|org|net|edu|gov|io|co|in|uk|test|invalid)(?:$|[ .])/i.test(value)) return undefined;
  if (/\d(?:[ ._-]*\d){6,}/.test(value)) return undefined;
  if (/^(?:undefined|null|not[ _.-]set|utm_(?:source|medium|campaign|content)|(?:campaign|adset|ad)[_. -](?:name|id))$/i.test(value)) {
    return undefined;
  }
  return value || undefined;
}

function sanitizeReferrerHost(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length > 253) return undefined;
  const host = input.toLowerCase().replace(/\.$/, '');
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return undefined;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1]) || isDomain(host, 'punyakart.com')) return undefined;
  return host;
}

/** Only public route shapes, never account/admin/receipt routes or arbitrary URL paths. */
export function sanitizeTrafficLandingPath(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length > 100) return undefined;
  const path = input.length > 1 ? input.replace(/\/$/, '') : input;
  if (['/', '/campaigns', '/crowd-funding', '/blogs', '/privacy', '/terms', '/refund'].includes(path)) return path;
  const match = path.match(/^\/(campaigns|crowd-funding|blogs)\/([a-z][a-z0-9-]{0,63})$/i);
  if (!match || /(?:^|-)(?:admin|login|logout|receipt|token|auth|account|password|donor|payment)(?:-|$)/i.test(match[2])) return undefined;
  if (/\d(?:-*\d){6,}/.test(match[2]) || /^[a-f0-9]{16,}$/i.test(match[2])) return undefined;
  return path;
}

function classify(hints: TrafficAttribution): Pick<TrafficAttribution, 'source' | 'evidence'> {
  if (hints.utmSource) {
    const key = hints.utmSource.toLowerCase();
    return { source: Object.hasOwn(SOURCE_ALIASES, key) ? SOURCE_ALIASES[key] : 'other', evidence: 'utm' };
  }
  // Even an unknown external hostname is a referral; a known referrer beats ambiguous click parameters.
  if (hints.referrerHost) {
    const known = REFERRER_DOMAINS.find(([, domains]) => domains.some((domain) => isDomain(hints.referrerHost!, domain)));
    return { source: known?.[0] ?? 'referral', evidence: 'referrer' };
  }
  // fbclid does not distinguish Facebook from Instagram. Both click flags remain ambiguous Meta evidence.
  if (hints.hasMetaClick) return { source: 'meta', evidence: 'click_id' };
  if (hints.hasGoogleClick) return { source: 'google', evidence: 'click_id' };
  return { source: 'direct_unknown', evidence: 'none' };
}

/** Shared ingress validation. Never trust posted source/evidence/inherited, and never renew the timestamp. */
export function sanitizeTrafficAttribution(input: unknown, now: number = Date.now()): TrafficAttribution | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Number.isFinite(now)) return undefined;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.capturedAt)) return undefined;
  const captured = Date.parse(raw.capturedAt);
  if (!Number.isFinite(captured) || new Date(captured).toISOString() !== raw.capturedAt || captured > now || now - captured >= TRAFFIC_ATTRIBUTION_TTL_MS) return undefined;
  const result: TrafficAttribution = { version: 1, source: 'direct_unknown', evidence: 'none', capturedAt: raw.capturedAt };
  for (const field of ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent'] as const) {
    const value = sanitizeTrafficUtm(raw[field]);
    if (value) result[field] = value;
  }
  const host = sanitizeReferrerHost(raw.referrerHost);
  const path = sanitizeTrafficLandingPath(raw.landingPath);
  if (host) result.referrerHost = host;
  if (path) result.landingPath = path;
  if (raw.hasMetaClick === true) result.hasMetaClick = true;
  if (raw.hasGoogleClick === true) result.hasGoogleClick = true;
  return { ...result, ...classify(result) };
}

function parseWebUrl(input: unknown): URL | undefined {
  if (typeof input !== 'string' || input.length > MAX_URL_LENGTH || /[\u0000-\u0020\u007f]/.test(input)) return undefined;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

export interface TrafficArrival {
  url: unknown;
  referrer?: unknown;
  now?: number;
}

/** Raw URLs are read only here; only the strict allowlisted snapshot can leave this function. */
export function deriveTrafficAttribution({ url, referrer, now = Date.now() }: TrafficArrival): TrafficAttribution | undefined {
  const arrival = parseWebUrl(url);
  if (!arrival || !Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return undefined;
  const hints: Record<string, unknown> = {
    version: 1,
    capturedAt: new Date(now).toISOString(),
    landingPath: arrival.pathname,
  };
  for (const [param, field] of [
    ['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'],
    ['utm_campaign', 'utmCampaign'], ['utm_content', 'utmContent'],
  ]) {
    const values = arrival.searchParams.getAll(param);
    if (values.length === 1) hints[field] = values[0];
  }
  // Presence only: never read or retain the actual click ID value.
  hints.hasMetaClick = arrival.searchParams.has('fbclid');
  hints.hasGoogleClick = arrival.searchParams.has('gclid');
  const external = parseWebUrl(referrer);
  const normalizeOwnHost = (host: string) => host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (external && normalizeOwnHost(external.hostname) !== normalizeOwnHost(arrival.hostname)) {
    hints.referrerHost = external.hostname;
  }
  return sanitizeTrafficAttribution(hints, now);
}
