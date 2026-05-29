// Serverseitiges Retry mit Backoff für LLM-Aufrufe (Rate-Limits / Überlastung).

export function isRateLimit(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status === 429 || status === 502 || status === 503) return true;
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('rate-limit') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('overloaded') ||
    msg.includes('quota') ||
    msg.includes('temporarily')
  );
}

// Timeouts, Verbindungsabbrüche und 5xx gelten ebenfalls als (transient) retrybar.
export function isRetryable(e: unknown): boolean {
  if (isRateLimit(e)) return true;
  const status = (e as { status?: number })?.status;
  if (typeof status === 'number' && status >= 500) return true;
  const name = ((e as { name?: string })?.name ?? '').toLowerCase();
  const code = String((e as { code?: unknown })?.code ?? '').toLowerCase();
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    name.includes('timeout') || name.includes('connection') || name.includes('abort') ||
    code.includes('etimedout') || code.includes('econnreset') || code.includes('econnrefused') ||
    msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted') ||
    msg.includes('network') || msg.includes('connection error')
  );
}

function retryAfterMs(e: unknown): number {
  const headers = (e as { headers?: Record<string, string> })?.headers;
  const ra = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (!ra) return 0;
  const secs = Number(ra);
  return Number.isFinite(secs) ? secs * 1000 : 0;
}

/**
 * Führt fn aus und wiederholt bei Rate-Limit/Überlastung mit exponentiellem
 * Backoff (respektiert Retry-After-Header, wenn vorhanden).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number; maxDelayMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 4;
  const base = opts?.baseDelayMs ?? 1500;
  const maxDelay = opts?.maxDelayMs ?? 20000;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !isRetryable(e)) throw e;
      const backoff = Math.min(maxDelay, base * 2 ** attempt);
      const delay = Math.max(retryAfterMs(e), backoff) + Math.random() * 400;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
