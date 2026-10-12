const HTTP_URL = /^https?:\/\//i;
const GOOGLE_HOST = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/;

/**
 * Key for per-URL notes. Kept identical to the pre-4.0 format (origin + path + query, no hash)
 * so notes saved by older versions keep matching.
 */
export function normalizeUrlKey(url: string): string | null {
  try {
    const u = new URL(url);
    return u.origin + u.pathname + u.search;
  } catch {
    return null;
  }
}

/** Lower-cases a host and strips a leading `www.`. */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

export function hostFromUrl(url: string): string | null {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

export function isGoogleHost(host: string | null): boolean {
  return !!host && GOOGLE_HOST.test(host);
}

export function isYouTubeHost(host: string | null): boolean {
  return host === "youtube.com" || host === "youtu.be" || !!host?.endsWith(".youtube.com");
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the real destination of a result link. Google sometimes wraps links in
 * `/url?q=<target>`; plain absolute links are returned as is. Returns `null` for
 * anything that is not an http(s) URL.
 */
export function extractFinalUrl(href: string, baseUrl: string): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const sameOrigin = url.origin === safeOrigin(baseUrl);
  if (url.pathname === "/url" && (sameOrigin || isGoogleHost(normalizeHost(url.hostname)))) {
    // Google uses `?q=<target>` for some links and `?q=&url=<target>` for others (signed out,
    // incognito). An empty or non-URL `q` must not hide the real target in `url`.
    for (const param of ["q", "url"]) {
      const target = url.searchParams.get(param);
      if (target && HTTP_URL.test(target)) return target;
    }
  }
  return url.toString();
}
