import { normalizePathname } from './utils/appRoutes';

export function navigate(to: string, replace = false): void {
  const target = canonicalTarget(new URL(to, window.location.origin));
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === current) return;
  if (replace) window.history.replaceState(window.history.state, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function canonicalTarget(url: URL): string {
  const redirects: Record<string, string> = {
    '#admin': '/admin',
    '#admin/donors': '/admin/donors',
    '#admin/certificates': '/admin/certificates',
    '#admin/manual': '/admin/manual',
    '#admin/receipt': '/admin/receipt',
    '#staff': '/admin/staff',
    '#crowd-funding-page': '/campaigns',
    '#80g': '/?80g=1',
    '#80g-certificate': '/?80g=1',
    '#receipt': '/?receipt=1',
    '#donation-receipt': '/?receipt=1',
  };
  const next = redirects[url.hash];
  if (next) {
    const redirect = new URL(next, url.origin);
    url.pathname = redirect.pathname;
    redirect.searchParams.forEach((value, key) => url.searchParams.set(key, value));
    url.hash = '';
  }
  url.pathname = normalizePathname(url.pathname);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function migrateLegacyHash(): void {
  if (window.location.hash) navigate(window.location.href, true);
}

export function getCurrentPathname(): string {
  return new URL(canonicalTarget(new URL(window.location.href)), window.location.origin).pathname;
}

export function subscribeToPathname(onChange: () => void): () => void {
  const sync = () => {
    const target = canonicalTarget(new URL(window.location.href));
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target !== current) window.history.replaceState(window.history.state, '', target);
    onChange();
  };
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  // Canonicalize initial/deep links and changes made before React subscribed.
  sync();
  return () => {
    window.removeEventListener('popstate', sync);
    window.removeEventListener('hashchange', sync);
  };
}
