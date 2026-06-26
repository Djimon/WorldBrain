import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Prevent Vite from watching Cargo build artifacts on Windows (EBUSY lock)
      ignored: ['**/src-tauri/target/**'],
    },
  },
});
