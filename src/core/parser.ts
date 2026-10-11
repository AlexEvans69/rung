import type { OrganicResult } from "./types";
import { extractFinalUrl, hostFromUrl, isGoogleHost, isYouTubeHost, normalizeUrlKey } from "./urls";

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

/**
 * Returns the organic results below `root` in document order. Paid results, modules,
 * results without a snippet and duplicates of an already seen URL are skipped.
 */
export function findOrganicResults(root: Element, pageUrl: string): OrganicResult[] {
  // Prefer Google's known title container; if Google renames it, fall back to every <h3>
  // and let the structural filters below do the work.
  const titles = root.querySelector(TITLE_CONTAINER_SELECTOR)
    ? root.querySelectorAll(`${TITLE_CONTAINER_SELECTOR} h3`)
    : root.querySelectorAll("h3");

  const results: OrganicResult[] = [];
  const seenElements = new Set<Element>();
  const seenUrlKeys = new Set<string>();

  for (const h3 of titles) {
    const element = resultElementFor(h3);
    if (!element || seenElements.has(element)) continue;

    if (element.closest(ADS_SELECTOR)) continue;
    if (h3.closest(CONTROL_SELECTOR)) continue;

    const anchor =
      h3.closest<HTMLAnchorElement>("a[href]") ??
      h3.closest(TITLE_CONTAINER_SELECTOR)?.querySelector<HTMLAnchorElement>("a[href]") ??
      null;
    if (!anchor) continue;

    const title = h3.textContent?.trim() ?? "";
    if (!title) continue;

    if (isInsideExcludedModule(element, root)) continue;
    const wrapper = element.closest(WRAPPER_SELECTOR);
    if (wrapper && wrapper !== element && isInsideExcludedModule(wrapper, root)) continue;

    if (!hasSnippet(element)) continue;

    const href = anchor.getAttribute("href") ?? "";
    const finalUrl = extractFinalUrl(href, pageUrl);
    const host = finalUrl ? hostFromUrl(finalUrl) : null;
    if (isExcludedHref(href, host)) continue;

    const urlKey = finalUrl ? normalizeUrlKey(finalUrl) : null;
    if (urlKey) {
      if (seenUrlKeys.has(urlKey)) continue;
      seenUrlKeys.add(urlKey);
    }
    seenElements.add(element);
    results.push({ element, anchor, titleElement: h3 as HTMLElement, title, finalUrl, urlKey, host });
  }

  return results;
}
