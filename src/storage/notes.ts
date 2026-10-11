import { DEFAULT_THEME, sanitizeTheme } from "../core/theme";
import type { BadgeTheme, EffectiveNote, NoteScope } from "../core/types";
import type { KeyValueStore } from "./kv";

/**
 * Every note is stored under its own key, so two tabs writing different notes never
 * overwrite each other (the pre-4.0 format kept all notes in one object).
 */
export const URL_NOTE_PREFIX = "n:u:";
export const SITE_NOTE_PREFIX = "n:s:";
export const THEME_KEY = "theme";

const PREFIX: Record<NoteScope, string> = { url: URL_NOTE_PREFIX, site: SITE_NOTE_PREFIX };

type Listener = () => void;

export class NotesRepository {
  private notes: Record<NoteScope, Map<string, string>> = { url: new Map(), site: new Map() };
  private theme: BadgeTheme = { ...DEFAULT_THEME };
  private listeners = new Set<Listener>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly store: KeyValueStore) {}

  /** Loads everything and starts following changes made in other tabs. */
  async init(): Promise<void> {
    const all = await this.store.getAll();
    for (const [key, value] of Object.entries(all)) this.applyValue(key, value);
    this.unsubscribe?.();
    this.unsubscribe = this.store.onChange((changes) => {
      let touched = false;
      for (const [key, change] of Object.entries(changes)) {
        touched = this.applyValue(key, change.newValue) || touched;
      }
      if (touched) this.emit();
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getTheme(): BadgeTheme {
    return { ...this.theme };
  }

  get(scope: NoteScope, key: string | null): string {
    return key ? (this.notes[scope].get(key) ?? "") : "";
  }

  /** The note shown next to a result: a per-URL note wins over a per-site note. */
  getEffective(urlKey: string | null, host: string | null): EffectiveNote {
    const urlNote = this.get("url", urlKey);
    if (urlNote) return { text: urlNote, scope: "url" };
    const siteNote = this.get("site", host);
    if (siteNote) return { text: siteNote, scope: "site" };
    return { text: "", scope: "url" };
  }

  /** Saves a note; blank text deletes it. Returns false when `key` is unusable. */
  async save(scope: NoteScope, key: string | null, text: string): Promise<boolean> {
    if (!key) return false;
    if (text.trim() === "") return this.delete(scope, key);
    this.notes[scope].set(key, text);
    this.emit();
    await this.store.set({ [PREFIX[scope] + key]: text });
    return true;
  }

  async delete(scope: NoteScope, key: string | null): Promise<boolean> {
    if (!key) return false;
    if (this.notes[scope].delete(key)) this.emit();
    await this.store.remove([PREFIX[scope] + key]);
    return true;
  }

  async saveTheme(theme: Partial<BadgeTheme>): Promise<BadgeTheme> {
    this.theme = sanitizeTheme(theme, this.theme);
    this.emit();
    await this.store.set({ [THEME_KEY]: this.theme });
    return this.getTheme();
  }

  /** Applies one stored value to the in-memory state. Returns true if something changed. */
  private applyValue(key: string, value: unknown): boolean {
    if (key === THEME_KEY) {
      this.theme = sanitizeTheme(value as Partial<BadgeTheme> | undefined, DEFAULT_THEME);
      return true;
    }
    for (const scope of ["url", "site"] as const) {
      if (!key.startsWith(PREFIX[scope])) continue;
      const noteKey = key.slice(PREFIX[scope].length);
      if (typeof value === "string" && value.trim() !== "") this.notes[scope].set(noteKey, value);
      else this.notes[scope].delete(noteKey);
      return true;
    }
    return false;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
