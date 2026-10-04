/**
 * Where a detail page should return to.
 *
 * The transaction and transfer detail pages used to send you to /history on
 * back, save, cancel and delete, whichever list you had actually come from —
 * so editing something you found on Overview dropped you somewhere else
 * entirely. The originating location rides along in the URL instead, which
 * survives a refresh and a shared link in a way `history.back()` does not.
 */

export const BACK_PARAM = 'from';

/** Attach the caller's own location to a detail-page href. */
export function withBackTarget(href: string, from: string): string {
  if (!from) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}${BACK_PARAM}=${encodeURIComponent(from)}`;
}

/**
 * Validate a `from` value read back off the URL.
 *
 * This is a redirect target taken from user-controllable input, so it has to
 * be a same-origin path and nothing else: without the check, a link carrying
 * `?from=https://evil.example` would walk someone out of the app the moment
 * they saved an edit.
 */
export function safeBackTarget(from: string | null | undefined, fallback: string): string {
  if (typeof from !== 'string' || from === '') return fallback;

  // Control characters are how a scheme gets smuggled past a prefix check, and
  // leading or trailing whitespace is how it gets smuggled past a trim. An
  // interior space is ordinary though — this value arrives already decoded, so
  // a search term like "trader joe" reaches here with a real space in it.
  if (/[\u0000-\u001f\u007f]/.test(from)) return fallback;
  if (from !== from.trim()) return fallback;

  // Must be a path. A leading "//" — or "/\", which browsers have read the
  // same way — is protocol-relative and therefore off-site.
  if (!from.startsWith('/')) return fallback;
  if (from.startsWith('//') || from.startsWith('/\\')) return fallback;

  return from;
}
