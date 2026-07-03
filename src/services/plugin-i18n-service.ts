// M11-S06: Plugin i18n — stub, implement in GREEN phase

interface PluginManifestWithLocales {
  id: string;
  locales?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

export async function registerPluginLocales(_manifest: PluginManifestWithLocales): Promise<void> {
  throw new Error('not implemented');
}

export function getPluginNamespace(_pluginId: string): string {
  throw new Error('not implemented');
}

export function getPluginT(_pluginId: string, _lang: string): (key: string) => string {
  throw new Error('not implemented');
}
