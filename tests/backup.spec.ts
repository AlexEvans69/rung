import { describe, expect, it } from "vitest";
import { MAX_KEY_LENGTH, backupToStorageItems, buildBackup, countNotes, parseBackup } from "../src/storage/backup";
import { SITE_NOTE_PREFIX, THEME_KEY, URL_NOTE_PREFIX } from "../src/storage/notes";
import { SETTINGS_KEY } from "../src/storage/settings";

const stored = {
  [URL_NOTE_PREFIX + "https://a.example/x"]: "url note",
  [SITE_NOTE_PREFIX + "b.example"]: "site note",
  [SITE_NOTE_PREFIX + "empty.example"]: "   ",
  [THEME_KEY]: { bg: "#112233", text: "#ffffff" },
  [SETTINGS_KEY]: { numbering: false, notes: true },
  counts_v2: { whatever: 1 },
};

describe("buildBackup", () => {
  const backup = buildBackup(stored, new Date("2026-01-02T03:04:05Z"));

  it("exports notes, theme and settings, and nothing else", () => {
    expect(backup).toEqual({
      app: "serp-counter-tool",
      version: 1,
      exportedAt: "2026-01-02T03:04:05.000Z",
      notes: { url: { "https://a.example/x": "url note" }, site: { "b.example": "site note" } },
      theme: { bg: "#112233", text: "#ffffff" },
      settings: { numbering: false, notes: true },
    });
  });

  it("round-trips through JSON", () => {
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual({ ok: true, backup });
    if (parsed.ok) {
      expect(backupToStorageItems(parsed.backup)).toMatchObject({
        [URL_NOTE_PREFIX + "https://a.example/x"]: "url note",
        [SITE_NOTE_PREFIX + "b.example"]: "site note",
        [THEME_KEY]: { bg: "#112233", text: "#ffffff" },
      });
    }
  });
});

describe("parseBackup", () => {
  const wrap = (extra: object) => JSON.stringify({ app: "serp-counter-tool", version: 1, notes: { url: {}, site: {} }, ...extra });

  it.each([
    ["not json", "{nope"],
    ["wrong app", JSON.stringify({ app: "other", version: 1, notes: {} })],
    ["wrong version", JSON.stringify({ app: "serp-counter-tool", version: 2, notes: {} })],
    ["array", "[]"],
    ["null", "null"],
  ])("rejects %s", (_name, text) => {
    expect(parseBackup(text).ok).toBe(false);
  });

  it("drops malformed notes instead of trusting them", () => {
    const text = wrap({
      notes: {
        url: { ok: "fine", empty: " ", num: 5, ["k".repeat(MAX_KEY_LENGTH + 1)]: "too long key" },
        site: "not an object",
      },
    });
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.notes).toEqual({ url: { ok: "fine" }, site: {} });
  });

  it("ignores invalid colours and settings", () => {
    const parsed = parseBackup(wrap({ theme: { bg: "url(javascript:1)", text: "#fff" }, settings: { numbering: "x" } }));
    expect(parsed.ok && parsed.backup.theme).toBeUndefined();
    expect(parsed.ok && parsed.backup.settings).toEqual({ numbering: true, notes: true });
  });
});

describe("countNotes", () => {
  it("counts only non-empty URL and site notes", () => {
    expect(countNotes(stored)).toBe(2);
  });
});
