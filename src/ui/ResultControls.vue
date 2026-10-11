<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { ResultEntry, UiState } from "./state";

const props = defineProps<{ entry: ResultEntry; state: UiState }>();

const LINE_HEIGHT = 13 * 1.35;
const PADDING = 16;
const MIN_LINES = 2;
const MAX_LINES = 8;

const note = computed(() => props.state.effectiveNote(props.entry));
const geo = computed(() => props.entry.geo);
const rail = props.state.rail;
const vars = computed(() => ({
  "--serp-bg": props.state.theme.value.bg,
  "--serp-fg": props.state.theme.value.text,
}));

const noteButton = ref<HTMLButtonElement | null>(null);
const previewEl = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflowing = ref(false);

const showCard = computed(() => rail.value.mode === "card" && !!note.value.text);
const iconOnly = computed(() => rail.value.mode === "icon" || rail.value.mode === "inset");

/**
 * The collapsed card shows whole lines only and never reaches below its own result, so it
 * can't cover the next one.
 */
const limit = computed(() => {
  const room = (geo.value?.roomY ?? 200) - 26 - 6 - 24;
  const lines = Math.floor((room - PADDING) / LINE_HEIGHT);
  const clamped = Math.max(MIN_LINES, Math.min(MAX_LINES, lines));
  return Math.round(clamped * LINE_HEIGHT + PADDING);
});
const bodyStyle = computed(() => ({ maxHeight: expanded.value ? "none" : `${limit.value}px` }));

function openPanel(): void {
  const rect = (noteButton.value ?? previewEl.value)?.getBoundingClientRect();
  props.state.openNote(props.entry, {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    bottom: rect?.bottom ?? 0,
  });
}

function measure(): void {
  const textEl = previewEl.value?.querySelector(".note-preview-text");
  overflowing.value = (textEl?.scrollHeight ?? 0) > limit.value + 1;
  if (!overflowing.value) expanded.value = false;
}

watch(
  () => [note.value.text, limit.value, rail.value.width],
  () => nextTick(measure),
);
onMounted(() => nextTick(measure));
</script>

<template>
  <div v-if="geo" :style="vars">
    <button
      type="button"
      class="badge"
      :style="{ left: `${geo.badgeX}px`, top: `${geo.titleY}px` }"
      :title="`Result #${entry.index} — click to change colours`"
      :aria-label="`Result number ${entry.index}. Change badge colours`"
      @click="state.openColorPicker()"
    >
      {{ entry.index }}
    </button>

    <div
      class="rail"
      :class="`mode-${rail.mode}`"
      :style="{ left: `${geo.railX}px`, top: `${geo.titleY}px`, width: `${rail.width}px` }"
    >
      <button
        ref="noteButton"
        type="button"
        class="note-btn"
        :class="{ icon: iconOnly, filled: iconOnly && !!note.text }"
        :title="note.text || 'Add a note'"
        aria-label="Note"
        @click="openPanel"
      >
        <svg
          v-if="iconOnly"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M9 13h6M9 17h6" />
        </svg>
        <template v-else>Note</template>
      </button>

      <div v-if="showCard" ref="previewEl" class="note-preview" @click="openPanel">
        <div class="note-preview-inner" :style="bodyStyle">
          <div class="note-preview-text">{{ note.text }}</div>
        </div>
        <div v-if="overflowing || expanded" class="note-preview-footer">
          <button type="button" class="note-toggle" @click.stop="expanded = !expanded">
            <svg
              class="chevron"
              :class="{ up: expanded }"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            <span>{{ expanded ? "Show less" : "Show more" }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
