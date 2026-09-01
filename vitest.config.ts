import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { featureDefines } from './scripts/feature-defines.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const domTestSetup = fileURLToPath(new URL('./tests/dom-test-setup.ts', import.meta.url));

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  // pre-release S2 (#404): same __FEATURE_<ID>__ constants as vite.config.ts, so the
  // feature-config unit tests run against the real build env. See src/config/features.ts.
  define: featureDefines(),
  test: {
    environment: 'jsdom',
    include: ['tests/*.dom.test.tsx', 'tests/*.test.ts'],
    setupFiles: [domTestSetup],
  },
});
