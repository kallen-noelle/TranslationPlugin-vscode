import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * Vite multi-entry config for the VS Code extension's 4 webview panels.
 * Each entry produces its own HTML + JS bundle under out/webview-assets/.
 *
 * Build output structure:
 *   out/webview-assets/
 *     TranslationDialog.html
 *     TranslationDialog-abc123.js
 *     WordOfDay.html
 *     WordOfDay-def456.js
 *     WordDetails.html
 *     WordDetails-ghi789.js
 *     WordBook.html
 *     WordBook-jkl012.js
 *
 * Dev preview flow:
 *   npm run watch:webview    → 增量 build 到 out/webview-assets/
 *   npm run preview:webview  → vite preview --root=out/webview-assets
 *   打开 http://localhost:5173/WordBook.html
 */

const WEBVIEW_DIR = resolve(__dirname, 'webview-ui');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // relative paths so host can resolve via asWebviewUri
  build: {
    outDir: 'out/webview-assets',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        TranslationDialog: resolve(WEBVIEW_DIR, 'TranslationDialog.html'),
        WordOfDay: resolve(WEBVIEW_DIR, 'WordOfDay.html'),
        WordDetails: resolve(WEBVIEW_DIR, 'WordDetails.html'),
        WordBook: resolve(WEBVIEW_DIR, 'WordBook.html'),
      },
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(WEBVIEW_DIR, 'src'),
    },
  },
  css: {
    preprocessorOptions: {},
  },
});
