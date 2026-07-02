// M9-S01: System-Plugin Manifest-Erweiterung (EPIC-014)
// Validates system-plugin manifests: a plugin may declare `system: true`, which
// requires a `mechanics` block. Only one system plugin may be active per session
// (chosen at session creation, see M8-S01 / session-service).

export interface PluginMechanics {
  attributes: string[];
  resource_types: string[];
  distance_units: string[];
  challenge_metric: string;
}

export interface SystemPluginManifest {
  id: string;
  name: string;
  version: string;
  system?: boolean;
  mechanics?: PluginMechanics;
  entity_types?: unknown[];
  [key: string]: unknown;
}

export interface ManifestValidationResult {
  valid: boolean;
  manifest?: SystemPluginManifest;
  errors?: string[];
}

export function validatePluginManifest(input: object): ManifestValidationResult {
  const m = input as Record<string, unknown>;
  const errors: string[] = [];

  if (!m.id) errors.push('Missing required field: id');
  if (!m.name) errors.push('Missing required field: name');
  if (!m.version) errors.push('Missing required field: version');

  if (m.system === true) {
    const mechanics = m.mechanics as Record<string, unknown> | undefined;
    if (!mechanics || typeof mechanics !== 'object') {
      errors.push('System plugin requires a "mechanics" block');
    } else {
      if (!Array.isArray(mechanics.attributes)) errors.push('mechanics.attributes must be a non-empty array');
      if (!Array.isArray(mechanics.resource_types)) errors.push('mechanics.resource_types must be an array');
      if (!Array.isArray(mechanics.distance_units)) errors.push('mechanics.distance_units must be an array');
      if (!mechanics.challenge_metric) errors.push('mechanics.challenge_metric is required');
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, manifest: m as SystemPluginManifest };
}

/**
 * Enforces the "one system plugin per session" constraint: a session may
 * activate a system plugin only when none is active yet, or when re-selecting
 * the same one. Switching systems requires a new session (EPIC-014 decision 3).
 */
export function canActivateSystemPlugin(params: {
  currentSystemPluginId: string | null;
  candidateId: string;
}): boolean {
  return params.currentSystemPluginId === null || params.currentSystemPluginId === params.candidateId;
}
