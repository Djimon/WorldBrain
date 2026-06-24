export type VisibilityResult = 'visible' | 'gm_only' | 'hidden';

export interface VisibilityContext {
  role: 'gm' | 'player';
  knownEntities: string[];
  sessionVars: Record<string, unknown>;
  globalVars: Record<string, unknown>;
}

export interface MarkerLike {
  visibility: string;
  entity_id?: string | null;
  condition?: unknown;
}

function evaluateJsonLogic(logic: unknown, data: Record<string, unknown>): unknown {
  if (logic === null || typeof logic !== 'object') return logic;
  const obj = logic as Record<string, unknown>;
  const op = Object.keys(obj)[0];
  const args = obj[op] as unknown[];

  if (op === '==') {
    const argArr = Array.isArray(args) ? args : [args];
    const a = evaluateJsonLogic(argArr[0], data);
    const b = evaluateJsonLogic(argArr[1], data);
    return a === b;
  }
  if (op === 'var') {
    const varPath = Array.isArray(args) ? String(args[0]) : String(args);
    const path = varPath.split('.');
    let cur: unknown = data;
    for (const key of path) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  }
  return null;
}

export function resolveMarkerVisibility(marker: MarkerLike, ctx: VisibilityContext): VisibilityResult {
  const v = marker.visibility;

  if (v === 'public') return 'visible';

  if (v === 'gm_only') {
    return ctx.role === 'gm' ? 'gm_only' : 'hidden';
  }

  if (v === 'player_known') {
    if (ctx.role === 'gm') return 'visible';
    if (marker.entity_id && ctx.knownEntities.includes(marker.entity_id)) return 'visible';
    return 'hidden';
  }

  if (v === 'hidden_until_condition') {
    if (ctx.role === 'gm') return 'visible';
    if (!marker.condition) return 'hidden';
    const data = { vars: { ...ctx.sessionVars } };
    const result = evaluateJsonLogic(marker.condition, data);
    return result === true ? 'visible' : 'hidden';
  }

  return 'visible';
}

export function filterMarkersForContext(markers: MarkerLike[], ctx: VisibilityContext): MarkerLike[] {
  return markers.filter(m => resolveMarkerVisibility(m, ctx) !== 'hidden');
}
