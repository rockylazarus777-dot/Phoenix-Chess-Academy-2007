import "server-only";

/**
 * Rate-limiting foundation for public form submission Server Actions.
 *
 * IMPORTANT — READ BEFORE RELYING ON THIS IN PRODUCTION:
 * `InMemoryRateLimiter` below is NOT production-safe on Vercel/serverless.
 * Each invocation may run in a different, short-lived function instance
 * with its own memory — there is no shared state across instances or
 * across cold starts, so this only limits repeated submissions that
 * happen to land on the same warm instance in quick succession. It is
 * intentionally still wired up (rather than left as a no-op) because it
 * costs nothing, catches the crudest abuse pattern (a script hammering
 * one instance), and gives every Server Action a single interface to
 * call — so swapping in a real distributed limiter (e.g. Upstash Redis,
 * per Vercel's own rate-limiting guidance) later is a one-file change,
 * not a rewrite of every form action.
 *
 * Phase 7 explicitly excludes installing a paid rate-limiting service —
 * see docs/DATABASE_ARCHITECTURE.md, "Rate Limiting Foundation", for the
 * documented limitation and what a production upgrade looks like.
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  windowStartedAt: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStartedAt > this.windowMs) {
      this.buckets.set(key, { count: 1, windowStartedAt: now });
      return { allowed: true };
    }

    if (existing.count >= this.limit) {
      return { allowed: false, retryAfterMs: this.windowMs - (now - existing.windowStartedAt) };
    }

    existing.count += 1;
    return { allowed: true };
  }
}

/** A limiter that never blocks — used if rate limiting is disabled entirely. */
class NoopRateLimiter implements RateLimiter {
  async check(): Promise<RateLimitResult> {
    return { allowed: true };
  }
}

// One shared instance per form type per server process — deliberately
// generous (not a substitute for a real distributed limiter, just a
// crude backstop). 5 submissions per 60s per key.
const formSubmissionLimiter: RateLimiter = new InMemoryRateLimiter(5, 60_000);

export function getFormSubmissionRateLimiter(): RateLimiter {
  return formSubmissionLimiter;
}

// PHASE 9 — a separate instance (not the form-submission one above) for
// login/forgot-password: brute-force login attempts and public-form spam
// are different abuse patterns worth tracking independently, even though
// they share the exact same `InMemoryRateLimiter` implementation and the
// exact same production limitation described above. Slightly tighter
// than the form limiter (5 attempts per 60s per key) since credential
// guessing is a higher-value target than a spammed contact form.
const authLimiter: RateLimiter = new InMemoryRateLimiter(5, 60_000);

export function getAuthRateLimiter(): RateLimiter {
  return authLimiter;
}

export function getNoopRateLimiter(): RateLimiter {
  return new NoopRateLimiter();
}

/**
 * Honeypot check — `value` should come from a form field that is never
 * visible to real users (hidden via CSS, not `type="hidden"`, so simple
 * bots that only skip hidden inputs still fill it in) and has no
 * `name` a password manager would recognize. A non-empty value means a
 * bot filled in a field a human never sees.
 *
 * This is NOT complete bot protection on its own — see
 * docs/DATABASE_ARCHITECTURE.md, "Rate Limiting Foundation".
 */
export function isHoneypotTriggered(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}
