// Utility module providing delay and rate-limiting functions for Cloudflare Workers.
// Primarily used to enforce OpenRouter AI request rate limits (max 5 requests per minute).

/**
 * Asynchronous delay utility.
 * Returns a Promise that resolves after specified milliseconds.
 * Used for rate-limiting, throttling, and delaying operations.
 *
 * @param ms - Milliseconds to delay (default: 3000)
 * @returns Promise that resolves after the delay
 */
export async function delay(ms: number = 3000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a promise that wraps a function call with a delay.
 * Useful for rate-limiting sequential API calls (e.g., OpenRouter AI requests).
 *
 * @param fn - Function to execute after delay
 * @param ms - Delay in milliseconds (default: 3000)
 * @returns Promise that resolves with function result
 */
export async function delayedInvoke<T, R extends any[] = any>(
  fn: (...args: R) => T,
  ms: number = 3000,
  ...args: R
): Promise<T> {
  await delay(ms);
  return fn(...args);
}

/**
 * Creates a rate-limited wrapper for functions.
 * Ensures function calls don't exceed specified maximum calls per period.
 * Implements sliding window algorithm for accurate rate limiting.
 *
 * @param fn - Function to rate-limit
 * @param maxCalls - Maximum number of calls allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate-limited function
 */
export function rateLimit<T, R extends any[] = any>(
  fn: (...args: R) => T,
  maxCalls: number = 5,
  windowMs: number = 60000,
): (...args: R) => Promise<T> {
  const calls: number[] = [];

  return async (...args: R): Promise<T> => {
    const now = Date.now();
    // Remove calls older than the window
    while (calls.length > 0 && calls[0] <= now - windowMs) {
      calls.shift();
    }

    if (calls.length >= maxCalls) {
      const waitTime = calls[0] - (now - windowMs);
      await delay(waitTime);
      return fn(...args);
    }

    calls.push(now);
    return fn(...args);
  };
}
