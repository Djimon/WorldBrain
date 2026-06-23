import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const domTestSetup = fileURLToPath(new URL('./tests/dom-test-setup.ts', import.meta.url));

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/*.dom.test.tsx', 'tests/*.test.ts'],
    setupFiles: [domTestSetup],
  },
});
