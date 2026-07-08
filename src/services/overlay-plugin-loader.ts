// M13-S02: House-Rule-Modul als Overlay-Plugin (#237)
// Reuses the existing M6 plugin-loader (scanPlugins already parses arbitrary
// plugin.json shapes) — no new load path (Decision 2). An overlay manifest
// declares `overlays: <system_id>` plus override entries, validated against
// that base system's declaration registry.
import { validateOverrideTargets, type OverrideEntry } from './override-entry';

export interface OverlayManifest {
  id: string;
  overlays: string;
  type?: 'overlay';
  overrides?: OverrideEntry[];
}

/**
 * Validates an overlay manifest: it must declare `overlays` (the base
 * system id), and every override entry's target ID must exist in that
 * system's declaration registry (except `add` entries) — Decision 6, no
 * silent no-op on drift.
 */
export function validateOverlayManifest(
  manifest: OverlayManifest,
): { valid: boolean; errors?: string[] } {
  if (!manifest.overlays) {
    return { valid: false, errors: ['Missing required field: overlays (base system id)'] };
  }

  const errors = validateOverrideTargets(manifest.overrides ?? [], manifest.overlays);
  if (errors.length > 0) return { valid: false, errors };

  return { valid: true };
}
