import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/** The toolbar popup: an ordinary extension page, built after (and next to) the content script. */
export default defineConfig(({ mode }) => ({
  base: "",
  plugins: [vue()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: mode === "development",
    minify: mode !== "development",
    rollupOptions: { input: { popup: "popup.html" } },
  },
}));
