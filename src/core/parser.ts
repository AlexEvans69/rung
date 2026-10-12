import type { OrganicResult } from "./types";
import { extractFinalUrl, hostFromUrl, isGoogleHost, isYouTubeHost, normalizeHost, normalizeUrlKey } from "./urls";

/**
 * Finds organic results in a Google SERP.
 *
 * Google's class names are obfuscated and change from time to time, so everything that
 * depends on them lives in this file, in the constants below. The decision whether a block
 * is an organic result deliberately does *not* depend on UI language: modules such as
 * "People also ask" or shopping carousels are recognised by structure and Google's own
 * attributes, never by their visible heading.
 */

/** Containers of paid results. */
const ADS_SELECTOR = "#tads, #tadsb, #bottomads, [data-text-ad]";

/** Wrapper Google puts around a single result block. */
const WRAPPER_SELECTOR = "div.MjjYud";

/** Title container of a classic organic result. */
const TITLE_CONTAINER_SELECTOR = ".yuRUbf";

/** Containers holding the result snippet. */
const SNIPPET_SELECTOR = ".VwiC3b, .IsZvec, .aCOpRe, [data-sncf]";

/** A title living inside one of these is a widget control (e.g. a PAA question), not a result. */
const CONTROL_SELECTOR = "button, [role='button'], g-accordion-expander, [data-initq]";

/** Class-name fragments of non-organic SERP modules. */
const EXCLUDED_MODULE_CLASSES = [
  "VeHlbe", // Q&A block
  "nVcaUb", // videos
  "hlcw0c", // related searches
  "Mg1HKc", // products carousel
  "g-scrolling-carousel",
  "gws-onebox", // one-box answers
  "sVlkI", // entity / knowledge panel container
  "xpdopen", // expandable modules
  "kp-blk",
  "kno-kp",
  "g-blk",
];

/** `data-attrid` fragments of non-organic modules. */
const EXCLUDED_ATTRID_FRAGMENTS = ["related_questions", "relatedquestions", "shopping", "product", "merchant"];

/** How many ancestors above a result are inspected for module markers. */
const MAX_MODULE_DEPTH = 7;

const NON_ORGANIC_HREF_PREFIXES = ["#", "/search?", "/imgres?"];

function hasExcludedAttrId(node: Element): boolean {
  const attr = node.getAttribute("data-attrid")?.toLowerCase();
  return !!attr && EXCLUDED_ATTRID_FRAGMENTS.some((fragment) => attr.includes(fragment));
}

function hasExcludedClass(node: Element): boolean {
  const cls = node.getAttribute("class");
  return !!cls && EXCLUDED_MODULE_CLASSES.some((fragment) => cls.includes(fragment));
}

/** True if `element` sits inside (or is) a non-organic SERP module, looking up to `root`. */
export function isInsideExcludedModule(element: Element, root: Element): boolean {
  let current: Element | null = element;
  for (let depth = 0; current && current !== root && depth <= MAX_MODULE_DEPTH; depth++) {
    if (hasExcludedClass(current) || hasExcludedAttrId(current)) return true;
    current = current.parentElement;
  }
  return false;
}

function hasSnippet(element: Element): boolean {
  return Array.from(element.querySelectorAll(SNIPPET_SELECTOR)).some((el) => !!el.textContent?.trim());
}

function isExcludedHref(href: string, host: string | null): boolean {
  if (NON_ORGANIC_HREF_PREFIXES.some((prefix) => href.startsWith(prefix))) return true;
  if (isYouTubeHost(host)) return true;
  // Google's own pages are not organic results, except Google News articles.
  return isGoogleHost(host) && host !== "news.google.com";
}

function resultElementFor(h3: Element): HTMLElement | null {
  const wrapper = h3.closest<HTMLElement>(WRAPPER_SELECTOR);
  if (wrapper) {
    return wrapper.matches("div[data-hveid]")
      ? wrapper
      : wrapper.querySelector<HTMLElement>("div[data-hveid]");
  }
  return h3.closest<HTMLElement>("div[data-hveid]");
}

/** Why a title was not counted as an organic result (reported to `onReject`, for diagnostics). */
export interface Rejection {
  title: string;
  reason: string;
  href: string;
}

/**
 * Google redirects whose target is an opaque token (`/goto?url=CAES...`) or one we could not
 * unwrap. Such a link on an otherwise organic block is still an organic result; the page
 * just does not say where it leads, so the address is read from the visible breadcrumb.
 */
const OPAQUE_REDIRECT_PATHS = new Set(["/goto", "/url"]);

function isOpaqueGoogleRedirect(raw: string, pageUrl: string): boolean {
  try {
    const u = new URL(raw, pageUrl);
    return isGoogleHost(normalizeHost(u.hostname)) && OPAQUE_REDIRECT_PATHS.has(u.pathname);
  } catch {
    return false;
  }
}

/** A whole element's text is an address crumb: optional site name, a URL, then `› segment` parts. */
const CRUMB = /^(?:.{0,60}?\s)?(https?:\/\/[^\s›]+)((?:\s*›\s*[^›]+?)*)\s*[^\w\s]*$/u;

/**
 * The address a result displays under its title ("https://www.example.com › shop › item").
 * Used when the link itself is opaque. Each element is matched as a whole, so the crumb is
 * never glued to the title or snippet text that follows it. Truncated crumbs ("...") are
 * dropped, so the path is best-effort; the host is reliable.
 */
export function displayedAddress(element: Element): { url: string; host: string } | null {
  for (const node of [element, ...element.querySelectorAll("cite, span, div, a")]) {
    // A container that also holds the title or snippet is not the crumb itself.
    if (node.querySelector(`h3, ${SNIPPET_SELECTOR}`)) continue;
    const raw = node.textContent ?? "";
    if (raw.length > 240) continue;
    const m = raw.replace(/\s+/g, " ").trim().match(CRUMB);
    if (!m?.[1]) continue;
    const host = hostFromUrl(m[1]);
    if (!host) continue;
    const segments = (m[2] ?? "")
      .split("›")
      .map((part) => part.trim())
      .filter((part) => part && part !== "..." && part !== "…");
    const origin = m[1].replace(/\/+$/, "");
    try {
      const url = new URL(segments.length ? `${origin}/${segments.join("/")}` : origin).toString();
      return { url, host };
    } catch {
      return { url: origin, host };
    }
  }
  return null;
}

function describe(el: Element): string {
  const role = el.getAttribute("role");
  const cls = (el.getAttribute("class") ?? "").trim().split(/\s+/).slice(0, 3).join(" ");
  return `<${el.tagName.toLowerCase()}${role ? ` role=${role}` : ""}${cls ? ` class="${cls}"` : ""}>`;
}

/** Links that could be the title's: its own anchor first, then the others in the title box. */
function candidateAnchors(h3: Element): HTMLAnchorElement[] {
  const list: HTMLAnchorElement[] = [];
  const own = h3.closest<HTMLAnchorElement>("a[href]");
  if (own) list.push(own);
  const box = h3.closest(TITLE_CONTAINER_SELECTOR) ?? h3.parentElement?.parentElement?.parentElement;
  box?.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    if (!list.includes(a)) list.push(a);
  });
  return list;
}

/**
 * Returns the organic results below `root` in document order. Paid results, modules,
 * results without a snippet and duplicates of an already seen URL are skipped.
 * `onReject` is told about every skipped title and why, which makes "nothing is numbered"
 * reports diagnosable from the page.
 */
export function findOrganicResults(
  root: Element,
  pageUrl: string,
  onReject?: (rejection: Rejection) => void,
): OrganicResult[] {
  // Prefer Google's known title container; if Google renames it, fall back to every <h3>
  // and let the structural filters below do the work.
  const titles = root.querySelector(TITLE_CONTAINER_SELECTOR)
    ? root.querySelectorAll(`${TITLE_CONTAINER_SELECTOR} h3`)
    : root.querySelectorAll("h3");

  // Relative links need an http(s) base; fall back to Google's origin (e.g. in a test page).
  const base = /^https?:\/\//i.test(pageUrl) ? pageUrl : "https://www.google.com/";

  const results: OrganicResult[] = [];
  const seenElements = new Set<Element>();
  const seenUrlKeys = new Set<string>();

  for (const h3 of titles) {
    const title = h3.textContent?.trim() ?? "";
    let href = "";
    const reject = (reason: string): void => onReject?.({ title: title.slice(0, 60), reason, href: href.slice(0, 200) });

    const element = resultElementFor(h3);
    if (!element) {
      reject("no result container (div[data-hveid])");
      continue;
    }
    if (seenElements.has(element)) continue;

    if (element.closest(ADS_SELECTOR)) {
      reject("inside paid results");
      continue;
    }
    const control = h3.closest(CONTROL_SELECTOR);
    if (control) {
      reject(`inside a control or accordion ${describe(control)}`);
      continue;
    }
    if (!title) {
      reject("empty title");
      continue;
    }

    const candidates = candidateAnchors(h3);
    if (candidates.length === 0) {
      reject("no link");
      continue;
    }

    if (isInsideExcludedModule(element, root)) {
      reject("inside a non-organic module (class or data-attrid)");
      continue;
    }
    const wrapper = element.closest(WRAPPER_SELECTOR);
    if (wrapper && wrapper !== element && isInsideExcludedModule(wrapper, root)) {
      reject("wrapper is a non-organic module");
      continue;
    }

    if (!hasSnippet(element)) {
      reject(`no snippet (none of ${SNIPPET_SELECTOR})`);
      continue;
    }

    // Take the first link in the title box that leads somewhere real. In signed-out layouts
    // the first anchor can belong to Google (menus, redirects we can't unwrap).
    const resolved = candidates.map((anchor) => {
      const raw = anchor.getAttribute("href") ?? "";
      const finalUrl = extractFinalUrl(raw, base);
      const host = finalUrl ? hostFromUrl(finalUrl) : null;
      return { anchor, raw, finalUrl, host, opaque: isOpaqueGoogleRedirect(raw, base) && isGoogleHost(host) };
    });
    let picked: { anchor: HTMLAnchorElement; raw: string; finalUrl: string | null; host: string | null } | undefined =
      resolved.find((r) => !r.opaque && !isExcludedHref(r.raw, r.host));

    if (!picked) {
      const opaque = resolved.find((r) => r.opaque);
      if (opaque) {
        const shown = displayedAddress(element);
        picked = { anchor: opaque.anchor, raw: opaque.raw, finalUrl: shown?.url ?? null, host: shown?.host ?? null };
        if (isYouTubeHost(picked.host) || (isGoogleHost(picked.host) && picked.host !== "news.google.com")) {
          href = picked.raw;
          reject("redirect to YouTube or Google's own page");
          continue;
        }
      }
    }
    href = (picked ?? resolved[0])?.raw ?? "";
    if (!picked) {
      reject("every link points to Google, YouTube or the page itself");
      continue;
    }

    const urlKey = picked.finalUrl ? normalizeUrlKey(picked.finalUrl) : null;
    if (urlKey) {
      if (seenUrlKeys.has(urlKey)) {
        reject("duplicate URL");
        continue;
      }
      seenUrlKeys.add(urlKey);
    }
    seenElements.add(element);
    results.push({
      element,
      anchor: picked.anchor,
      titleElement: h3 as HTMLElement,
      title,
      finalUrl: picked.finalUrl,
      urlKey,
      host: picked.host,
    });
  }

  return results;
}
