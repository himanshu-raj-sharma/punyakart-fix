/**
 * Browser timer methods are receiver-sensitive in some runtimes. Do not store
 * `window.setTimeout` in a plain object and invoke it as that object's method;
 * delegate through globalThis so the browser receives the correct receiver.
 */
export const browserTimers = {
  setTimeout: <T extends (...args: any[]) => void>(handler: T, timeout?: number, ...args: Parameters<T>) =>
    globalThis.setTimeout(handler, timeout, ...args),
  clearTimeout: (timer: ReturnType<typeof setTimeout> | undefined) => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
  },
};
