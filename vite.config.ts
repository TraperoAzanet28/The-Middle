import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Multi-entry build: the live app's index.html plus an isolated,
    // non-wired preview entry for OwlValleyRiverPreview (preview-owl-river.html).
    // Paths are relative to the project root (Vite's default), so this is
    // additive only — the default single-entry `index.html` output used by
    // the live app is unaffected.
    rollupOptions: {
      input: {
        index: "index.html",
        previewOwlRiver: "preview-owl-river.html",
      },
    },
  },
});
