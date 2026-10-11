import { reactive } from "vue";
import { debug } from "../core/log";
import { computeBase, getPageContext } from "../core/numbering";
import { sameGeometry } from "../core/layout";
import { findOrganicResults } from "../core/parser";
import type { PageCounts } from "../storage/counts";
import { RESULT_HOST_TAG, createResultMount } from "../ui/shadow";
import { measureLayout } from "./measure";
import type { ResultEntry, UiState } from "../ui/state";

const SCAN_DEBOUNCE_MS = 80;

interface Tracked {
  entry: ResultEntry;
  host: HTMLElement;
  element: HTMLElement;
  titleElement: HTMLElement;
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
  private resizeObserver: ResizeObserver | null = null;
  private layoutFrame: number | null = null;

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

    // Result boxes change when images, fonts or Google's own scripts finish; the window
    // changes with resizes and zoom. Either way the rails have to be re-measured.
    const view = this.deps.doc.defaultView;
    if (view && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.scheduleLayout());
      this.resizeObserver.observe(this.deps.doc.documentElement);
    }
    view?.addEventListener("resize", this.onResize);
    view?.addEventListener("load", this.onResize);
    this.deps.doc.fonts?.ready.then(() => this.scheduleLayout()).catch(() => undefined);
  }

  private onResize = (): void => this.scheduleLayout();

  /** Coalesces layout requests into one measurement per frame. */
  scheduleLayout(): void {
    const view = this.deps.doc.defaultView;
    if (!view || this.layoutFrame !== null) return;
    this.layoutFrame = view.requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.layout();
    });
  }

  /** Measures the page and updates where every entry's controls sit. */
  layout(): void {
    const items = [...this.tracked.values()].map(({ entry, host, element, titleElement }) => ({
      id: entry.id,
      host,
      element,
      titleElement,
    }));
    const measurement = measureLayout(this.deps.doc, items);
    if (!measurement) return;

    const { rail } = this.deps.ui;
    const r = measurement.rail;
    if (rail.value.mode !== r.mode || rail.value.width !== r.width) rail.value = r;

    for (const { entry } of this.tracked.values()) {
      const geo = measurement.geometry.get(entry.id);
      if (geo && !sameGeometry(entry.geo, geo)) entry.geo = geo;
    }
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    const view = this.deps.doc.defaultView;
    view?.removeEventListener("resize", this.onResize);
    view?.removeEventListener("load", this.onResize);
    if (this.layoutFrame !== null) view?.cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = null;
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
    const known = this.tracked.size;
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
          geo: null,
        });
        item = { entry, host, element: result.element, titleElement: result.titleElement };
        this.tracked.set(result.element, item);
      } else {
        item.titleElement = result.titleElement;
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
    this.resizeObserver?.disconnect();
    if (this.resizeObserver) {
      this.resizeObserver.observe(doc.documentElement);
      for (const element of alive) this.resizeObserver.observe(element);
    }

    const previous = ui.entries.value;
    const changed = previous.length !== entries.length || previous.some((e, i) => e !== entries[i]);
    if (changed) ui.entries.value = entries;
    // New or moved results need positions right away, not on the next resize.
    if (entries.length !== known || changed) this.layout();
    this.scheduleLayout();
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
