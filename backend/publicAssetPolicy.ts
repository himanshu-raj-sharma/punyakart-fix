/** The frontend and server bundles share dist; server sources must never be HTTP assets. */
export function isPrivateBuildPath(requestPath: string): boolean {
  let pathname: string;
  try { pathname = decodeURIComponent(requestPath).replace(/\\/g, '/').toLowerCase(); }
  catch { return true; }
  return pathname.split('/').some((part) => part.startsWith('.') && part !== '') ||
    /\.(?:cjs|mjs|map|ts|tsx|pem|key|env)(?:\/|$)/.test(pathname) ||
    /(?:^|\/)(?:package(?:-lock)?\.json|tsconfig\.json)(?:\/|$)/.test(pathname);
}

/** Per-IP budgets accommodate normal polling, while retaining bounded rate limiting. */
export const PUBLIC_POLL_LIMITS = {
  recent: { windowMs: 60_000, max: 30 },
  status: { windowMs: 60_000, max: 60 },
} as const;
