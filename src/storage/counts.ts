import type { KeyValueStore } from "./kv";

export const COUNTS_KEY = "counts_v2";
/** Searches whose page counts are remembered; the least recently used are dropped. */
export const MAX_REMEMBERED_SEARCHES = 50;

interface SearchEntry {
  /** Last use, ms since epoch. */
  t: number;
  /** Organic result count per page, keyed by the page's `start`. */
  c: Record<string, number>;
}

type Data = Record<string, SearchEntry>;

/** Remembers how many organic results each visited page had, so later pages can be numbered. */
export class PageCounts {
  private data: Data = {};

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  async init(): Promise<void> {
    const all = await this.store.getAll();
    const raw = all[COUNTS_KEY];
    this.data = raw && typeof raw === "object" ? (raw as Data) : {};
  }

  get(signature: string): Record<number, number> {
    const entry = this.data[signature];
    const counts: Record<number, number> = {};
    if (!entry) return counts;
    for (const [start, count] of Object.entries(entry.c)) counts[Number(start)] = count;
    return counts;
  }

  /** Records a page's count. Returns false when nothing changed (no storage write happens). */
  async record(signature: string, start: number, count: number): Promise<boolean> {
    const entry = this.data[signature];
    if (entry?.c[start] === count) return false;

    this.data[signature] = {
      t: this.now(),
      c: { ...(entry?.c ?? {}), [start]: count },
    };
    this.prune();
    await this.store.set({ [COUNTS_KEY]: this.data });
    return true;
  }

  private prune(): void {
    const signatures = Object.keys(this.data);
    if (signatures.length <= MAX_REMEMBERED_SEARCHES) return;
    signatures
      .sort((a, b) => (this.data[a]?.t ?? 0) - (this.data[b]?.t ?? 0))
      .slice(0, signatures.length - MAX_REMEMBERED_SEARCHES)
      .forEach((signature) => delete this.data[signature]);
  }
}
