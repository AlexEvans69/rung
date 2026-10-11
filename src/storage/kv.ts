/** Minimal async key-value store; implemented over `chrome.storage.local` and in memory for tests. */
export interface KeyValueStore {
  getAll(): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Subscribes to changes made elsewhere (other tabs). Returns an unsubscribe function. */
  onChange(listener: (changes: Record<string, { newValue?: unknown }>) => void): () => void;
}

/**
 * After an extension update/reload the old content script keeps running in open tabs but
 * every `chrome.*` call throws. Detect that so the script can go quiet instead of erroring.
 */
export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export class ChromeStorageStore implements KeyValueStore {
  async getAll(): Promise<Record<string, unknown>> {
    if (!isExtensionContextValid()) return {};
    return chrome.storage.local.get(null);
  }

  async set(items: Record<string, unknown>): Promise<void> {
    if (!isExtensionContextValid()) return;
    await chrome.storage.local.set(items);
  }

  async remove(keys: string[]): Promise<void> {
    if (!isExtensionContextValid() || keys.length === 0) return;
    await chrome.storage.local.remove(keys);
  }

  onChange(listener: (changes: Record<string, { newValue?: unknown }>) => void): () => void {
    if (!isExtensionContextValid()) return () => undefined;
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local") listener(changes);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => {
      if (isExtensionContextValid()) chrome.storage.onChanged.removeListener(handler);
    };
  }
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, unknown>();
  private listeners = new Set<(changes: Record<string, { newValue?: unknown }>) => void>();

  constructor(initial: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(initial)) this.data.set(key, value);
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.data);
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const [key, value] of Object.entries(items)) {
      this.data.set(key, value);
      changes[key] = { newValue: value };
    }
    this.emit(changes);
  }

  async remove(keys: string[]): Promise<void> {
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const key of keys) {
      if (this.data.delete(key)) changes[key] = {};
    }
    this.emit(changes);
  }

  onChange(listener: (changes: Record<string, { newValue?: unknown }>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test helper: simulates a write made by another tab. */
  emitExternal(changes: Record<string, { newValue?: unknown }>): void {
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) this.data.delete(key);
      else this.data.set(key, change.newValue);
    }
    this.emit(changes);
  }

  private emit(changes: Record<string, { newValue?: unknown }>): void {
    if (Object.keys(changes).length === 0) return;
    for (const listener of this.listeners) listener(changes);
  }
}
