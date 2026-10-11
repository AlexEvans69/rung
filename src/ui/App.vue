<script setup lang="ts">
import { computed, ref } from "vue";
import ColorPicker from "./ColorPicker.vue";
import NotePanel from "./NotePanel.vue";
import ResultControls from "./ResultControls.vue";
import type { UiState } from "./state";

const props = defineProps<{ state: UiState }>();

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 340;
const MARGIN = 8;

const panelRef = ref<InstanceType<typeof NotePanel> | null>(null);
const panel = props.state.panel;

/** Opens below the "Note" button, flipped/clamped so it always stays inside the viewport. */
const panelStyle = computed(() => {
  const p = panel.value;
  if (!p) return {};
  const maxLeft = Math.max(MARGIN, window.innerWidth - PANEL_WIDTH - MARGIN);
  const below = p.anchor.bottom + MARGIN;
  const fitsBelow = below + PANEL_HEIGHT <= window.innerHeight - MARGIN;
  const top = fitsBelow ? below : Math.max(MARGIN, p.anchor.top - PANEL_HEIGHT - MARGIN);
  return {
    left: `${Math.min(Math.max(MARGIN, p.anchor.left), maxLeft)}px`,
    top: `${top}px`,
  };
});

/** Clicking outside the note panel saves it, like the original extension did. */
function onOverlayClick(): void {
  panelRef.value?.save();
}
</script>

<template>
  <Teleport v-for="entry in state.entries.value" :key="entry.id" :to="entry.mount">
    <ResultControls :entry="entry" :state="state" />
  </Teleport>

  <div v-if="panel" class="overlay" @click.self="onOverlayClick">
    <div class="panel" :style="panelStyle">
      <NotePanel
        :key="panel.entry.id"
        ref="panelRef"
        :scope="panel.scope"
        :text="panel.text"
        @save="({ scope, text }) => state.saveNote(scope, text)"
        @delete="({ scope }) => state.deleteNote(scope)"
        @close="state.closePanel()"
      />
    </div>
  </div>

  <div v-if="state.colorPickerOpen.value" class="overlay dim" @click.self="state.closeColorPicker()">
    <div class="panel modal">
      <ColorPicker
        :theme="state.theme.value"
        @apply="(theme) => state.applyTheme(theme)"
        @close="state.closeColorPicker()"
      />
    </div>
  </div>
</template>
