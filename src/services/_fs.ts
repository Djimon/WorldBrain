// Platform filesystem shim.
// Production (Tauri WebView): swap this module via Vite alias to a @tauri-apps/plugin-fs implementation.
// Tests / Node.js context: re-exports Node.js fs directly — no Tauri runtime needed.
// @tauri-apps/plugin-fs
export {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
export type { Dirent } from 'node:fs';
