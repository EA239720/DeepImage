import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// Tesseract's worker, engine and English model ship inside the app (see src/lib/ocr.ts),
// so reading text from images never needs the network.
const ocrAssets = viteStaticCopy({
  targets: [
    { src: "node_modules/tesseract.js/dist/worker.min.js", dest: "ocr", rename: { stripBase: true } },
    { src: "node_modules/tesseract.js-core/tesseract-core-*lstm.wasm.js", dest: "ocr/core", rename: { stripBase: true } },
    {
      src: "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
      dest: "ocr/lang",
      rename: { stripBase: true },
    },
  ],
});

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), ocrAssets],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
