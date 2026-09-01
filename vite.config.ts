import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { featureDefines } from './scripts/feature-defines.mjs';

export default defineConfig({
  plugins: [react()],
  // pre-release S2 (#404): features.json → __FEATURE_<ID>__ compile constants, so a
  // release build tree-shakes unreleased feature code out of dist/. See src/config/features.ts.
  define: featureDefines(),
  server: {
    watch: {
      // Prevent Vite from watching Cargo build artifacts on Windows (EBUSY lock)
      ignored: ['**/src-tauri/target/**'],
    },
  },
});
