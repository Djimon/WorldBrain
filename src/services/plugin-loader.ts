import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

export interface PluginManifest {
  id: string;
  label: string;
  version: string;
  compatibility?: { app_schema?: string };
  entity_types?: string[];
  relation_types?: string[];
  card_templates?: string[];
  views?: string[];
  rules?: string[];
  assets?: string[];
  [key: string]: unknown;
}

export interface PluginRegistryEntry {
  manifest: PluginManifest;
  status: 'loaded' | 'failed' | 'conflict' | 'outdated';
  errors?: string[];
}

let _registry: Record<string, PluginRegistryEntry> = {};

export function validatePluginManifest(manifest: object): { errors: string[] } {
  const m = manifest as Record<string, unknown>;
  const errors: string[] = [];
  if (!m.id) errors.push('Missing required field: id');
  if (!m.label) errors.push('Missing required field: label');
  if (!m.version) errors.push('Missing required field: version');
  if (!m.compatibility) errors.push('Missing required field: compatibility');
  return { errors };
}

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
        manifest: { id: folder, label: folder, version: '0.0.0' },
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
