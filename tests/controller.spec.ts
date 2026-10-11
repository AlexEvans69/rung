import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerpController } from "../src/content/controller";
import { getPageContext } from "../src/core/numbering";
import { MemoryStore } from "../src/storage/kv";
import { PageCounts } from "../src/storage/counts";
import { NotesRepository } from "../src/storage/notes";
import { RESULT_HOST_TAG } from "../src/ui/shadow";
import { createUiState } from "../src/ui/state";
import { mountSerp, organic, serp } from "./helpers/serp";

async function setup(search = "?q=cats") {
  const store = new MemoryStore();
  const notes = new NotesRepository(store);
  const counts = new PageCounts(store);
  await Promise.all([notes.init(), counts.init()]);
  const ui = createUiState(notes);
  const loc = { href: `https://www.google.com/search${search}`, search };
  const controller = new SerpController({ doc: document, location: loc, counts, ui });
  return { controller, ui, store, counts, loc };
}

const hostsIn = () => document.querySelectorAll(RESULT_HOST_TAG);
const numbers = (ui: ReturnType<typeof createUiState>) => ui.entries.value.map((e) => e.index);

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SerpController", () => {
  it("numbers organic results from 1 and injects one host per result", async () => {
    mountSerp(serp(organic(), organic(), organic()));
    const { controller, ui } = await setup();
    controller.scan();
    expect(numbers(ui)).toEqual([1, 2, 3]);
    expect(hostsIn()).toHaveLength(3);
  });

  it("is idempotent: repeated scans never create duplicates", async () => {
    mountSerp(serp(organic(), organic()));
    const { controller, ui } = await setup();
    const ids = () => ui.entries.value.map((e) => e.id);
    controller.scan();
    const first = ids();
    for (let i = 0; i < 5; i++) controller.scan();
    expect(hostsIn()).toHaveLength(2);
    expect(ids()).toEqual(first);
  });

  it("continues numbering on later pages from the recorded counts", async () => {
    const page1 = await setup("?q=cats&start=0");
    mountSerp(serp(organic(), organic(), organic()));
    page1.controller.scan();
    page1.controller.stop();

    // Same store, next page: reuse the first page's counts.
    const store = page1.store;
    const notes = new NotesRepository(store);
    const counts = new PageCounts(store);
    await Promise.all([notes.init(), counts.init()]);
    const ui = createUiState(notes);
    mountSerp(serp(organic(), organic()));
    const loc = { href: "https://www.google.com/search?q=cats&start=10", search: "?q=cats&start=10" };
    new SerpController({ doc: document, location: loc, counts, ui }).scan();
    expect(numbers(ui)).toEqual([4, 5]);
  });

  it("assumes a full previous page when it was never visited", async () => {
    mountSerp(serp(organic(), organic()));
    const { controller, ui } = await setup("?q=cats&start=20");
    controller.scan();
    expect(numbers(ui)).toEqual([21, 22]);
  });

  it("adds controls for results appended later and renumbers", async () => {
    const search = mountSerp(serp(organic(), organic()));
    const { controller, ui } = await setup();
    controller.scan();
    const rso = search.querySelector("#rso") as HTMLElement;
    rso.insertAdjacentHTML("afterbegin", organic({ title: "new first" }));
    controller.scan();
    expect(numbers(ui)).toEqual([1, 2, 3]);
    expect(hostsIn()).toHaveLength(3);
    expect(ui.entries.value[0]?.title).toBe("new first");
  });

  it("removes controls of results Google took away", async () => {
    const search = mountSerp(serp(organic(), organic(), organic()));
    const { controller, ui } = await setup();
    controller.scan();
    search.querySelector(".MjjYud")?.remove();
    controller.scan();
    expect(hostsIn()).toHaveLength(2);
    expect(numbers(ui)).toEqual([1, 2]);
  });

  it("re-attaches its host if Google re-renders a result's children", async () => {
    mountSerp(serp(organic()));
    const { controller } = await setup();
    controller.scan();
    hostsIn().forEach((h) => h.remove());
    expect(hostsIn()).toHaveLength(0);
    controller.scan();
    expect(hostsIn()).toHaveLength(1);
  });

  it("removes stale hosts left by a previous instance on start", async () => {
    mountSerp(serp(organic()));
    document.querySelector("[data-hveid]")?.insertAdjacentHTML("afterbegin", `<${RESULT_HOST_TAG}></${RESULT_HOST_TAG}>`);
    const { controller } = await setup();
    controller.start();
    expect(hostsIn()).toHaveLength(1);
    controller.stop();
  });

  it("does nothing without a #search container (no polling, no errors)", async () => {
    document.body.innerHTML = "<div>not a SERP</div>";
    const { controller, ui } = await setup();
    expect(() => controller.scan()).not.toThrow();
    expect(ui.entries.value).toEqual([]);
  });

  it("re-scans (debounced) when the page changes, but ignores its own DOM changes", async () => {
    vi.useFakeTimers();
    const search = mountSerp(serp(organic()));
    const { controller, ui } = await setup();
    controller.start();
    expect(numbers(ui)).toEqual([1]);

    const scan = vi.spyOn(controller, "scan");
    (search.querySelector("#rso") as HTMLElement).insertAdjacentHTML("beforeend", organic());
    await vi.advanceTimersByTimeAsync(300);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(numbers(ui)).toEqual([1, 2]);

    scan.mockClear();
    await vi.advanceTimersByTimeAsync(300); // our own host insertion must not retrigger
    expect(scan).not.toHaveBeenCalled();
    controller.stop();
  });

  it("stop() removes everything it added", async () => {
    mountSerp(serp(organic(), organic()));
    const { controller, ui } = await setup();
    controller.start();
    controller.stop();
    expect(hostsIn()).toHaveLength(0);
    expect(ui.entries.value).toEqual([]);
  });

  it("records the page's organic count for later pages", async () => {
    mountSerp(serp(organic(), organic(), organic()));
    const { controller, counts } = await setup("?q=cats");
    controller.scan();
    await Promise.resolve();
    const stored = counts.get(getPageContext("?q=cats").signature);
    expect(stored).toEqual({ 0: 3 });
  });
});
