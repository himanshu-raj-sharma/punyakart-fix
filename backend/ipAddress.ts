import { isIP } from 'node:net';

/**
 * Validate a client address resolved by the server/proxy. Express and some
 * reverse proxies may represent an IPv4 address as an IPv4-mapped IPv6 value
 * (for example, ::ffff:203.0.113.10). Normalize that representation before
 * sending it to downstream analytics providers.
 */
export function normalizeClientIpAddress(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 45) return undefined;
  // Do not silently trim or accept whitespace/control characters in an address.
  if (/[\x00-\x20\x7f]/.test(value)) return undefined;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return isIP(mapped[1]) === 4 ? mapped[1] : undefined;

  return isIP(value) > 0 ? value : undefined;
}
