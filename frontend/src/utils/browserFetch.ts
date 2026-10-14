/**
 * Fetch must be invoked with the global object as its receiver in browsers.
 * Keeping the wrapper here prevents hooks from passing a detached `fetch`
 * function into polling code, which causes Chrome's "Illegal invocation".
 */
export const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
