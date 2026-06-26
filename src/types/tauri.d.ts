declare module '@tauri-apps/api/window' {
  export class WebviewWindow {
    constructor(label: string, options?: { url?: string });
  }
}
