<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import logo from "../../brand/rung.svg?raw";
import { BRAND } from "../brand";
import { PRESETS, toSixDigitHex } from "../core/theme";
import { backupToStorageItems, buildBackup, parseBackup } from "../storage/backup";
import type { KeyValueStore } from "../storage/kv";
import type { NotesRepository } from "../storage/notes";
import type { Settings, SettingsRepository } from "../storage/settings";

const props = defineProps<{ store: KeyValueStore; notes: NotesRepository; settings: SettingsRepository }>();

const settings = ref<Settings>(props.settings.get());
const theme = ref(props.notes.getTheme());
const noteCount = ref(props.notes.count());
const status = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const inTab = new URLSearchParams(location.search).has("tab");
const version = (() => {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "";
  }
})();

const stops = [
  props.settings.subscribe((s) => (settings.value = s)),
  props.notes.subscribe(() => {
    theme.value = props.notes.getTheme();
    noteCount.value = props.notes.count();
  }),
];
onBeforeUnmount(() => stops.forEach((stop) => stop()));

const noteLabel = computed(() => `${noteCount.value} ${noteCount.value === 1 ? "note" : "notes"} saved`);

function toggle(key: keyof Settings): void {
  void props.settings.update({ [key]: !settings.value[key] });
}

function selectPreset(preset: { bg: string; text: string }): void {
  void props.notes.saveTheme({ bg: preset.bg, text: preset.text });
}

async function exportNotes(): Promise<void> {
  const backup = buildBackup(await props.store.getAll());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `serp-counter-notes-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  const total = Object.keys(backup.notes.url).length + Object.keys(backup.notes.site).length;
  status.value = `Exported ${total} ${total === 1 ? "note" : "notes"}.`;
}

/** A file dialog closes the toolbar popup, so importing happens in a regular tab. */
function startImport(): void {
  if (inTab) fileInput.value?.click();
  else window.open(chrome.runtime.getURL("popup.html?tab=1"));
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    status.value = parsed.error;
    return;
  }
  const items = backupToStorageItems(parsed.backup);
  await props.store.set(items);
  const total = Object.keys(parsed.backup.notes.url).length + Object.keys(parsed.backup.notes.site).length;
  status.value = `Imported ${total} ${total === 1 ? "note" : "notes"}.`;
}
</script>

<template>
  <main class="popup" :class="{ tab: inTab }">
    <header class="head">
      <span class="logo" role="img" :aria-label="BRAND.name" v-html="logo"></span>
      <h1>
        {{ BRAND.name }}
        <small class="muted">{{ BRAND.tagline }}</small>
      </h1>
      <span v-if="version" class="muted">v{{ version }}</span>
    </header>

    <div class="row">
      <div class="grow">
        <div class="label">Numbering</div>
        <div class="muted">Position next to each organic result</div>
      </div>
      <button
        type="button"
        class="switch"
        :class="{ on: settings.numbering }"
        role="switch"
        :aria-checked="settings.numbering"
        aria-label="Numbering"
        @click="toggle('numbering')"
      >
        <i></i>
      </button>
    </div>

    <div class="row">
      <div class="grow">
        <div class="label">Notes</div>
        <div class="muted">Note button and saved notes in the results</div>
      </div>
      <button
        type="button"
        class="switch"
        :class="{ on: settings.notes }"
        role="switch"
        :aria-checked="settings.notes"
        aria-label="Notes"
        @click="toggle('notes')"
      >
        <i></i>
      </button>
    </div>

    <section class="section">
      <div class="label">Badge colour</div>
      <div class="presets">
        <button
          v-for="preset in PRESETS"
          :key="preset.label"
          type="button"
          class="preset"
          :class="{ selected: toSixDigitHex(preset.bg) === toSixDigitHex(theme.bg) && toSixDigitHex(preset.text) === toSixDigitHex(theme.text) }"
          :style="{ background: preset.bg, color: preset.text }"
          :title="preset.label"
          :aria-label="preset.label"
          @click="selectPreset(preset)"
        >
          Aa
        </button>
      </div>
      <div class="muted">Click a badge in the results for custom colours.</div>
    </section>

    <footer class="foot">
      <span class="grow muted">{{ noteLabel }}</span>
      <button type="button" class="link" @click="exportNotes">Export</button>
      <button type="button" class="link" @click="startImport">Import</button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </footer>
    <p class="status" role="status" aria-live="polite">{{ status }}</p>
  </main>
</template>
