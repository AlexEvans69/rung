<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { NoteScope } from "../core/types";
import Icon from "./Icon.vue";

const props = defineProps<{
  host: string | null;
  path: string;
  scope: NoteScope;
  texts: Record<NoteScope, string>;
}>();

const emit = defineEmits<{
  save: [payload: { scope: NoteScope; text: string }];
  delete: [payload: { scope: NoteScope }];
  close: [];
}>();

const scope = ref<NoteScope>(props.scope);
const text = ref(props.texts[props.scope]);
const dirty = ref(false);
const textarea = ref<HTMLTextAreaElement | null>(null);

const displayHost = computed(() => props.host ?? "this site");
const initial = computed(() => (props.host ?? "?").charAt(0).toUpperCase());
/** Stable per-site hue for the avatar, so sites are recognisable at a glance. */
const hue = computed(() => {
  let h = 0;
  for (const ch of props.host ?? "") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
});
const scopeHint = computed(() =>
  scope.value === "url" ? "Shown only on this exact page." : `Shown on every page of ${displayHost.value}.`,
);
const priorityHint = computed(() =>
  scope.value === "site" && props.texts.url ? "This page has its own note, which takes priority here." : "",
);
const canDelete = computed(() => !!props.texts[scope.value]);

function select(next: NoteScope): void {
  if (next === scope.value) return;
  scope.value = next;
  // Show what is stored for that scope, unless the user has already started typing.
  if (!dirty.value) text.value = props.texts[next];
}

function onInput(): void {
  dirty.value = true;
}

function save(): void {
  emit("save", { scope: scope.value, text: text.value });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    save();
  }
}

onMounted(() => {
  textarea.value?.focus();
  textarea.value?.setSelectionRange(text.value.length, text.value.length);
});

defineExpose({ save });
</script>

<template>
  <div class="editor" role="dialog" aria-label="Note" @keydown="onKeydown">
    <header class="ed-head">
      <span class="avatar" :style="{ background: `hsl(${hue} 55% 45%)` }" aria-hidden="true">{{ initial }}</span>
      <div class="ed-title">
        <div class="ed-host">{{ displayHost }}</div>
        <div v-if="path" class="ed-path">{{ path }}</div>
      </div>
      <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')">
        <Icon name="x" :size="16" />
      </button>
    </header>

    <div class="seg" role="group" aria-label="Note applies to">
      <button type="button" :class="{ on: scope === 'url' }" :aria-pressed="scope === 'url'" @click="select('url')">
        This page
      </button>
      <button type="button" :class="{ on: scope === 'site' }" :aria-pressed="scope === 'site'" @click="select('site')">
        Whole site
      </button>
    </div>
    <p class="hint">{{ scopeHint }} <span v-if="priorityHint">{{ priorityHint }}</span></p>

    <textarea
      ref="textarea"
      v-model="text"
      class="field-text"
      rows="5"
      placeholder="What stands out about this result?"
      aria-label="Note text"
      @input="onInput"
    ></textarea>

    <footer class="ed-foot">
      <button
        type="button"
        class="icon-btn danger"
        aria-label="Delete note"
        :disabled="!canDelete"
        @click="emit('delete', { scope })"
      >
        <Icon name="trash" :size="16" />
      </button>
      <span class="count">{{ text.length }} chars</span>
      <span class="spacer"></span>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button type="button" class="btn primary" @click="save">Save</button>
    </footer>
    <p class="keys">Esc cancels · Ctrl/⌘+Enter saves · clicking outside saves</p>
  </div>
</template>
