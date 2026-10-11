<script setup lang="ts">
import { computed, ref } from "vue";
import { DEFAULT_THEME, PRESETS, isValidColor, toSixDigitHex } from "../core/theme";
import type { BadgeTheme } from "../core/types";

const props = defineProps<{ theme: BadgeTheme }>();
const emit = defineEmits<{ apply: [theme: BadgeTheme]; close: [] }>();

const bg = ref(props.theme.bg);
const text = ref(props.theme.text);

const bgValid = computed(() => isValidColor(bg.value));
const textValid = computed(() => isValidColor(text.value));
const canApply = computed(() => bgValid.value && textValid.value);

function apply(): void {
  if (!canApply.value) return;
  emit("apply", { bg: bg.value.trim(), text: text.value.trim() });
}

function reset(): void {
  bg.value = DEFAULT_THEME.bg;
  text.value = DEFAULT_THEME.text;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}
</script>

<template>
  <div role="dialog" aria-label="Badge colours" style="display: contents" @keydown="onKeydown">
    <div class="picker-body">
      <section>
        <div class="field">
          <label for="serp-bg">Background colour</label>
          <div class="field-row">
            <input
              class="color-input"
              type="color"
              aria-label="Background colour picker"
              :value="toSixDigitHex(bg)"
              @input="bg = ($event.target as HTMLInputElement).value"
            />
            <input
              id="serp-bg"
              v-model="bg"
              class="color-text"
              :class="{ invalid: !bgValid }"
              type="text"
              placeholder="#667eea"
              maxlength="7"
            />
          </div>
        </div>
        <div class="field">
          <label for="serp-fg">Text colour</label>
          <div class="field-row">
            <input
              class="color-input"
              type="color"
              aria-label="Text colour picker"
              :value="toSixDigitHex(text)"
              @input="text = ($event.target as HTMLInputElement).value"
            />
            <input
              id="serp-fg"
              v-model="text"
              class="color-text"
              :class="{ invalid: !textValid }"
              type="text"
              placeholder="#ffffff"
              maxlength="7"
            />
          </div>
        </div>
        <span
          class="preview-chip"
          :style="{ background: bgValid ? bg : DEFAULT_THEME.bg, color: textValid ? text : DEFAULT_THEME.text }"
        >
          Preview
        </span>
      </section>

      <section class="presets">
        <button
          v-for="preset in PRESETS"
          :key="preset.label"
          type="button"
          class="preset"
          @click="
            bg = preset.bg;
            text = preset.text;
          "
        >
          <span class="swatch" :style="{ background: preset.bg }"></span>
          {{ preset.label }}
        </button>
      </section>
    </div>

    <div class="actions">
      <button type="button" class="action ghost" @click="reset">Reset</button>
      <button type="button" class="action ghost" @click="emit('close')">Close</button>
      <button type="button" class="action primary" :disabled="!canApply" @click="apply">Apply</button>
    </div>
  </div>
</template>
