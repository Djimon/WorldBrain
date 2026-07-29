// Nur fuer Browser-Preview des #320-Spikes: leitet / auf /spike-graph.html um,
// damit nicht die Tauri-Haupt-App im Browser laedt (haengt ohne Tauri-Runtime).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: projectRoot,
  plugins: [
    react(),
    {
      name: 'root-to-spike',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url === '/index.html') req.url = '/temp/bloom-repro.html';
          next();
        });
      },
    },
  ],
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
});
