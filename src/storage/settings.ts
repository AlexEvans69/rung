import type { KeyValueStore } from "./kv";

export interface Settings {
  /** Show the position badge next to each organic result. */
  numbering: boolean;
  /** Show the Note control and notes. */
  notes: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({ numbering: true, notes: true });
export const SETTINGS_KEY = "settings";

/** Anything that is not an explicit boolean falls back to the default. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    numbering: typeof r.numbering === "boolean" ? r.numbering : DEFAULT_SETTINGS.numbering,
    notes: typeof r.notes === "boolean" ? r.notes : DEFAULT_SETTINGS.notes,
  };
}

export class SettingsRepository {
  private value: Settings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<(settings: Settings) => void>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly store: KeyValueStore) {}

  async init(): Promise<void> {
    this.value = sanitizeSettings((await this.store.getAll())[SETTINGS_KEY]);
    this.unsubscribe?.();
    this.unsubscribe = this.store.onChange((changes) => {
      const change = changes[SETTINGS_KEY];
      if (!change) return;
      const next = sanitizeSettings(change.newValue);
      // Our own writes come back through here too; only react to real changes.
      if (next.numbering === this.value.numbering && next.notes === this.value.notes) return;
      this.value = next;
      this.emit();
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  get(): Settings {
    return { ...this.value };
  }

  subscribe(listener: (settings: Settings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    this.value = sanitizeSettings({ ...this.value, ...patch });
    this.emit();
    await this.store.set({ [SETTINGS_KEY]: this.value });
    return this.get();
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) listener(snapshot);
  }
}
