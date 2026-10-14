import { ADMIN_FETCH_MS, ADMIN_KEY_STORAGE } from './adminTypes';
import { createAdminSessionStore } from './adminCmsSync';

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatWhen(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function adminHeaders(key: string): HeadersInit {
  return { Authorization: `Bearer ${key.trim()}` };
}

export async function fetchAdminJson<T>(url: string, key: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  const onAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) onAbort();
  else callerSignal?.addEventListener('abort', onAbort, { once: true });
  let timedOut = false;
  const timer = globalThis.setTimeout(() => { timedOut = true; controller.abort(); }, ADMIN_FETCH_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...adminHeaders(key),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let data: T & { error?: string; success?: boolean };
    try {
      data = JSON.parse(text) as T & { error?: string; success?: boolean };
    } catch {
      throw new Error('Could not reach the admin API. Check that the server is running.');
    }

    if (!res.ok || data?.success === false) {
      if (res.status === 429 || data.error?.toLowerCase().includes('too many')) {
        throw new Error('Too many admin requests. Wait 1–2 minutes, then try again.');
      }
      throw new AdminRequestError(data.error || 'Admin request failed.', res.status);
    }
    return data;
  } catch (err) {
    if (timedOut && !callerSignal?.aborted) {
      throw new Error('The request timed out. Check that the server is running and try again.');
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
  }
}

export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function downloadAdminPdf(
  url: string,
  key: string,
  fallbackName: string,
  init?: RequestInit,
): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ADMIN_FETCH_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...adminHeaders(key),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Could not download the PDF.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || fallbackName;
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The PDF download timed out. Please try again.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Admin download of branded donation receipt PDF. */
export async function downloadAdminDonationReceiptPdf(
  donationId: string,
  key: string,
  fallbackName: string,
): Promise<void> {
  await downloadAdminPdf(
    `/api/admin/donations/${encodeURIComponent(donationId)}/receipt.pdf`,
    key,
    fallbackName.endsWith('.pdf') ? fallbackName : `${fallbackName}.pdf`,
  );
}

const adminSession = createAdminSessionStore(() => sessionStorage, ADMIN_KEY_STORAGE);

export function storedAdminKey(): string { return adminSession.read(); }

export function persistAdminKey(key: string) {
  adminSession.persist(key);
}

export function clearAdminKey() {
  adminSession.clear();
}

export function serializeCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  const escape = (value: string | number) => {
    let text = String(value ?? '');
    // Quote escaping alone does not prevent spreadsheet formulas. Keep real numbers numeric.
    if (typeof value === 'string' && (/^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))) {
      text = `'${text}`;
    }
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
}

export function downloadCsv(filename: string, headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number>>): void {
  const csv = serializeCsv(headers, rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  const adminKey = storedAdminKey();
  if (adminKey) {
    void fetch('/api/admin/audit', {
      method: 'POST',
      headers: { ...adminHeaders(adminKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'admin_csv_export', meta: { filename } }),
    }).catch(() => undefined);
  }
}
