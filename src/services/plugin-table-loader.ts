// M9-S07: plugin lookup-table loader (EPIC-014 decision 13)
// Loads a system plugin's tables/<name>.json (declarative lookup data, e.g.
// prof_by_level) via Tauri fs. A missing table file resolves to an empty
// object — no crash (AP-006 filesystem/JSON exceptions).
import { readTextFile } from '@tauri-apps/plugin-fs';

export async function loadPluginTable(
  pluginId: string,
  tableName: string,
): Promise<Record<string, number>> {
  const path = `plugins/${pluginId}/tables/${tableName}.json`;
  try {
    const raw = await readTextFile(path);
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}
