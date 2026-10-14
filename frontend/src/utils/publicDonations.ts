import { browserFetch } from './browserFetch';
import { browserTimers } from './browserTimers';

/** The only donor identity safe to display is the server's public `name`. */
export interface PublicDonation {
  id: string;
  name: string;
  amount: number;
  date: string;
}

export type PublicFeedStatus = 'loading' | 'ready' | 'error';
export interface PublicDonationFeed {
  source: string;
  donations: PublicDonation[];
  status: PublicFeedStatus;
}

export function parsePublicDonations(value: unknown): PublicDonation[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid public donation response');
  const response = value as Record<string, unknown>;
  if (response.success !== true || !Array.isArray(response.donations)) {
    throw new Error('Public donations unavailable');
  }
  const seen = new Set<string>();
  return response.donations.map((value: unknown): PublicDonation => {
    if (!value || typeof value !== 'object') throw new Error('Invalid public donation');
    const d = value as Record<string, unknown>;
    if (typeof d.id !== 'string' || !d.id.trim() ||
        typeof d.name !== 'string' || !d.name.trim() ||
        typeof d.amount !== 'number' || !Number.isFinite(d.amount) || d.amount <= 0 ||
        typeof d.date !== 'string' || !d.date.trim() || !Number.isFinite(Date.parse(d.date))) {
      throw new Error('Invalid public donation');
    }
    // Explicitly project the public contract. Never spread private or legacy fields.
    return { id: d.id.trim(), name: d.name.trim(), amount: d.amount, date: d.date.trim() };
  }).filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

export const publicFeedForSource = (feed: PublicDonationFeed, source: string): PublicDonationFeed =>
  feed.source === source ? feed : { source, donations: [], status: 'loading' };

export function donorFeedMessage(status: PublicFeedStatus, count: number): string | null {
  if (status === 'loading') return 'Loading recent donations…';
  if (status === 'error') return 'Recent donations are temporarily unavailable. Retrying…';
  return count === 0 ? 'No recent donations to display.' : null;
}

export const publicStat = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export const formatDonationAmount = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { currency: 'INR', maximumFractionDigits: 2, style: 'currency' }).format(amount);

export function formatRelativeTime(date: string, now = Date.now()): string {
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return '';
  const difference = timestamp - now;
  const absoluteDifference = Math.abs(difference);
  if (absoluteDifference < 60_000) return difference <= 0 ? 'just now' : 'in less than a minute';
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000], ['month', 2_592_000_000], ['day', 86_400_000],
    ['hour', 3_600_000], ['minute', 60_000],
  ];
  const [unit, milliseconds] = units.find(([, duration]) => absoluteDifference >= duration)!;
  return new Intl.RelativeTimeFormat('en', { numeric: 'always' }).format(Math.round(difference / milliseconds), unit);
}

/** Serial polling: a new 15s wait begins only after the current request settles. */
export function startPublicDonationPolling(
  source: string,
  limit: number,
  publish: (feed: PublicDonationFeed) => void,
  transport: typeof fetch = browserFetch,
  timers = browserTimers,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  publish({ source, donations: [], status: 'loading' });
  const poll = async () => {
    try {
      const response = await transport(`/api/donations/recent?limit=${limit}&source=${encodeURIComponent(source)}`, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!response.ok) throw new Error('Public donations unavailable');
      const donations = parsePublicDonations(await response.json());
      if (active) publish({ source, donations, status: 'ready' });
    } catch {
      if (active) publish({ source, donations: [], status: 'error' });
    } finally {
      if (active) timer = timers.setTimeout(() => { void poll(); }, 15_000);
    }
  };
  void poll();
  return () => {
    active = false;
    controller.abort();
    if (timer !== undefined) timers.clearTimeout(timer);
  };
}

/** Restartable toast rotation; cleanup during the hide phase cannot strand the next list. */
export function startDonationRotation(
  count: number,
  show: (visible: boolean) => void,
  advance: () => void,
  timers = browserTimers,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  show(true);
  const schedule = () => {
    timer = timers.setTimeout(() => {
      if (!active) return;
      show(false);
      timer = timers.setTimeout(() => {
        if (!active) return;
        advance();
        show(true);
        schedule();
      }, 400);
    }, 6_500);
  };
  if (count > 1) schedule();
  return () => {
    active = false;
    if (timer !== undefined) timers.clearTimeout(timer);
  };
}
