import { browserFetch } from './browserFetch';

export interface PublicSnapshot<T> {
  source: string;
  data: T | null;
  status: 'loading' | 'ready' | 'error';
}

export function snapshotForSource<T>(snapshot: PublicSnapshot<T>, source: string): PublicSnapshot<T> {
  return snapshot.source === source ? snapshot : { source, data: null, status: 'loading' };
}

/** Serial refreshes with bounded requests; a stale snapshot is readable but never live. */
export function startPublicSnapshotPolling<T>(
  source: string,
  parse: (payload: unknown) => T,
  publish: (snapshot: PublicSnapshot<T>) => void,
  transport: typeof fetch = browserFetch,
  timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
) {
  let active = true;
  let lastGood: T | null = null;
  let next: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  publish({ source, data: null, status: 'loading' });
  const poll = async () => {
    const request = new AbortController();
    controller = request;
    try {
      const timeout = new Promise<never>((_, reject) => {
        deadline = timers.setTimeout(() => {
          request.abort();
          reject(new Error('Campaign request timed out'));
        }, 10_000);
      });
      const data = await Promise.race([
        (async () => {
          const response = await transport(source, { signal: request.signal, cache: 'no-store' });
          if (!response.ok) throw new Error('Campaign unavailable');
          return parse(await response.json());
        })(),
        timeout,
      ]);
      if (active && !request.signal.aborted) {
        lastGood = data;
        publish({ source, data, status: 'ready' });
      }
    } catch {
      if (active) publish({ source, data: lastGood, status: 'error' });
    } finally {
      timers.clearTimeout(deadline);
      if (active) next = timers.setTimeout(() => { void poll(); }, 30_000);
    }
  };
  void poll();
  return () => {
    active = false;
    controller?.abort();
    timers.clearTimeout(next);
    timers.clearTimeout(deadline);
  };
}

export function campaignDonationAvailable(status: PublicSnapshot<unknown>['status'], campaign: { is_active?: boolean } | null): boolean {
  return status === 'ready' && campaign?.is_active === true;
}

export function campaignAvailabilityMessage(status: PublicSnapshot<unknown>['status']): string {
  return status === 'loading'
    ? 'Confirming campaign availability. Donations are unavailable until this campaign is confirmed active.'
    : status === 'error'
      ? 'Campaign availability could not be refreshed. Donations are temporarily unavailable; any displayed campaign details are the last confirmed snapshot.'
      : 'This campaign is currently inactive. Donations are unavailable.';
}
