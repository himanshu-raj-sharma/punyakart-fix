export interface PaymentAttempt {
  signal: AbortSignal;
  isCurrent: () => boolean;
  cancel: () => void;
  complete: (value: unknown, expected: { id: string; amount: number }) => boolean;
}

/** UI authority only: the server remains responsible for payment verification. */
export function createPaymentSessionAuthority() {
  let current: PaymentAttempt | undefined;
  function createAttempt(): PaymentAttempt {
    const controller = new AbortController();
    let completed = false;
    const attempt: PaymentAttempt = {
      signal: controller.signal,
      isCurrent: () => current === attempt && !controller.signal.aborted && !completed,
      cancel: () => controller.abort(),
      complete(value: unknown, expected: { id: string; amount: number }): boolean {
        if (!attempt.isCurrent() || !value || typeof value !== 'object') return false;
        const donation = value as Record<string, unknown>;
        if (donation.id !== expected.id || donation.status !== 'verified' ||
            donation.amount !== expected.amount || !Number.isFinite(expected.amount) || expected.amount <= 0) return false;
        completed = true;
        controller.abort();
        return true;
      },
    };
    return attempt;
  }
  return {
    begin() {
      current?.cancel();
      const next = createAttempt();
      current = next;
      return next;
    },
    cancel() { current?.cancel(); current = undefined; },
  };
}
