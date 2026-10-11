import { reactive } from "vue";
import { debug } from "../core/log";
import { computeBase, getPageContext } from "../core/numbering";
import { findOrganicResults, snippetHeight } from "../core/parser";
import type { PageCounts } from "../storage/counts";
import { RESULT_HOST_TAG, createResultMount } from "../ui/shadow";
import type { ResultEntry, UiState } from "../ui/state";

const SCAN_DEBOUNCE_MS = 80;

interface Tracked {
  entry: ResultEntry;
  host: HTMLElement;
}

export interface ControllerDeps {
  doc: Document;
  location: Pick<Location, "href" | "search">;
  counts: PageCounts;
  ui: UiState;
}

/**
 * Keeps the numbered controls in sync with the results currently on the page.
 *
 * `scan()` is idempotent: results are tracked by their DOM element, so running it any number
 * of times never produces duplicates, and elements Google removes are cleaned up on the next
 * scan. There is no separate de-duplication machinery because duplicates cannot arise.
 */
export class SerpController {
  private tracked = new Map<HTMLElement, Tracked>();
  private nextId = 1;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: ControllerDeps) {}

  start(): void {
    // Leftovers of a previous instance (extension reloaded/updated while the tab stayed open).
    this.deps.doc.querySelectorAll(RESULT_HOST_TAG).forEach((el) => el.remove());

    this.scan();
    this.observer = new MutationObserver((mutations) => {
      if (mutations.every((m) => this.isOwnMutation(m))) return;
      this.scheduleScan();
    });
    this.observer.observe(this.deps.doc.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const { host } of this.tracked.values()) host.remove();
    this.tracked.clear();
    this.deps.ui.entries.value = [];
  }

  scheduleScan(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.scan();
    }, SCAN_DEBOUNCE_MS);
  }

  scan(): void {
    const { doc, location, counts, ui } = this.deps;
    const root = doc.getElementById("search");
    const results = root ? findOrganicResults(root, location.href) : [];

    const ctx = getPageContext(location.search);
    const base = computeBase(ctx.start, ctx.pageSize, counts.get(ctx.signature));
    if (results.length > 0) {
      counts.record(ctx.signature, ctx.start, results.length).catch((error) => debug("counts", error));
    }

    const alive = new Set<HTMLElement>();
    const entries: ResultEntry[] = [];

    results.forEach((result, i) => {
      alive.add(result.element);
      const index = base + i;
      let item = this.tracked.get(result.element);

      if (!item) {
        const { host, mount } = createResultMount(doc);
        const entry = reactive<ResultEntry>({
          id: this.nextId++,
          index,
          title: result.title,
          urlKey: result.urlKey,
          host: result.host,
          mount,
          snippetHeight: snippetHeight(result.element),
        });
        item = { entry, host };
        this.tracked.set(result.element, item);
      } else {
        item.entry.index = index;
        item.entry.title = result.title;
        item.entry.urlKey = result.urlKey;
        item.entry.host = result.host;
      }

      // Google may re-render children of a result and drop our host; put it back.
      if (item.host.parentNode !== result.element) {
        result.element.insertBefore(item.host, result.element.firstChild);
      }
      entries.push(item.entry);
    });

    for (const [element, { host }] of this.tracked) {
      if (alive.has(element)) continue;
      host.remove();
      this.tracked.delete(element);
    }

    const previous = ui.entries.value;
    const changed = previous.length !== entries.length || previous.some((e, i) => e !== entries[i]);
    if (changed) ui.entries.value = entries;
    debug("scan", { results: entries.length, base });
  }

  /** True for mutations caused only by our own injected hosts. */
  private isOwnMutation(mutation: MutationRecord): boolean {
    const isOwn = (node: Node) =>
      node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === RESULT_HOST_TAG;
    const touched = [...mutation.addedNodes, ...mutation.removedNodes];
    return touched.length > 0 && touched.every(isOwn);
  }
}
