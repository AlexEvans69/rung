import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../src/core/theme";
import { COUNTS_KEY, MAX_REMEMBERED_SEARCHES, PageCounts } from "../src/storage/counts";
import { MemoryStore } from "../src/storage/kv";
import { LEGACY_NOTES_KEY, SCHEMA_KEY, SCHEMA_VERSION, migrateLegacyNotes } from "../src/storage/migration";
import { NotesRepository, SITE_NOTE_PREFIX, THEME_KEY, URL_NOTE_PREFIX } from "../src/storage/notes";

async function repo(initial: Record<string, unknown> = {}) {
  const store = new MemoryStore(initial);
  const notes = new NotesRepository(store);
  await notes.init();
  return { store, notes };
}

describe("NotesRepository", () => {
  it("returns an empty default note", async () => {
    const { notes } = await repo();
    expect(notes.getEffective("https://a.example/x", "a.example")).toEqual({ text: "", scope: "site" });
  });

  it("defaults an empty note to the page when the site is unknown", async () => {
    const { notes } = await repo();
    expect(notes.getEffective("https://a.example/x", null)).toEqual({ text: "", scope: "url" });
  });

  it("stores each note under its own key", async () => {
    const { notes, store } = await repo();
    await notes.save("url", "https://a.example/x", "url note");
    await notes.save("site", "a.example", "site note");
    const all = await store.getAll();
    expect(all[URL_NOTE_PREFIX + "https://a.example/x"]).toBe("url note");
    expect(all[SITE_NOTE_PREFIX + "a.example"]).toBe("site note");
  });

  it("prefers the URL note over the site note", async () => {
    const { notes } = await repo();
    await notes.save("site", "a.example", "site note");
    expect(notes.getEffective("https://a.example/x", "a.example")).toEqual({ text: "site note", scope: "site" });
    await notes.save("url", "https://a.example/x", "url note");
    expect(notes.getEffective("https://a.example/x", "a.example")).toEqual({ text: "url note", scope: "url" });
  });

  it("deletes a note when saved blank", async () => {
    const { notes, store } = await repo();
    await notes.save("site", "a.example", "x");
    await notes.save("site", "a.example", "   ");
    expect(notes.get("site", "a.example")).toBe("");
    expect(await store.getAll()).not.toHaveProperty(SITE_NOTE_PREFIX + "a.example");
  });

  it("refuses to save under a null key instead of writing a note called 'null'", async () => {
    const { notes, store } = await repo();
    expect(await notes.save("url", null, "text")).toBe(false);
    expect(await notes.save("site", null, "text")).toBe(false);
    expect(await store.getAll()).toEqual({});
  });

  it("loads existing notes and the theme", async () => {
    const { notes } = await repo({
      [URL_NOTE_PREFIX + "https://a.example/"]: "hello",
      [THEME_KEY]: { bg: "#000000", text: "#ffffff" },
    });
    expect(notes.get("url", "https://a.example/")).toBe("hello");
    expect(notes.getTheme()).toEqual({ bg: "#000000", text: "#ffffff" });
  });

  it("picks up changes made in another tab and notifies subscribers", async () => {
    const { notes, store } = await repo();
    let notified = 0;
    notes.subscribe(() => notified++);
    store.emitExternal({ [SITE_NOTE_PREFIX + "b.example"]: { newValue: "from tab 2" } });
    expect(notes.get("site", "b.example")).toBe("from tab 2");
    store.emitExternal({ [SITE_NOTE_PREFIX + "b.example"]: {} });
    expect(notes.get("site", "b.example")).toBe("");
    expect(notified).toBe(2);
  });

  it("two repositories writing different notes do not clobber each other", async () => {
    const store = new MemoryStore();
    const a = new NotesRepository(store);
    const b = new NotesRepository(store);
    await Promise.all([a.init(), b.init()]);
    await Promise.all([a.save("site", "one.example", "A"), b.save("site", "two.example", "B")]);
    const c = new NotesRepository(store);
    await c.init();
    expect(c.get("site", "one.example")).toBe("A");
    expect(c.get("site", "two.example")).toBe("B");
  });

  it("rejects invalid colours when saving the theme", async () => {
    const { notes } = await repo();
    const saved = await notes.saveTheme({ bg: "red; background:url(x)", text: "#abc" });
    expect(saved).toEqual({ bg: DEFAULT_THEME.bg, text: "#abc" });
  });
});

describe("migrateLegacyNotes", () => {
  const legacy = {
    byUrl: { "https://a.example/x": "url note", "https://b.example/": "" },
    bySite: { "WWW.Site.example": "site note", "bad.example": 42 },
    badgeTheme: { bg: "#112233", text: "#ffeedd" },
  };

  it("imports URL notes, site notes and the theme", async () => {
    const store = new MemoryStore({ [LEGACY_NOTES_KEY]: legacy });
    expect(await migrateLegacyNotes(store)).toBe(2);
    const notes = new NotesRepository(store);
    await notes.init();
    expect(notes.get("url", "https://a.example/x")).toBe("url note");
    expect(notes.get("site", "site.example")).toBe("site note");
    expect(notes.get("site", "bad.example")).toBe("");
    expect(notes.getTheme()).toEqual({ bg: "#112233", text: "#ffeedd" });
  });

  it("is idempotent and does not overwrite newer notes", async () => {
    const store = new MemoryStore({
      [LEGACY_NOTES_KEY]: legacy,
      [SITE_NOTE_PREFIX + "site.example"]: "newer",
    });
    await migrateLegacyNotes(store);
    expect((await store.getAll())[SITE_NOTE_PREFIX + "site.example"]).toBe("newer");
    const before = JSON.stringify(await store.getAll());
    expect(await migrateLegacyNotes(store)).toBe(0);
    expect(JSON.stringify(await store.getAll())).toBe(before);
  });

  it("keeps the legacy object so a rollback loses nothing", async () => {
    const store = new MemoryStore({ [LEGACY_NOTES_KEY]: legacy });
    await migrateLegacyNotes(store);
    expect((await store.getAll())[LEGACY_NOTES_KEY]).toEqual(legacy);
  });

  it("marks fresh installs as migrated and drops stale page counts", async () => {
    const store = new MemoryStore({ serp_organic_counts_v1: { "q:0": 9 } });
    await migrateLegacyNotes(store);
    const all = await store.getAll();
    expect(all[SCHEMA_KEY]).toBe(SCHEMA_VERSION);
    expect(all).not.toHaveProperty("serp_organic_counts_v1");
  });

  it("ignores an invalid legacy theme", async () => {
    const store = new MemoryStore({ [LEGACY_NOTES_KEY]: { badgeTheme: { bg: "nope", text: "#fff" } } });
    await migrateLegacyNotes(store);
    expect(await store.getAll()).not.toHaveProperty(THEME_KEY);
  });
});

describe("PageCounts", () => {
  it("records and returns counts per search and page", async () => {
    const store = new MemoryStore();
    const counts = new PageCounts(store);
    await counts.init();
    expect(await counts.record("q=a", 0, 9)).toBe(true);
    await counts.record("q=a", 10, 8);
    expect(counts.get("q=a")).toEqual({ 0: 9, 10: 8 });
    expect(counts.get("q=other")).toEqual({});
  });

  it("does not write when the count is unchanged", async () => {
    const store = new MemoryStore();
    const counts = new PageCounts(store);
    await counts.init();
    await counts.record("q=a", 0, 9);
    expect(await counts.record("q=a", 0, 9)).toBe(false);
  });

  it("persists across instances", async () => {
    const store = new MemoryStore();
    const first = new PageCounts(store);
    await first.init();
    await first.record("q=a", 0, 7);
    const second = new PageCounts(store);
    await second.init();
    expect(second.get("q=a")).toEqual({ 0: 7 });
  });

  it("forgets the least recently used searches beyond the cap", async () => {
    const store = new MemoryStore();
    let clock = 0;
    const counts = new PageCounts(store, () => ++clock);
    await counts.init();
    for (let i = 0; i < MAX_REMEMBERED_SEARCHES + 5; i++) await counts.record(`q=${i}`, 0, 10);
    expect(counts.get("q=0")).toEqual({});
    expect(counts.get("q=4")).toEqual({});
    expect(counts.get("q=5")).toEqual({ 0: 10 });
    const stored = (await store.getAll())[COUNTS_KEY] as Record<string, unknown>;
    expect(Object.keys(stored)).toHaveLength(MAX_REMEMBERED_SEARCHES);
  });
});
