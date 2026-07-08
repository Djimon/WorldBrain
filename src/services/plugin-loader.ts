import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { SystemPluginManifest } from './plugin-validator';

// #225: single canonical manifest shape (plugin-validator.ts) — the M6-era
// `label`/`compatibility`-based PluginManifest interface and its own
// validatePluginManifest (never called by any production code or test; the
// real validation path is plugin-validator.ts) have been retired in favor of
// this one, to stop the two manifest schemas drifting apart.
export type PluginManifest = SystemPluginManifest;

export interface PluginRegistryEntry {
  manifest: PluginManifest;
  status: 'loaded' | 'failed' | 'conflict' | 'outdated';
  errors?: string[];
}

let _registry: Record<string, PluginRegistryEntry> = {};

export async function scanPlugins(pluginDir: string): Promise<Record<string, PluginRegistryEntry>> {
  _registry = {};
  let entries: string[] = [];
  try {
    entries = (await readDir(pluginDir))
      .filter((d) => d.isDirectory)
      .map((d) => d.name)
      .sort();
  } catch {
    // AP-006: plugin dir absent or unreadable — return empty registry
    return _registry;
  }

  for (const folder of entries) {
    const manifestPath = await join(pluginDir, folder, 'plugin.json');
    try {
      const raw = await readTextFile(manifestPath);
      const manifest = JSON.parse(raw) as PluginManifest;
      _registry[folder] = { manifest, status: 'loaded' };
    } catch {
      // AP-006: plugin.json missing or malformed — mark as failed, continue loading others
      _registry[folder] = {
        manifest: { id: folder, name: folder, version: '0.0.0' },
        status: 'failed',
        errors: ['Failed to parse plugin.json'],
      };
    }
  }

  return _registry;
}

export function getPlugin(id: string): PluginRegistryEntry | undefined {
  return _registry[id];
}

export function getPluginRegistry(): Record<string, PluginRegistryEntry> {
  return _registry;
}

export function getPluginsByResource(resourceType: keyof PluginManifest): PluginRegistryEntry[] {
  return Object.values(_registry).filter((entry) => {
    const res = entry.manifest[resourceType];
    return Array.isArray(res) && res.length > 0;
  });
}
