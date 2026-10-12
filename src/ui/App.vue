<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ColorPopover from "./ColorPopover.vue";
import NoteEditor from "./NoteEditor.vue";
import ResultControls from "./ResultControls.vue";
import { trapTab } from "./focus";
import type { AnchorRect, UiState } from "./state";

const props = defineProps<{ state: UiState }>();

const MARGIN = 8;
const EDITOR_SIZE = { width: 372, height: 372 };
const COLORS_SIZE = { width: 320, height: 400 };

const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null);
const editorBox = ref<HTMLElement | null>(null);
const colorsBox = ref<HTMLElement | null>(null);
const { panel, colorPicker } = props.state;

/** Opens below the control, flipped above when there's no room, always inside the viewport. */
function place(anchor: AnchorRect, size: { width: number; height: number }) {
  const maxLeft = Math.max(MARGIN, window.innerWidth - size.width - MARGIN);
  const below = anchor.bottom + MARGIN;
  const fitsBelow = below + size.height <= window.innerHeight - MARGIN;
  const top = fitsBelow ? below : Math.max(MARGIN, anchor.top - size.height - MARGIN);
  return { left: `${Math.min(Math.max(MARGIN, anchor.left), maxLeft)}px`, top: `${top}px` };
}

const editorStyle = computed(() => (panel.value ? place(panel.value.anchor, EDITOR_SIZE) : {}));
const colorsStyle = computed(() => (colorPicker.value ? place(colorPicker.value.anchor, COLORS_SIZE) : {}));

const editorPath = computed(() => {
  const key = panel.value?.entry.urlKey;
  if (!key) return "";
  try {
    const u = new URL(key);
    return u.pathname + u.search;
  } catch {
    return "";
  }
});

/** Clicking outside the note editor saves it, like the original extension did. */
function onEditorOutside(): void {
  editorRef.value?.save();
}

function trapEditor(event: KeyboardEvent): void {
  if (editorBox.value) trapTab(event, editorBox.value);
}

function trapColors(event: KeyboardEvent): void {
  if (colorsBox.value) trapTab(event, colorsBox.value);
}

function restoreFocus(opener: HTMLElement | null | undefined): void {
  if (opener?.isConnected) opener.focus();
}

watch(panel, (now, before) => {
  if (!now && before) restoreFocus(before.anchor.opener);
});
watch(colorPicker, (now, before) => {
  if (!now && before) restoreFocus(before.anchor.opener);
});
</script>

<template>
  <Teleport v-for="entry in state.entries.value" :key="entry.id" :to="entry.mount">
    <ResultControls :entry="entry" :state="state" />
  </Teleport>

  <div
    v-if="panel"
    class="overlay ui"
    :data-theme="state.pageTheme.value"
    :style="{ '--accent': state.theme.value.bg, '--on-accent': state.theme.value.text }"
    @click.self="onEditorOutside"
  >
    <div ref="editorBox" class="popover" :style="editorStyle" @keydown="trapEditor">
      <NoteEditor
        :key="panel.entry.id"
        ref="editorRef"
        :host="panel.entry.host"
        :path="editorPath"
        :scope="panel.scope"
        :texts="panel.texts"
        :available="{ url: !!panel.entry.urlKey, site: !!panel.entry.host }"
        @save="({ scope, text }) => state.saveNote(scope, text)"
        @delete="({ scope }) => state.deleteNote(scope)"
        @close="state.closePanel()"
      />
    </div>
  </div>

  <div
    v-if="colorPicker"
    class="overlay ui"
    :data-theme="state.pageTheme.value"
    :style="{ '--accent': state.theme.value.bg, '--on-accent': state.theme.value.text }"
    @click.self="state.closeColorPicker()"
  >
    <div ref="colorsBox" class="popover" :style="colorsStyle" @keydown="trapColors">
      <ColorPopover
        :theme="state.theme.value"
        @apply="(theme) => state.applyTheme(theme)"
        @close="state.closeColorPicker()"
      />
    </div>
  </div>
</template>
