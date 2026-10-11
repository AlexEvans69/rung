import { isValidColor } from "../core/theme";
import { normalizeHost } from "../core/urls";
import type { KeyValueStore } from "./kv";
import { SITE_NOTE_PREFIX, THEME_KEY, URL_NOTE_PREFIX } from "./notes";

/** Single-object format used by versions before 4.0. */
export const LEGACY_NOTES_KEY = "serp_site_notes_v2";
const LEGACY_COUNTS_KEY = "serp_organic_counts_v1";
export const SCHEMA_KEY = "schema";
export const SCHEMA_VERSION = 3;

interface LegacyNotes {
  byUrl?: Record<string, unknown>;
  bySite?: Record<string, unknown>;
  badgeTheme?: { bg?: unknown; text?: unknown };
}

/**
 * One-off import of pre-4.0 notes into the per-note key format. Idempotent, never
 * overwrites a note that already exists in the new format, and leaves the legacy object
 * in place so rolling back to an older version loses nothing.
 */
export async function migrateLegacyNotes(store: KeyValueStore): Promise<number> {
  const all = await store.getAll();
  if (all[SCHEMA_KEY] === SCHEMA_VERSION) return 0;

  const legacy = all[LEGACY_NOTES_KEY] as LegacyNotes | undefined;
  const writes: Record<string, unknown> = {};
  let imported = 0;

  const importNotes = (source: Record<string, unknown> | undefined, prefix: string, normalize: (k: string) => string | null) => {
    for (const [rawKey, value] of Object.entries(source ?? {})) {
      if (typeof value !== "string" || value.trim() === "") continue;
      const key = normalize(rawKey);
      if (!key || prefix + key in all) continue;
      writes[prefix + key] = value;
      imported++;
    }
  };

  if (legacy && typeof legacy === "object") {
    importNotes(legacy.byUrl, URL_NOTE_PREFIX, (key) => key);
    importNotes(legacy.bySite, SITE_NOTE_PREFIX, (key) => normalizeHost(key) ?? key);

    const { bg, text } = legacy.badgeTheme ?? {};
    if (!(THEME_KEY in all) && isValidColor(bg) && isValidColor(text)) {
      writes[THEME_KEY] = { bg, text };
    }
  }

  writes[SCHEMA_KEY] = SCHEMA_VERSION;
  await store.set(writes);
  // Page counts of old versions were never pruned and are rebuilt on the next visit anyway.
  await store.remove([LEGACY_COUNTS_KEY]);
  return imported;
}
