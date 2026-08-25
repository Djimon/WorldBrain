// M13-S08 (#243): Loader für House-Rule-Overlay-Plugins.
// Validiert Manifest-Format (kind='overlay', overlays=<base_system_id>,
// overrides: Array von {target, op, value}). Ziel-ID-Existenz-Check läuft
// separat im overlay-conflict-service (validateModuleTargets) — das braucht
// die Base-System-Registry.

export interface OverlayManifest {
  id: string;
  name: string;
  kind: 'overlay';
  overlays: string;
  description?: string;
  overrides: readonly {
    target: string;
    op: 'patch' | 'replace' | 'remove';
    value: unknown;
  }[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOverlayManifest(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Manifest muss ein Objekt sein.'] };
  }
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || m.id === '') errors.push('id fehlt oder ist leer');
  if (typeof m.name !== 'string' || m.name === '') errors.push('name fehlt oder ist leer');
  if (m.kind !== 'overlay') errors.push("kind muss 'overlay' sein");
  if (typeof m.overlays !== 'string' || m.overlays === '') errors.push('overlays fehlt (Basis-System-ID)');
  if (!Array.isArray(m.overrides)) {
    errors.push('overrides muss ein Array sein');
  } else {
    for (let i = 0; i < m.overrides.length; i += 1) {
      const e = m.overrides[i] as Record<string, unknown> | null;
      if (e === null || typeof e !== 'object') { errors.push(`overrides[${i}]: kein Objekt`); continue; }
      if (typeof e.target !== 'string' || e.target === '') errors.push(`overrides[${i}].target fehlt`);
      if (e.op !== 'patch' && e.op !== 'replace' && e.op !== 'remove') {
        errors.push(`overrides[${i}].op muss patch|replace|remove sein`);
      }
      if (!('value' in e)) errors.push(`overrides[${i}].value fehlt`);
    }
  }
  return { valid: errors.length === 0, errors };
}
