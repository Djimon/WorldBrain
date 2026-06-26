// Platform path shim — pure string operations, same API in Node.js and browser.
// @tauri-apps/plugin-fs path helpers are used where needed in Tauri-specific code.
export { dirname, join, relative } from 'node:path';
