import { evaluate } from './condition-engine';
import type { DatabaseLike } from './entity-service';

export interface VisibilityContext {
  audience?: 'gm' | 'player';
  vars?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  knownEntities?: Set<string>;
  session_id?: string;
  player_id?: string;
  group_ids?: string[];
}

export interface VisibilityItem {
  visibility: string;
  entityId?: string;
  condition?: unknown;
}

export type VisibilityResult = 'visible' | 'hidden' | 'gm_only' | 'gm_conditional';

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
    if (ctx.audience === 'gm') {
      if (!item.condition) return 'gm_conditional';
      const evalCtx = { vars: ctx.vars ?? {}, globals: ctx.globals ?? {}, flags: ctx.flags ?? {} };
      return evaluate(item.condition, evalCtx) ? 'visible' : 'gm_conditional';
    }
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

export type SessionVisibilityResult = 'gm_only' | 'visible';

export async function resolveSessionVisibility(_args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  context: VisibilityContext;
}): Promise<SessionVisibilityResult> {
  throw new Error('not implemented');
}

export async function setVisibilityOverride(_args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  scope: 'player' | 'group';
  playerId?: string;
  groupId?: string;
}): Promise<void> {
  throw new Error('not implemented');
}

export async function clearVisibilityOverride(_args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  playerId?: string;
  groupId?: string;
}): Promise<void> {
  throw new Error('not implemented');
}
