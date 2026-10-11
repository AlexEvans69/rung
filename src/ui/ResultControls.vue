<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import type { ResultEntry, UiState } from "./state";

const props = defineProps<{ entry: ResultEntry; state: UiState }>();

const LINE_HEIGHT = 12.5 * 1.45;
const PADDING = 8;
const MIN_LINES = 2;
const MAX_LINES = 8;

const note = computed(() => props.state.effectiveNote(props.entry));
const geo = computed(() => props.entry.geo);
const rail = props.state.rail;
const theme = props.state.theme;

const vars = computed(() => ({
  "--accent": theme.value.bg,
  "--on-accent": theme.value.text,
}));

const cardEl = ref<HTMLElement | null>(null);
const expanded = ref(false);
const overflowing = ref(false);

const hasNote = computed(() => !!note.value.text);
const showCard = computed(() => rail.value.mode === "card" && hasNote.value);
const iconOnly = computed(() => rail.value.mode === "icon" || rail.value.mode === "inset");
const scopeLabel = computed(() => (note.value.scope === "site" ? "Site" : "Page"));

/**
 * The collapsed card shows whole lines only and stops above the next result's Note control.
 * Total height = header (26) + body + "Show more" row (27) + borders (2).
 */
const bodyLimit = computed(() => {
  const room = (geo.value?.roomY ?? 240) - 26 - 27 - 2;
  const lines = Math.floor((room - PADDING) / LINE_HEIGHT);
  const clamped = Math.max(MIN_LINES, Math.min(MAX_LINES, lines));
  return Math.round(clamped * LINE_HEIGHT + PADDING);
});
const bodyStyle = computed(() => ({ maxHeight: expanded.value ? "none" : `${bodyLimit.value}px` }));

function anchorOf(el: HTMLElement | null) {
  const rect = el?.getBoundingClientRect();
  return { left: rect?.left ?? 0, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0, opener: el };
}

/** The editor opens under whatever was clicked (the chip, or the card's header row). */
function openEditor(event: MouseEvent): void {
  props.state.openNote(props.entry, anchorOf(event.currentTarget as HTMLElement));
}

function openColors(event: MouseEvent): void {
  props.state.openColorPicker(anchorOf(event.currentTarget as HTMLElement));
}

function measure(): void {
  const body = cardEl.value?.querySelector(".card-text");
  overflowing.value = (body?.scrollHeight ?? 0) > bodyLimit.value + 1;
  if (!overflowing.value) expanded.value = false;
}

/** An expanded card floats above the next results' controls (their hosts come later in the DOM). */
function raiseHost(raised: boolean): void {
  const root = props.entry.mount.getRootNode() as ShadowRoot | HTMLElement;
  const host = (root as ShadowRoot).host as HTMLElement | undefined;
  if (host) host.style.zIndex = raised ? "5" : "2";
}

watch(
  () => [note.value.text, bodyLimit.value, rail.value.width],
  () => nextTick(measure),
);
watch(expanded, raiseHost);
onMounted(() => nextTick(measure));
onBeforeUnmount(() => raiseHost(false));
</script>

<template>
  <div v-if="geo" class="ui" :data-theme="state.pageTheme.value" :style="vars">
    <button
      v-if="state.settings.value.numbering"
      type="button"
      class="badge"
      :style="{ left: `${geo.badgeX}px`, top: `${geo.titleY}px` }"
      :title="`Result #${entry.index} — click to change colours`"
      :aria-label="`Result number ${entry.index}. Change badge colours`"
      @click="openColors"
    >
      {{ entry.index }}
    </button>

    <div
      v-if="state.settings.value.notes"
      class="rail"
      :class="`mode-${rail.mode}`"
      :style="{ left: `${geo.railX}px`, top: `${geo.titleY}px`, width: `${rail.width}px` }"
    >
      <div v-if="showCard" ref="cardEl" class="card" :class="{ open: expanded }">
        <button type="button" class="card-head" :aria-label="`Edit ${scopeLabel.toLowerCase()} note`" @click="openEditor">
          <span class="tag">{{ scopeLabel }}</span>
          <Icon name="pencil" :size="14" />
        </button>
        <div class="card-body" :class="{ fade: overflowing && !expanded }" :style="bodyStyle">
          <div class="card-text">{{ note.text }}</div>
        </div>
        <button v-if="overflowing || expanded" type="button" class="card-more" @click="expanded = !expanded">
          <Icon name="chevronDown" :size="12" :class="{ flip: expanded }" />
          {{ expanded ? "Show less" : "Show more" }}
        </button>
      </div>

      <button
        v-else
        type="button"
        class="chip"
        :class="{ icon: iconOnly, filled: hasNote }"
        :title="note.text || 'Add a note'"
        aria-label="Note"
        @click="openEditor"
      >
        <Icon :name="iconOnly ? 'note' : hasNote ? 'note' : 'plus'" :size="iconOnly ? 16 : 13" />
        <template v-if="!iconOnly">Note</template>
      </button>
    </div>
  </div>
</template>
