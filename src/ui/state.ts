import { ref, shallowRef, type Ref, type ShallowRef } from "vue";
import type { EntryGeometry, Rail } from "../core/layout";
import type { PageTheme } from "../core/pageTheme";
import { DEFAULT_THEME } from "../core/theme";
import type { BadgeTheme, EffectiveNote, NoteScope } from "../core/types";
import type { NotesRepository } from "../storage/notes";
import { DEFAULT_SETTINGS, type Settings, type SettingsRepository } from "../storage/settings";

/** One numbered result and the element its controls are mounted into. */
export interface ResultEntry {
  id: number;
  index: number;
  title: string;
  urlKey: string | null;
  host: string | null;
  /** Container inside the result's shadow root that the controls are teleported to. */
  mount: HTMLElement;
  /** Where the controls go; null until the page has been measured. */
  geo: EntryGeometry | null;
}

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  /** The control that opened the popover; focus returns to it on close. */
  opener?: HTMLElement | null;
}

export interface PanelRequest {
  entry: ResultEntry;
  anchor: AnchorRect;
  /** Scope selected when the editor opens: the scope of the visible note, else "url". */
  scope: NoteScope;
  /** Saved text per scope, so switching scope shows what is stored there. */
  texts: Record<NoteScope, string>;
}

export interface UiState {
  entries: ShallowRef<ResultEntry[]>;
  /** Shared by all results so the note column is a straight line. */
  rail: Ref<Rail>;
  theme: Ref<BadgeTheme>;
  settings: Ref<Settings>;
  panel: Ref<PanelRequest | null>;
  colorPicker: Ref<{ anchor: AnchorRect } | null>;
  pageTheme: Ref<PageTheme>;
  effectiveNote(entry: ResultEntry): EffectiveNote;
  openNote(entry: ResultEntry, anchor: AnchorRect): void;
  closePanel(): void;
  saveNote(scope: NoteScope, text: string): Promise<void>;
  deleteNote(scope: NoteScope): Promise<void>;
  openColorPicker(anchor: AnchorRect): void;
  closeColorPicker(): void;
  applyTheme(theme: BadgeTheme): Promise<void>;
}

/** Reactive bridge between the repositories/controller and the Vue components. */
export function createUiState(notes: NotesRepository, settingsRepo?: SettingsRepository): UiState {
  const entries = shallowRef<ResultEntry[]>([]);
  const rail = ref<Rail>({ mode: "card", width: 200, x: 0, badgeRight: 0 });
  const theme = ref<BadgeTheme>({ ...DEFAULT_THEME });
  const settings = ref<Settings>(settingsRepo?.get() ?? { ...DEFAULT_SETTINGS });
  const panel = ref<PanelRequest | null>(null);
  const colorPicker = ref<{ anchor: AnchorRect } | null>(null);
  const pageTheme = ref<PageTheme>("light");
  /** Bumped whenever a note changes so components re-read `effectiveNote`. */
  const notesVersion = ref(0);

  theme.value = notes.getTheme();
  notes.subscribe(() => {
    notesVersion.value++;
    theme.value = notes.getTheme();
  });

  settingsRepo?.subscribe((next) => {
    settings.value = next;
    // A note editor must not stay open once notes are switched off.
    if (!next.notes) panel.value = null;
  });

  const keyFor = (entry: ResultEntry, scope: NoteScope) => (scope === "site" ? entry.host : entry.urlKey);

  return {
    entries,
    rail,
    theme,
    settings,
    panel,
    colorPicker,
    pageTheme,
    effectiveNote(entry) {
      void notesVersion.value;
      return notes.getEffective(entry.urlKey, entry.host);
    },
    openNote(entry, anchor) {
      const { scope } = notes.getEffective(entry.urlKey, entry.host);
      panel.value = {
        entry,
        anchor,
        scope,
        texts: { url: notes.get("url", entry.urlKey), site: notes.get("site", entry.host) },
      };
    },
    closePanel() {
      panel.value = null;
    },
    async saveNote(scope, text) {
      const current = panel.value;
      panel.value = null;
      if (current) await notes.save(scope, keyFor(current.entry, scope), text);
    },
    async deleteNote(scope) {
      const current = panel.value;
      panel.value = null;
      if (current) await notes.delete(scope, keyFor(current.entry, scope));
    },
    openColorPicker(anchor) {
      colorPicker.value = { anchor };
    },
    closeColorPicker() {
      colorPicker.value = null;
    },
    async applyTheme(next) {
      colorPicker.value = null;
      await notes.saveTheme(next);
    },
  };
}
