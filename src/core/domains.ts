/**
 * Ad / popunder domain matching. Fully local: this is a static seed list bundled
 * into the extension. Matching a URL against it happens entirely in the browser —
 * DeadClick never makes a network request.
 */

// Known popunder / pop-redirect / aggressive ad networks. Suffix-matched against the
// resolved hostname (so `ads.popcash.net` matches `popcash.net`). Extend freely.
export const AD_DOMAINS: readonly string[] = [
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerclick.com',
  'adsterra.com',
  'exoclick.com',
  'exosrv.com',
  'juicyads.com',
  'adcash.com',
  'hilltopads.net',
  'clickadu.com',
  'ad-maven.com',
  'onclickads.net',
  'onclkds.com',
  'popunder.net',
  'trafficjunky.com',
  'trafficfactory.biz',
  'adnxs.com',
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'mgid.com',
  'revcontent.com',
  'zedo.com',
  'mybetterdl.com',
  'galaksion.com',
  'hvolasw.com',
  'highperformanceformat.com',
];

/**
 * True if the URL's hostname is (a subdomain of) a known ad domain.
 * Tolerant of malformed/relative URLs — returns false rather than throwing.
 */
export function isAdDomain(url: string | null | undefined, list: readonly string[] = AD_DOMAINS): boolean {
  if (!url) return false;
  let host: string;
  try {
    // Resolve relative URLs against a dummy base so we still get a hostname.
    host = new URL(url, 'https://_deadclick_base_.invalid').hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host || host === '_deadclick_base_.invalid') return false;
  return list.some((d) => host === d || host.endsWith('.' + d));
}
