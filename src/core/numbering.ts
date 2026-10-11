const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

/** Query parameters that change which results Google returns (and therefore the numbering). */
const SIGNATURE_PARAMS = ["q", "num", "gl", "hl", "cr", "lr", "tbs", "filter", "as_sitesearch", "udm", "tbm"];

export interface PageContext {
  /** Identifies a search; pages of the same search share it. */
  signature: string;
  /** Offset of the first result on this page (Google's `start` parameter). */
  start: number;
  /** Results Google asks for per page (`num`, defaults to 10). */
  pageSize: number;
}

function toPositiveInt(value: string | null, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getPageContext(search: string): PageContext {
  const params = new URLSearchParams(search);
  const pageSize = Math.min(MAX_PAGE_SIZE, toPositiveInt(params.get("num"), DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE;
  const signature = SIGNATURE_PARAMS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
  return { signature, start: toPositiveInt(params.get("start"), 0), pageSize };
}

/**
 * Number of the first organic result on the page at `start`.
 *
 * Google shows a varying number of organic results per page (modules take up slots), so the
 * base is the sum of the organic counts recorded for the previous pages. For a page that was
 * never visited in this search the nominal page size is assumed.
 */
export function computeBase(
  start: number,
  pageSize: number,
  knownCounts: Readonly<Record<number, number>>,
): number {
  let base = 1;
  for (let pageStart = 0; pageStart < start; pageStart += pageSize) {
    base += knownCounts[pageStart] ?? pageSize;
  }
  return base;
}
