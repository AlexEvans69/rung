<script setup lang="ts">
import { computed, ref } from "vue";
import { bestTextColor, contrastRatio, gradeContrast } from "../core/contrast";
import { DEFAULT_THEME, PRESETS, isValidColor, toSixDigitHex } from "../core/theme";
import type { BadgeTheme } from "../core/types";
import Icon from "./Icon.vue";

const props = defineProps<{ theme: BadgeTheme }>();
const emit = defineEmits<{ apply: [theme: BadgeTheme]; close: [] }>();

const bg = ref(props.theme.bg);
const text = ref(props.theme.text);
/** While on, changing the background also re-picks a readable text colour. */
const auto = ref(false);

const bgValid = computed(() => isValidColor(bg.value));
const textValid = computed(() => isValidColor(text.value));
const valid = computed(() => bgValid.value && textValid.value);

const ratio = computed(() => (valid.value ? contrastRatio(bg.value, text.value) : 0));
const grade = computed(() => gradeContrast(ratio.value));
const gradeText = computed(() => {
  if (!valid.value) return "Enter two valid hex colours";
  const r = `${ratio.value.toFixed(1)} : 1`;
  if (grade.value === "AAA") return `Contrast ${r} · excellent`;
  if (grade.value === "AA") return `Contrast ${r} · good`;
  if (grade.value === "large") return `Contrast ${r} · readable for bold text`;
  return `Contrast ${r} · hard to read`;
});

const previewBg = computed(() => (bgValid.value ? bg.value : DEFAULT_THEME.bg));
const previewText = computed(() => (textValid.value ? text.value : DEFAULT_THEME.text));

function setBg(value: string): void {
  bg.value = value;
  if (auto.value && isValidColor(value)) text.value = bestTextColor(value);
}

function setText(value: string): void {
  text.value = value;
  auto.value = false;
}

function toggleAuto(): void {
  auto.value = !auto.value;
  if (auto.value && bgValid.value) text.value = bestTextColor(bg.value);
}

function usePreset(preset: { bg: string; text: string }): void {
  bg.value = preset.bg;
  text.value = preset.text;
  auto.value = false;
}

const isSelected = (preset: { bg: string; text: string }) =>
  toSixDigitHex(preset.bg) === toSixDigitHex(bg.value) && toSixDigitHex(preset.text) === toSixDigitHex(text.value);

function reset(): void {
  bg.value = DEFAULT_THEME.bg;
  text.value = DEFAULT_THEME.text;
  auto.value = false;
}

function apply(): void {
  if (valid.value) emit("apply", { bg: bg.value.trim(), text: text.value.trim() });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  } else if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
    apply();
  }
}
</script>

<template>
  <div class="colors" role="dialog" aria-label="Badge colours" @keydown="onKeydown">
    <header class="ed-head">
      <div class="ed-title"><div class="ed-host">Badge colours</div></div>
      <button type="button" class="icon-btn" aria-label="Close" @click="emit('close')">
        <Icon name="x" :size="16" />
      </button>
    </header>

    <div class="mini" aria-hidden="true">
      <span class="mini-badge" :style="{ background: previewBg, color: previewText }">12</span>
      <div class="mini-body">
        <div class="mini-site"><span class="mini-fav"></span>example.com</div>
        <div class="mini-title">iPhone deals 2026</div>
        <div class="mini-lines"><i></i><i></i></div>
      </div>
      <span class="mini-note" :style="{ background: previewBg, color: previewText }">
        <Icon name="note" :size="12" />Note
      </span>
    </div>

    <div class="presets" role="group" aria-label="Presets">
      <button
        v-for="preset in PRESETS"
        :key="preset.label"
        type="button"
        class="preset"
        :class="{ selected: isSelected(preset) }"
        :style="{ background: preset.bg, color: preset.text }"
        :title="preset.label"
        :aria-label="preset.label"
        :aria-pressed="isSelected(preset)"
        @click="usePreset(preset)"
      >
        Aa
      </button>
    </div>

    <div class="fields">
      <label class="field">
        <span>Background</span>
        <span class="field-row">
          <input
            type="color"
            class="swatch"
            :value="toSixDigitHex(bg)"
            aria-label="Background colour picker"
            @input="setBg(($event.target as HTMLInputElement).value)"
          />
          <input
            type="text"
            class="hex"
            :class="{ invalid: !bgValid }"
            :value="bg"
            maxlength="7"
            spellcheck="false"
            autocomplete="off"
            aria-label="Background colour hex"
            @input="setBg(($event.target as HTMLInputElement).value)"
          />
        </span>
      </label>
      <label class="field">
        <span>Text</span>
        <span class="field-row">
          <input
            type="color"
            class="swatch"
            :value="toSixDigitHex(text)"
            aria-label="Text colour picker"
            @input="setText(($event.target as HTMLInputElement).value)"
          />
          <input
            type="text"
            class="hex"
            :class="{ invalid: !textValid }"
            :value="text"
            maxlength="7"
            spellcheck="false"
            autocomplete="off"
            aria-label="Text colour hex"
            @input="setText(($event.target as HTMLInputElement).value)"
          />
        </span>
      </label>
    </div>

    <button type="button" class="toggle-row" role="switch" :aria-checked="auto" @click="toggleAuto">
      <span class="switch" :class="{ on: auto }"><i></i></span>
      Pick the text colour automatically
    </button>

    <p class="contrast" :class="valid ? grade : 'poor'" role="status">
      <Icon :name="valid && (grade === 'AAA' || grade === 'AA') ? 'check' : 'alert'" :size="14" />
      {{ gradeText }}
    </p>

    <footer class="ed-foot">
      <button type="button" class="btn" @click="reset">Reset</button>
      <span class="spacer"></span>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button type="button" class="btn primary" :disabled="!valid" @click="apply">Apply</button>
    </footer>
  </div>
</template>
