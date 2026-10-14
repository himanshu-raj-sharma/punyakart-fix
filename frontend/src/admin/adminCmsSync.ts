import { isValidDonationAmount, MAX_DONATION_AMOUNT, MIN_DONATION_AMOUNT } from '../constants/donation';

/** Owns refresh authority independently of whether a transport honors cancellation. */
export function createAdminRequestAuthority() {
  let active = false;
  let generation = 0;
  let controller: AbortController | undefined;
  const invalidate = () => {
    generation += 1;
    controller?.abort();
    controller = undefined;
  };
  return {
    activate() { active = true; },
    deactivate() { active = false; invalidate(); },
    begin() {
      if (!active) return null;
      invalidate();
      const currentGeneration = generation;
      const currentController = new AbortController();
      controller = currentController;
      return {
        signal: currentController.signal,
        isCurrent: () => active && generation === currentGeneration && !currentController.signal.aborted,
        finish: () => currentController.abort(),
      };
    },
  };
}

/** Commas are separators, never thousands-grouping characters or missing values. */
export function parseCampaignDonationPresets(value: string): number[] {
  if (!value.trim()) return [];
  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.length > 12 || entries.some((entry) => !/^\d+$/.test(entry)
    || !isValidDonationAmount(Number(entry)))) {
    throw new Error(`Enter up to 12 whole-rupee donation amounts from ₹${MIN_DONATION_AMOUNT} to ₹${MAX_DONATION_AMOUNT.toLocaleString('en-IN')}, separated by commas. Do not use commas inside an amount or leave empty entries.`);
  }
  return entries.map(Number);
}

export function validateCampaignContentAmounts(content: Record<string, unknown>): void {
  for (const [field, amountField] of [
    ['contribution_cards', 'price'], ['about_cards', 'supportAmount'], ['recovery_stories', 'supportAmount'],
  ]) {
    const cards = content[field];
    if (cards === undefined) continue;
    if (!Array.isArray(cards)) throw new Error(`Content ${field} must be an array.`);
    cards.forEach((card: unknown, index) => {
      const amount = card && typeof card === 'object' ? (card as Record<string, unknown>)[amountField] : undefined;
      if (typeof amount !== 'number' || !isValidDonationAmount(amount)) {
        throw new Error(`Content ${field}[${index}].${amountField} must be a whole-rupee amount from ₹${MIN_DONATION_AMOUNT} to ₹${MAX_DONATION_AMOUNT.toLocaleString('en-IN')}.`);
      }
    });
  }
}

/** Memory is document/session-scoped; a logout tombstone wins even if removal is blocked. */
export function createAdminSessionStore(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, name: string) {
  let memory: string | undefined;
  return {
    read(): string {
      if (memory !== undefined) return memory;
      try { return storage().getItem(name) || ''; } catch { return ''; }
    },
    persist(value: string) {
      memory = value.trim();
      try { storage().setItem(name, memory); } catch { /* This document can use its in-memory session. */ }
    },
    clear() {
      memory = '';
      try { storage().removeItem(name); } catch { /* Never restore inaccessible storage after logout. */ }
    },
  };
}
