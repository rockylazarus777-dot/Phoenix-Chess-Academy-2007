/**
 * Open-redirect guard. Only ever allow an internal, relative path —
 * never an absolute URL, protocol-relative URL ("//evil.example"), or a
 * "javascript:" pseudo-protocol. Used by /auth/callback's `next` query
 * parameter, which is normally set by this app's own
 * `resetPasswordForEmail` call but still arrives to the route handler as
 * untrusted request input and must be validated the same way regardless
 * of who "usually" sets it.
 */
export function resolveSafeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();

  if (!trimmed.startsWith("/")) return null; // must be relative
  if (trimmed.startsWith("//")) return null; // protocol-relative external URL
  if (trimmed.includes("://")) return null; // absolute URL smuggled into a relative-looking string
  if (trimmed.toLowerCase().includes("javascript:")) return null;

  return trimmed;
}
