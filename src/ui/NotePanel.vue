<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { NoteScope } from "../core/types";

const props = defineProps<{ scope: NoteScope; text: string }>();

const emit = defineEmits<{
  save: [payload: { scope: NoteScope; text: string }];
  delete: [payload: { scope: NoteScope }];
  close: [];
}>();

const scope = ref<NoteScope>(props.scope);
const text = ref(props.text);
const textarea = ref<HTMLTextAreaElement | null>(null);

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

onMounted(() => textarea.value?.focus());

defineExpose({ save });
</script>

<template>
  <div role="dialog" aria-label="Note" style="display: contents" @keydown="onKeydown">
    <div class="panel-header">
      <div class="scope-buttons">
        <button
          type="button"
          class="scope-btn"
          :class="{ active: scope === 'url' }"
          :aria-pressed="scope === 'url'"
          @click="scope = 'url'"
        >
          This URL
        </button>
        <button
          type="button"
          class="scope-btn"
          :class="{ active: scope === 'site' }"
          :aria-pressed="scope === 'site'"
          @click="scope = 'site'"
        >
          This site
        </button>
      </div>
      <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')">×</button>
    </div>

    <textarea
      ref="textarea"
      v-model="text"
      class="note-text"
      placeholder="Start typing…"
      aria-label="Note text"
    ></textarea>

    <div class="actions">
      <button type="button" class="action danger" @click="emit('delete', { scope })">Delete</button>
      <button type="button" class="action ghost" @click="emit('close')">Cancel</button>
      <button type="button" class="action primary" @click="save">Save</button>
    </div>
    <p class="hint">Esc cancels · Ctrl/⌘+Enter saves · clicking outside saves</p>
  </div>
</template>
