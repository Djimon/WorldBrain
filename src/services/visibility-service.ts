import { evaluate } from './condition-engine';

export interface VisibilityContext {
  audience: 'gm' | 'player';
  vars?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  knownEntities?: Set<string>;
}

export interface VisibilityItem {
  visibility: string;
  entityId?: string;
  condition?: unknown;
}

export type VisibilityResult = 'visible' | 'hidden' | 'gm_only';

export function resolveVisibility(item: VisibilityItem, ctx: VisibilityContext): VisibilityResult {
  const v = item.visibility;

  if (v === 'public') return 'visible';

  if (v === 'gm_only') {
    return ctx.audience === 'gm' ? 'gm_only' : 'hidden';
  }

  if (v === 'player_known') {
    if (ctx.audience === 'gm') return 'visible';
    return item.entityId && ctx.knownEntities?.has(item.entityId) ? 'visible' : 'hidden';
  }

  if (v === 'hidden_until_condition') {
    if (ctx.audience === 'gm') return 'gm_only';
    if (!item.condition) return 'hidden';
    const evalCtx = {
      vars: ctx.vars ?? {},
      globals: ctx.globals ?? {},
      flags: ctx.flags ?? {},
    };
    return evaluate(item.condition, evalCtx) ? 'visible' : 'hidden';
  }

  return 'visible';
}
