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

interface OverrideRow {
  player_id: string | null;
  group_id: string | null;
}

/**
 * Session-scoped visibility: a target is visible to a player if an override
 * grants it directly (player_id) or via one of the player's groups
 * (group_id). Default without any override is gm_only (EPIC-016 M10-S07).
 */
export async function resolveSessionVisibility(args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  context: VisibilityContext;
}): Promise<SessionVisibilityResult> {
  const rows = await args.database.select<OverrideRow>(
    'SELECT player_id, group_id FROM session_visibility_overrides WHERE session_id = ? AND target_type = ? AND target_id = ?',
    [args.sessionId, args.targetType, args.targetId],
  );
  const groupIds = new Set(args.context.group_ids ?? []);
  const granted = rows.some(
    (row) =>
      (row.player_id != null && row.player_id === args.context.player_id) ||
      (row.group_id != null && groupIds.has(row.group_id)),
  );
  return granted ? 'visible' : 'gm_only';
}

export async function setVisibilityOverride(args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  scope: 'player' | 'group';
  playerId?: string;
  groupId?: string;
}): Promise<void> {
  await args.database.execute(
    'INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id) VALUES (?, ?, ?, ?, ?, ?)',
    [args.sessionId, args.targetType, args.targetId, args.scope, args.playerId ?? null, args.groupId ?? null],
  );
}

export async function clearVisibilityOverride(args: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  targetId: string;
  playerId?: string;
  groupId?: string;
}): Promise<void> {
  await args.database.execute(
    'DELETE FROM session_visibility_overrides WHERE session_id = ? AND target_type = ? AND target_id = ? AND (player_id = ? OR group_id = ?)',
    [args.sessionId, args.targetType, args.targetId, args.playerId ?? null, args.groupId ?? null],
  );
}
