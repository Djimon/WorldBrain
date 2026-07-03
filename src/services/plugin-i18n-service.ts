// M11-S06: System-Plugin-String-Lokalisierung (EPIC-017)
// Registers a system plugin's locale bundles into the shared i18next layer under
// a per-plugin namespace `plugin:<plugin_id>`. Missing translations fall back to
// the canonical key (the plugin-authored string), never to Core-en. Homebrew
// content is never translated — an unregistered key returns as-is.
import i18n from '../i18n';

export interface PluginManifestWithLocales {
  id: string;
  locales?: Record<string, Record<string, string>>;
  [key: string]: unknown;
}

export function getPluginNamespace(pluginId: string): string {
  return `plugin:${pluginId}`;
}

export async function registerPluginLocales(manifest: PluginManifestWithLocales): Promise<void> {
  if (!manifest.locales) return;
  const namespace = getPluginNamespace(manifest.id);
  for (const [lang, resources] of Object.entries(manifest.locales)) {
    // deep + overwrite so re-registration (e.g. plugin reload) replaces stale strings.
    i18n.addResourceBundle(lang, namespace, resources, true, true);
  }
}

/**
 * Returns a translator bound to the plugin's namespace and language. Plugin keys
 * are flat (e.g. `attr.str`), so key/namespace separators are disabled for the
 * lookup. A missing key returns the key itself (canonical fallback).
 */
export function getPluginT(pluginId: string, lang: string): (key: string) => string {
  const namespace = getPluginNamespace(pluginId);
  const fixedT = i18n.getFixedT(lang, namespace);
  return (key: string): string => String(fixedT(key, { keySeparator: false, nsSeparator: false }));
}
