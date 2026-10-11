import { isValidColor } from "../core/theme";
import type { BadgeTheme } from "../core/types";
import { SETTINGS_KEY, sanitizeSettings, type Settings } from "./settings";
import { SITE_NOTE_PREFIX, THEME_KEY, URL_NOTE_PREFIX } from "./notes";

/** Export/import format for notes. Versioned so it can evolve. */
export interface Backup {
  app: "serp-counter-tool";
  version: 1;
  exportedAt: string;
  notes: { url: Record<string, string>; site: Record<string, string> };
  theme?: BadgeTheme;
  settings?: Settings;
}

export const MAX_NOTES = 20_000;
export const MAX_NOTE_LENGTH = 20_000;
export const MAX_KEY_LENGTH = 2_048;

const isNote = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

export function buildBackup(all: Record<string, unknown>, now: Date = new Date()): Backup {
  const url: Record<string, string> = {};
  const site: Record<string, string> = {};
  for (const [key, value] of Object.entries(all)) {
    if (!isNote(value)) continue;
    if (key.startsWith(URL_NOTE_PREFIX)) url[key.slice(URL_NOTE_PREFIX.length)] = value;
    else if (key.startsWith(SITE_NOTE_PREFIX)) site[key.slice(SITE_NOTE_PREFIX.length)] = value;
  }
  const backup: Backup = { app: "serp-counter-tool", version: 1, exportedAt: now.toISOString(), notes: { url, site } };
  const theme = all[THEME_KEY] as Partial<BadgeTheme> | undefined;
  if (theme && isValidColor(theme.bg) && isValidColor(theme.text)) backup.theme = { bg: theme.bg, text: theme.text };
  if (all[SETTINGS_KEY]) backup.settings = sanitizeSettings(all[SETTINGS_KEY]);
  return backup;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Validates untrusted JSON; unknown or malformed entries are dropped, not trusted. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "That file isn't a SERP Counter backup." };
  const r = raw as Record<string, unknown>;
  if (r.app !== "serp-counter-tool" || r.version !== 1 || !r.notes || typeof r.notes !== "object") {
    return { ok: false, error: "That file isn't a SERP Counter backup." };
  }

  const pick = (source: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!source || typeof source !== "object") return out;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (!key || key.length > MAX_KEY_LENGTH || !isNote(value) || value.length > MAX_NOTE_LENGTH) continue;
      out[key] = value;
    }
    return out;
  };
  const notes = r.notes as Record<string, unknown>;
  const url = pick(notes.url);
  const site = pick(notes.site);
  if (Object.keys(url).length + Object.keys(site).length > MAX_NOTES) {
    return { ok: false, error: "That backup has too many notes." };
  }

  const backup: Backup = {
    app: "serp-counter-tool",
    version: 1,
    exportedAt: typeof r.exportedAt === "string" ? r.exportedAt : "",
    notes: { url, site },
  };
  const theme = r.theme as Partial<BadgeTheme> | undefined;
  if (theme && isValidColor(theme.bg) && isValidColor(theme.text)) backup.theme = { bg: theme.bg, text: theme.text };
  if (r.settings) backup.settings = sanitizeSettings(r.settings);
  return { ok: true, backup };
}

/** Storage entries that applying `backup` writes (imported notes replace same-key notes). */
export function backupToStorageItems(backup: Backup): Record<string, unknown> {
  const items: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(backup.notes.url)) items[URL_NOTE_PREFIX + key] = value;
  for (const [key, value] of Object.entries(backup.notes.site)) items[SITE_NOTE_PREFIX + key] = value;
  if (backup.theme) items[THEME_KEY] = backup.theme;
  if (backup.settings) items[SETTINGS_KEY] = backup.settings;
  return items;
}

export function countNotes(all: Record<string, unknown>): number {
  return Object.entries(all).filter(
    ([key, value]) => (key.startsWith(URL_NOTE_PREFIX) || key.startsWith(SITE_NOTE_PREFIX)) && isNote(value),
  ).length;
}
