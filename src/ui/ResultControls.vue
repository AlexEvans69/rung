<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ResultEntry, UiState } from "./state";

const props = defineProps<{ entry: ResultEntry; state: UiState }>();

const LINE_HEIGHT = 13 * 1.35;
const MIN_PREVIEW_HEIGHT = Math.round(LINE_HEIGHT * 3 + 16 + 6);

const note = computed(() => props.state.effectiveNote(props.entry));
const vars = computed(() => ({
  "--serp-bg": props.state.theme.value.bg,
  "--serp-fg": props.state.theme.value.text,
}));

const noteButton = ref<HTMLButtonElement | null>(null);
const previewEl = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflowing = ref(false);
const maxWidth = ref(400);

const limit = computed(() => Math.max(40, props.entry.snippetHeight, MIN_PREVIEW_HEIGHT));
const bodyStyle = computed(() => ({
  maxHeight: expanded.value ? "none" : `${limit.value}px`,
}));

function openPanel(): void {
  const rect = (noteButton.value ?? previewEl.value)?.getBoundingClientRect();
  props.state.openNote(props.entry, {
    left: rect?.left ?? 0,
    top: rect?.top ?? 0,
    bottom: rect?.bottom ?? 0,
  });
}

function measure(): void {
  const el = previewEl.value;
  if (!el) {
    overflowing.value = false;
    expanded.value = false;
    return;
  }
  const rect = el.getBoundingClientRect();
  maxWidth.value = Math.max(200, Math.min(600, window.innerWidth - rect.right + rect.width - 80));
  const textEl = el.querySelector(".note-preview-text");
  overflowing.value = (textEl?.scrollHeight ?? 0) > limit.value + 1;
  if (!overflowing.value) expanded.value = false;
}

watch(
  () => [note.value.text, limit.value],
  () => nextTick(measure),
);

onMounted(() => {
  nextTick(measure);
  window.addEventListener("resize", measure);
});
onBeforeUnmount(() => window.removeEventListener("resize", measure));
</script>

<template>
  <div :style="vars">
    <button
      type="button"
      class="badge"
      :title="`Result #${entry.index} — click to change colours`"
      :aria-label="`Result number ${entry.index}. Change badge colours`"
      @click="state.openColorPicker()"
    >
      {{ entry.index }}
    </button>

    <div class="note-widget">
      <div class="note-wrap">
        <button ref="noteButton" type="button" class="note-btn" @click="openPanel">Note</button>

        <div
          v-if="note.text"
          ref="previewEl"
          class="note-preview"
          :style="{ maxWidth: `${maxWidth}px` }"
          @click="openPanel"
        >
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
  </div>
</template>
