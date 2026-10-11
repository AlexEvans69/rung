import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/storage/kv";
import { DEFAULT_SETTINGS, SETTINGS_KEY, SettingsRepository, sanitizeSettings } from "../src/storage/settings";

describe("sanitizeSettings", () => {
  it("defaults everything on", () => {
    expect(sanitizeSettings(undefined)).toEqual({ numbering: true, notes: true });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps explicit booleans and ignores everything else", () => {
    expect(sanitizeSettings({ numbering: false, notes: "no" })).toEqual({ numbering: false, notes: true });
    expect(sanitizeSettings({ notes: false, extra: 1 })).toEqual({ numbering: true, notes: false });
  });
});

describe("SettingsRepository", () => {
  it("persists updates and notifies", async () => {
    const store = new MemoryStore();
    const repo = new SettingsRepository(store);
    await repo.init();
    const seen: boolean[] = [];
    repo.subscribe((s) => seen.push(s.notes));
    await repo.update({ notes: false });
    expect(repo.get()).toEqual({ numbering: true, notes: false });
    expect((await store.getAll())[SETTINGS_KEY]).toEqual({ numbering: true, notes: false });
    expect(seen).toEqual([false]);
  });

  it("loads stored settings and follows changes from other tabs", async () => {
    const store = new MemoryStore({ [SETTINGS_KEY]: { numbering: false, notes: true } });
    const repo = new SettingsRepository(store);
    await repo.init();
    expect(repo.get().numbering).toBe(false);
    store.emitExternal({ [SETTINGS_KEY]: { newValue: { numbering: true, notes: false } } });
    expect(repo.get()).toEqual({ numbering: true, notes: false });
  });
});
