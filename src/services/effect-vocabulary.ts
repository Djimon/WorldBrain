// M14-S08: Effekt-Vokabel & Target-Modell (normativ) (#263)
// The one shared definition of effect verbs + scope-aware target parsing for
// both EPIC-022 (world-state consequences) and M12-S07 (hook-engine.ts,
// #232) — no second vocabulary. M14-S14 (#269, blocked) later re-points
// hook-engine.ts's EffectDescriptor at this module.

export const EFFECT_VERBS = ['set', 'gain', 'spend', 'set_flag', 'clear'] as const;
export type EffectVerb = (typeof EFFECT_VERBS)[number];

export interface Effect {
  day: number;
  target: string;
  verb: EffectVerb;
  value?: unknown;
}

export type ParsedTarget =
  | { scope: 'world'; name: string }
  | { scope: 'entity'; id: string; field: 'status' };

/**
 * Parses a scope-aware target string. V1 supports `world:<var>` and
 * `entity:<entityId>#status`. `session:`/`char:` are reserved prefixes the
 * parser recognizes but rejects in V1 (Decision: reserved, not implemented).
 * Any other scope prefix is an unknown-scope error.
 */
export function parseTarget(target: string): ParsedTarget {
  const colonIdx = target.indexOf(':');
  if (colonIdx === -1) throw new Error(`Invalid target (missing scope prefix): ${target}`);
  const scope = target.slice(0, colonIdx);
  const rest = target.slice(colonIdx + 1);

  if (scope === 'world') return { scope: 'world', name: rest };

  if (scope === 'entity') {
    const hashIdx = rest.indexOf('#');
    if (hashIdx === -1) throw new Error(`Invalid entity target (missing #field): ${target}`);
    const id = rest.slice(0, hashIdx);
    const field = rest.slice(hashIdx + 1);
    if (field !== 'status') throw new Error(`Unsupported entity target field: ${field}`);
    return { scope: 'entity', id, field: 'status' };
  }

  if (scope === 'session' || scope === 'char') {
    throw new Error(`Target scope "${scope}:" is reserved for a later version — not supported in V1: ${target}`);
  }

  throw new Error(`Unknown target scope: ${scope}`);
}

/** Validates an effect's verb against the shared vocabulary — invalid verb is an error, never a silent no-op. */
export function validateEffectVerb(verb: string): asserts verb is EffectVerb {
  if (!(EFFECT_VERBS as readonly string[]).includes(verb)) {
    throw new Error(`Invalid effect verb: ${verb}`);
  }
}
