import { createHash, randomUUID } from 'node:crypto';
import type { StoredDonation } from './types.js';
import { normalizeClientIpAddress } from './ipAddress.js';
import {
  MongoMetaConversionRepository,
  type MetaConversionOutbox,
  type MetaDeliveryFailure,
  type MetaOutboxInsert,
  type MetaOutboxRecord,
  type MetaPurchaseEvent,
  type MetaSettlement,
} from './db/MongoMetaConversionRepository.js';

export interface MetaAttribution {
  consent: true;
  consentedAt: string;
  sourceUrl: string;
  fbp?: string;
  fbc?: string;
  clientUserAgent?: string;
  clientIpAddress?: string;
}

export interface MetaCapturedPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
}

export interface MetaConversionsService {
  readonly enabled: boolean;
  enqueuePurchase(donation: StoredDonation, payment: MetaCapturedPayment): Promise<void>;
  start(): () => void;
  flush(): Promise<void>;
  getDiagnostics(): Promise<object>;
}

export const META_PIXEL_ID = '1112592431188643';
export const META_DELIVERY_POLICY = Object.freeze({
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  expirySafetyMs: 60_000,
  requestTimeoutMs: 10_000,
  leaseMs: 60_000,
  pollMs: 10_000,
  baseRetryMs: 30_000,
  maxRetryMs: 60 * 60 * 1000,
  maxAttempts: 8,
  batchSize: 25,
});

type ConfigurationIssue =
  | 'missing_meta_pixel_id' | 'unsupported_meta_pixel_id'
  | 'missing_meta_capi_access_token' | 'invalid_meta_capi_access_token'
  | 'invalid_public_site_url' | 'invalid_meta_graph_api_version' | 'invalid_meta_capi_test_event_code';
export type MetaDiagnosticCode = ConfigurationIssue | MetaDeliveryFailure
  | 'enqueue_failed' | 'outbox_failed' | 'index_setup_failed' | 'lease_lost' | 'worker_start_failed';

interface Configuration {
  token: string;
  origin: string;
  endpoint: string;
  testEventCode?: string;
}

function httpsUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function readConfiguration(env: NodeJS.ProcessEnv): { config?: Configuration; issues: ConfigurationIssue[] } {
  const issues: ConfigurationIssue[] = [];
  if (!env.META_PIXEL_ID) issues.push('missing_meta_pixel_id');
  else if (env.META_PIXEL_ID !== META_PIXEL_ID) issues.push('unsupported_meta_pixel_id');
  const token = env.META_CAPI_ACCESS_TOKEN || '';
  if (!token) issues.push('missing_meta_capi_access_token');
  else if (token.length > 4096 || !/^[A-Za-z0-9._~+/-]+=*$/.test(token)) issues.push('invalid_meta_capi_access_token');
  const site = httpsUrl(env.PUBLIC_SITE_URL);
  if (!site || site.search || site.hash) issues.push('invalid_public_site_url');
  const version = env.META_GRAPH_API_VERSION ?? 'v22.0';
  if (!/^v[1-9]\d{0,2}\.\d{1,2}$/.test(version)) issues.push('invalid_meta_graph_api_version');
  const testEventCode = env.META_CAPI_TEST_EVENT_CODE;
  if (testEventCode !== undefined && !/^[A-Za-z0-9_-]{1,100}$/.test(testEventCode)) issues.push('invalid_meta_capi_test_event_code');
  if (issues.length) return { issues };
  return {
    issues,
    config: {
      token,
      origin: site!.origin,
      endpoint: `https://graph.facebook.com/${version}/${META_PIXEL_ID}/events`,
      ...(testEventCode ? { testEventCode } : {}),
    },
  };
}

/** Reject rollover dates, ambiguous local timestamps, and non-ISO values. */
function timestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  const canonical = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction: string | undefined) => `.${(fraction || '').padEnd(3, '0')}Z`);
  return Number.isFinite(milliseconds) && milliseconds > 0 && new Date(milliseconds).toISOString() === canonical ? milliseconds : null;
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function emailHash(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? hash(normalized) : undefined;
}

function phoneHash(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 40 || !/^\+?[\d\s().-]+$/.test(value.trim())) return undefined;
  let digits = value.replace(/\D/g, '');
  if (/^0091[6-9]\d{9}$/.test(digits)) digits = digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);
  if (/^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? hash(digits) : undefined;
}

function validCookie(value: unknown, click: boolean, now: number): value is string {
  if (typeof value !== 'string' || value.length > 512) return false;
  const expression = click ? /^fb\.[0-9]\.([0-9]{13})\.[A-Za-z0-9_-]{1,480}$/ : /^fb\.[0-9]\.([0-9]{13})\.[0-9]{1,100}$/;
  const match = expression.exec(value);
  return !!match && Number(match[1]) > 0 && Number(match[1]) <= now;
}

function preparePurchase(donation: StoredDonation, payment: MetaCapturedPayment, config: Configuration, now: number): MetaOutboxInsert | null {
  if (!donation || !payment || !Number.isFinite(now)) return null;
  if (donation.status !== 'verified' || donation.paymentMethod !== 'razorpay') return null;
  if (typeof donation.source !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(donation.source) || donation.source === 'manual') return null;
  if (payment.status !== 'captured' || (payment.captured !== undefined && payment.captured !== true)) return null;
  if (payment.currency !== 'INR' || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) return null;
  if (typeof donation.amount !== 'number' || !Number.isSafeInteger(donation.amount * 100) || payment.amount !== donation.amount * 100) return null;
  if (typeof donation.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(donation.id)) return null;
  if (typeof payment.id !== 'string' || !/^pay_[A-Za-z0-9]{1,64}$/.test(payment.id) || donation.paymentRef !== payment.id) return null;
  const verifiedAt = timestamp(donation.verifiedAt);
  if (verifiedAt === null || verifiedAt > now) return null;
  const eventTime = Math.floor(verifiedAt / 1000);
  const expiresAt = eventTime * 1000 + META_DELIVERY_POLICY.maxAgeMs - META_DELIVERY_POLICY.expirySafetyMs;
  if (expiresAt <= now) return null;
  const attribution = (donation as StoredDonation & { metaAttribution?: MetaAttribution }).metaAttribution;
  if (!attribution || typeof attribution !== 'object' || Array.isArray(attribution) || attribution.consent !== true) return null;
  const consentedAt = timestamp(attribution.consentedAt);
  if (consentedAt === null || consentedAt > verifiedAt) return null;
  const source = httpsUrl(attribution.sourceUrl);
  if (!source || source.origin !== config.origin) return null;
  source.search = '';
  source.hash = '';
  if (attribution.fbp !== undefined && !validCookie(attribution.fbp, false, now)) return null;
  if (attribution.fbc !== undefined && !validCookie(attribution.fbc, true, now)) return null;
  const rawAgent = attribution.clientUserAgent;
if (
  rawAgent !== undefined &&
  (
    typeof rawAgent !== 'string' ||
    !rawAgent.trim() ||
    rawAgent.length > 512 ||
    /[\x00-\x1f\x7f]/.test(rawAgent)
  )
) {
  return null;
}

const agent = typeof rawAgent === 'string' ? rawAgent : undefined;
const clientIpAddress = normalizeClientIpAddress(attribution.clientIpAddress);
  // Meta flags events that include a user agent without an IP. Include browser network
  // context only as a valid pair; missing optional attribution must not reject a real Purchase.
  const browserNetworkData = agent && clientIpAddress
    ? { client_user_agent: agent, client_ip_address: clientIpAddress }
    : {};
  const em = emailHash(donation.email);
  const ph = phoneHash(donation.phone);
  if (!em && !ph && !attribution.fbp && !attribution.fbc) return null;
  const event: MetaPurchaseEvent = {
    event_name: 'Purchase',
    event_id: donation.id,
    event_time: eventTime,
    action_source: 'website',
    event_source_url: source.href,
    custom_data: { value: payment.amount / 100, currency: 'INR' },
    user_data: {
      ...(em ? { em: [em] } : {}),
      ...(ph ? { ph: [ph] } : {}),
      ...(attribution.fbp ? { fbp: attribution.fbp } : {}),
      ...(attribution.fbc ? { fbc: attribution.fbc } : {}),
      ...browserNetworkData,
    },
  };
  return {
    // A duplicated financial row must not create a second server conversion for one gateway charge.
    // The event_id still matches the first canonical donation ID used by the browser.
    _id: `${META_PIXEL_ID}:Purchase:${payment.id}`,
    pixelId: META_PIXEL_ID,
    event,
    ...(config.testEventCode ? { testEventCode: config.testEventCode } : {}),
    createdAt: now,
    expiresAt,
  };
}

export interface MetaFetchResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface MetaWorkerTimer {
  unref(): void;
  cancel(): void;
}

/** Explicit injection boundary; tests need not import the server, load dotenv, or connect to Mongo/Meta. */
export interface MetaConversionsDependencies {
  outbox: MetaConversionOutbox;
  fetch: (url: string, init: RequestInit) => Promise<MetaFetchResponse>;
  now?: () => number;
  warn?: (code: MetaDiagnosticCode) => void;
  schedule?: (callback: () => void, intervalMs: number) => MetaWorkerTimer;
}

type DeliveryResult = { kind: 'delivered' } | { kind: 'retry' | 'dead'; reason: MetaDeliveryFailure };

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function classifyResponse(status: number, body: unknown): DeliveryResult {
  const object = asObject(body);
  const error = asObject(object?.error);
  const rateLimitCodes = [1, 2, 4, 17, 32, 341, 613, 80004];
  if (status === 408 || status === 429 || (status >= 500 && status <= 599)
    || error?.is_transient === true || (typeof error?.code === 'number' && rateLimitCodes.includes(error.code))) {
    return { kind: 'retry', reason: 'meta_transient' };
  }
  if (status >= 200 && status < 300 && object && object.error == null
    && Number.isSafeInteger(object.events_received) && (object.events_received as number) >= 1) {
    return { kind: 'delivered' };
  }
  return { kind: 'dead', reason: 'meta_rejected' };
}

async function deliver(record: MetaOutboxRecord, config: Configuration, fetcher: MetaConversionsDependencies['fetch']): Promise<DeliveryResult> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<DeliveryResult>(resolve => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve({ kind: 'retry', reason: 'network_or_timeout' });
    }, META_DELIVERY_POLICY.requestTimeoutMs);
    timeout.unref();
  });
  const request = (async (): Promise<DeliveryResult> => {
    try {
      const response = await fetcher(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          data: [record.event],
          ...(record.testEventCode ? { test_event_code: record.testEventCode } : {}),
        }),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        // Invalid JSON is a rejected response; interrupted body reads are network failures.
        if (error instanceof TypeError || controller.signal.aborted) return { kind: 'retry', reason: 'network_or_timeout' };
      }
      return classifyResponse(response.status, body);
    } catch {
      // Fetch/timeout errors can contain URLs, tokens, and response fragments. Never retain them.
      return { kind: 'retry', reason: 'network_or_timeout' };
    }
  })();
  try {
    // The race also bounds an injected/uncooperative fetch and a stalled response body.
    return await Promise.race([request, timedOut]);
  } finally {
    clearTimeout(timeout);
  }
}

/** The production constructor has no I/O and never starts a worker implicitly. */
export function createMetaConversionsService(env: NodeJS.ProcessEnv = process.env): MetaConversionsService {
  return createMetaConversionsServiceWithDependencies(env, {
    outbox: new MongoMetaConversionRepository(),
    fetch: (url, init) => globalThis.fetch(url, init),
  });
}

export function createMetaConversionsServiceWithDependencies(
  env: NodeJS.ProcessEnv,
  dependencies: MetaConversionsDependencies,
): MetaConversionsService {
  const { config, issues } = readConfiguration(env);
  const now = dependencies.now ?? Date.now;
  const outbox = dependencies.outbox;
  const schedule = dependencies.schedule ?? ((callback, intervalMs) => {
    const timer = setInterval(callback, intervalMs);
    return { unref: () => timer.unref(), cancel: () => clearInterval(timer) };
  });
  let lastIssue: MetaDiagnosticCode | null = null;
  const counters = { accepted: 0, rejected: 0, delivered: 0, retried: 0, dead: 0, errors: 0 };
  const warn = (code: MetaDiagnosticCode): void => {
    lastIssue = code;
    try {
      if (dependencies.warn) dependencies.warn(code);
      else console.warn(`[meta-capi] ${code}`);
    } catch {
      // Diagnostics must never turn an analytics failure into a donation failure.
    }
  };
  let indexesReady = false;
  let inFlight: Promise<void> | undefined;
  let stopWorker: (() => void) | undefined;
  const noop = (): void => {};

  async function runFlush(): Promise<void> {
    if (!config) return;
    if (!indexesReady) {
      try {
        await outbox.ensureIndexes();
        indexesReady = true;
      } catch {
        counters.errors++;
        warn('index_setup_failed');
        return;
      }
    }
    try {
      await outbox.retireExpired(META_PIXEL_ID, now(), META_DELIVERY_POLICY.maxAttempts);
      for (let processed = 0; processed < META_DELIVERY_POLICY.batchSize; processed++) {
        const owner = randomUUID();
        const record = await outbox.leaseNext({
          pixelId: META_PIXEL_ID,
          now: now(),
          leaseOwner: owner,
          leaseMs: META_DELIVERY_POLICY.leaseMs,
          maxAttempts: META_DELIVERY_POLICY.maxAttempts,
        });
        if (!record) break;
        // Guard an event that aged out while acquiring the lease; its event_time never changes.
        const result: DeliveryResult = record.expiresAt <= now()
          ? { kind: 'dead', reason: 'expired' }
          : await deliver(record, config, dependencies.fetch);
        const settledAt = now();
        let outcome: MetaSettlement;
        if (result.kind === 'delivered') outcome = { state: 'delivered' };
        else if (result.kind === 'dead') outcome = { state: 'dead', reason: result.reason };
        else {
          const delay = Math.min(META_DELIVERY_POLICY.maxRetryMs, META_DELIVERY_POLICY.baseRetryMs * 2 ** (record.attempts - 1));
          const nextAttemptAt = settledAt + delay;
          outcome = record.attempts >= META_DELIVERY_POLICY.maxAttempts
            ? { state: 'dead', reason: 'attempts_exhausted' }
            : nextAttemptAt >= record.expiresAt
              ? { state: 'dead', reason: 'expired' }
              : { state: 'pending', reason: result.reason, nextAttemptAt };
        }
        const owned = await outbox.settle(record._id, owner, settledAt, outcome);
        if (!owned) {
          warn('lease_lost');
          continue;
        }
        if (outcome.state === 'delivered') counters.delivered++;
        else {
          if (outcome.state === 'pending') counters.retried++;
          else counters.dead++;
          warn(outcome.reason);
        }
      }
    } catch {
      counters.errors++;
      warn('outbox_failed');
    }
  }

  const service: MetaConversionsService = {
    enabled: !!config,
    async enqueuePurchase(donation, payment) {
      if (!config) return;
      try {
        const entry = preparePurchase(donation, payment, config, now());
        if (!entry) {
          counters.rejected++;
          return;
        }
        await outbox.enqueue(entry);
        counters.accepted++;
      } catch {
        counters.errors++;
        warn('enqueue_failed');
      }
    },
    flush() {
      if (!config) return Promise.resolve();
      // No overlapping flushes in one instance; Mongo leases coordinate other processes.
      if (!inFlight) inFlight = runFlush().catch(() => {
        counters.errors++;
        warn('outbox_failed');
      }).finally(() => { inFlight = undefined; });
      return inFlight;
    },
    start() {
      if (!config) return noop;
      if (stopWorker) return stopWorker;
      try {
        const timer = schedule(() => { void service.flush(); }, META_DELIVERY_POLICY.pollMs);
        timer.unref();
        const stop = (): void => {
          // A stop handle from an earlier start cannot stop a newer worker.
          if (stopWorker !== stop) return;
          timer.cancel();
          stopWorker = undefined;
        };
        stopWorker = stop;
        void service.flush();
        return stop;
      } catch {
        warn('worker_start_failed');
        return noop;
      }
    },
    async getDiagnostics() {
      // Local health only: no raw events, URLs, contacts, tokens, errors, or DB I/O in diagnostics.
      return {
        enabled: !!config,
        disabledReasons: [...issues],
        pixelId: META_PIXEL_ID,
        testMode: !!config?.testEventCode,
        running: !!stopWorker,
        flushing: !!inFlight,
        indexesReady,
        lastIssue,
        counters: { ...counters },
      };
    },
  };
  return service;
}
