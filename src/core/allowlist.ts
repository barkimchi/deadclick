/**
 * Per-site allowlist helpers. The allowlist is the user's escape hatch: if DeadClick
 * ever breaks a legitimate site, the popdown toggle adds the host here and the site
 * is left completely alone. Pure functions over a string[] of hostnames.
 */

/** Reduce any URL (or bare host) to a lowercase registrable-ish hostname, sans `www.`. */
export function normalizeHost(input: string | null | undefined): string {
  if (!input) return '';
  let host = input.trim().toLowerCase();
  try {
    host = new URL(host.includes('://') ? host : 'https://' + host).hostname.toLowerCase();
  } catch {
    // fall through: treat input as a bare host string
  }
  return host.replace(/^www\./, '');
}

export function isAllowlisted(input: string, allowlist: readonly string[]): boolean {
  const host = normalizeHost(input);
  if (!host) return false;
  return allowlist.some((h) => {
    const n = normalizeHost(h);
    return host === n || host.endsWith('.' + n);
  });
}

/** Returns a NEW list with `input`'s host toggled on/off. Order-stable, de-duplicated. */
export function toggleAllowlist(input: string, allowlist: readonly string[]): string[] {
  const host = normalizeHost(input);
  if (!host) return [...allowlist];
  const exists = allowlist.map(normalizeHost).includes(host);
  if (exists) return allowlist.map(normalizeHost).filter((h) => h !== host);
  return [...allowlist.map(normalizeHost), host];
}
