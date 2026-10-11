import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { createManifest } from "./src/manifest";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** Emits manifest.json generated from src/manifest.ts so the version has a single source of truth. */
function manifestPlugin(): Plugin {
  return {
    name: "serp-counter-manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(createManifest(pkg.version), null, 2),
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "",
  plugins: [vue(), manifestPlugin()],
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode === "development",
    minify: mode !== "development",
    rollupOptions: {
      input: { contentScript: "src/content/index.ts" },
      output: { entryFileNames: "[name].js", format: "iife", inlineDynamicImports: true },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"],
    coverage: { provider: "v8", include: ["src/**/*.{ts,vue}"] },
  },
}));
