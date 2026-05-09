export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry on 429 (rate-limit) and 5xx (server error).
 * - 429: waits Retry-After seconds (default 60s) then retries.
 * - 5xx: exponential backoff starting at baseDelayMs.
 * - Network error: same exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
        const wait = (isNaN(retryAfter) ? 60 : retryAfter) * 1000;
        console.warn(
          `[http] 429 rate-limited on ${url} — waiting ${wait / 1000}s (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
        continue;
      }

      if (res.status >= 500) {
        const wait = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[http] ${res.status} server error on ${url} — backoff ${Math.round(wait)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[http] network error on ${url} — backoff ${Math.round(wait)}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await delay(wait);
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry: exhausted retries for ${url}`);
}
