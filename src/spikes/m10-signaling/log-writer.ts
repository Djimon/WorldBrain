// Ein-Datei-Logger für den Spike: schreibt jede Zeile append-mode via Tauri
// fs-Plugin in Dokumente\wbx-signaling-spike\<timestamp>-<peer>.log. Fallback
// (Browser ohne Tauri): nur console + in-memory. Der Pfad wird via getPath()
// exponiert, damit die UI ihn dem User zeigen kann.
import { writeTextFile, mkdir, BaseDirectory, exists } from '@tauri-apps/plugin-fs';

const LOG_DIR = 'wbx-signaling-spike';

export interface LogWriter {
  /** Absoluter Pfad (nur wenn Tauri verfügbar), sonst Marker-String. */
  getPath(): string;
  /** Zeile mit Zeitstempel schreiben. Silent-Fail bei fs-Errors. */
  write(line: string): Promise<void>;
  /** Freie Markierung ohne Zeitstempel — z. B. Section-Header. */
  writeRaw(text: string): Promise<void>;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export async function createLogWriter(peerLabel: string): Promise<LogWriter> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `spike-${stamp}-peer${peerLabel}.log`;
  const path = `${LOG_DIR}/${filename}`;

  if (!isTauri()) {
    console.warn('[log-writer] Tauri fs API nicht verfügbar (Browser-Modus) — Log nur in Console.');
    return {
      getPath: () => '(browser mode — nur Console)',
      async write(line) { console.log(`${timestamp()} ${line}`); },
      async writeRaw(text) { console.log(text); },
    };
  }

  // Sicherstellen dass Log-Verzeichnis existiert (idempotent).
  try {
    const dirExists = await exists(LOG_DIR, { baseDir: BaseDirectory.Document });
    if (!dirExists) {
      await mkdir(LOG_DIR, { baseDir: BaseDirectory.Document, recursive: true });
    }
  } catch (e) {
    console.error('[log-writer] mkdir failed', e);
  }

  // Header schreiben (init = truncate: false + append: false → create-or-overwrite).
  const header = [
    `# M10 Signaling-Spike Log (#380)`,
    `# Peer: ${peerLabel}`,
    `# Start: ${timestamp()}`,
    `# UserAgent: ${navigator.userAgent}`,
    ``,
  ].join('\n');
  try {
    await writeTextFile(path, header, { baseDir: BaseDirectory.Document });
  } catch (e) {
    console.error('[log-writer] initial write failed', e);
  }

  const displayPath = `Dokumente\\${LOG_DIR}\\${filename}`;
  return {
    getPath: () => displayPath,
    async write(line) {
      const stamped = `${timestamp()} ${line}\n`;
      console.log(stamped.trim());
      try {
        await writeTextFile(path, stamped, { baseDir: BaseDirectory.Document, append: true });
      } catch (e) {
        console.error('[log-writer] append failed', e);
      }
    },
    async writeRaw(text) {
      console.log(text);
      try {
        await writeTextFile(path, text + '\n', { baseDir: BaseDirectory.Document, append: true });
      } catch (e) {
        console.error('[log-writer] append failed', e);
      }
    },
  };
}
