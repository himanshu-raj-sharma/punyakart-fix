import {
  sanitizeTrafficAttribution,
  type TrafficAttribution,
} from '../frontend/src/utils/trafficAttribution.js';

/** Read old saved records without expiring their history or exposing arbitrary stored fields. */
export function storedTrafficAttribution(input: unknown): TrafficAttribution | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;
  if (typeof raw.capturedAt !== 'string') return undefined;
  const atCapture = Date.parse(raw.capturedAt);
  // Incoming checkout payloads instead use real server time and the 30-minute ingress check.
  const clean = sanitizeTrafficAttribution(input, atCapture);
  return clean ? { ...clean, ...(raw.inherited === true ? { inherited: true } : {}) } : undefined;
}

/** Later recurring debits did not generate a new browser visit. Preserve only their signup provenance. */
export function inheritedTrafficAttribution(input: unknown): TrafficAttribution | undefined {
  const clean = storedTrafficAttribution(input);
  return clean ? { ...clean, inherited: true } : undefined;
}
