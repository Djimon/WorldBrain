import { evaluate } from './condition-engine';
import type { DatabaseLike } from './entity-service';

// M10-S07: campaign_id added (D23 — roster/overrides are campaign-scoped,
// not session-scoped). Additive to the previous 4 scopes (Decisions 5–7).
export interface VisibilityContext {
  audience?: 'gm' | 'player';
  vars?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  knownEntities?: Set<string>;
  campaign_id?: string;
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

export interface ResolveSessionVisibilityParams {
  campaignId: string;
  targetType: string;
  targetId: string;
  playerId: string;
  groupIds: string[];
}

/**
 * Campaign-scoped visibility (M10-S07, D23): a target is visible to a player
 * if an override releases it to them directly (player_id) or via one of their
 * groups (group_id). Default without an override = `gm_only` (Decision 5).
 * Additive to the previous 4 scopes.
 */
export async function resolveSessionVisibility(
  database: DatabaseLike,
  params: ResolveSessionVisibilityParams,
): Promise<SessionVisibilityResult> {
  const rows = await database.select<OverrideRow>(
    'SELECT player_id, group_id FROM session_visibility_overrides WHERE campaign_id = ? AND target_type = ? AND target_id = ?',
    [params.campaignId, params.targetType, params.targetId],
  );
  const groupIds = new Set(params.groupIds);
  const granted = rows.some(
    (row) =>
      (row.player_id != null && row.player_id === params.playerId) ||
      (row.group_id != null && groupIds.has(row.group_id)),
  );
  return granted ? 'visible' : 'gm_only';
}

export interface SetVisibilityOverrideParams {
  campaignId: string;
  targetType: string;
  targetId: string;
  scope: 'player' | 'group';
  playerId?: string;
  groupId?: string;
}

// M10-S09 (#358): Live-push hook. Consumers (play-cockpit, whiteboard, ...)
// register a listener; setVisibilityOverride / clearVisibilityOverride
// call it after the DB write. The concrete push wiring to a
// SessionTransport happens in the consumer — stage 3 (S11/S12) when a real
// remote client exists; today, with a local DB, a DB reload at the consumer is enough.
export interface VisibilityChange {
  kind: 'set' | 'clear';
  campaignId: string;
  targetType: string;
  targetId: string;
  playerId: string | null;
  groupId: string | null;
}
type VisibilityChangeListener = (change: VisibilityChange) => void;
const listeners = new Set<VisibilityChangeListener>();
export function onVisibilityChange(listener: VisibilityChangeListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function emitChange(change: VisibilityChange): void {
  for (const l of listeners) {
    try { l(change); } catch { /* fail-open: a listener that throws must not
                                  crash the editor */ }
  }
}

export async function setVisibilityOverride(
  database: DatabaseLike,
  params: SetVisibilityOverrideParams,
): Promise<void> {
  const id = `svo_${crypto.randomUUID()}`;
  await database.execute(
    'INSERT INTO session_visibility_overrides (id, campaign_id, target_type, target_id, scope, player_id, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.campaignId, params.targetType, params.targetId, params.scope, params.playerId ?? null, params.groupId ?? null],
  );
  emitChange({
    kind: 'set',
    campaignId: params.campaignId,
    targetType: params.targetType,
    targetId: params.targetId,
    playerId: params.playerId ?? null,
    groupId: params.groupId ?? null,
  });
}

export interface ClearVisibilityOverrideParams {
  campaignId: string;
  targetType: string;
  targetId: string;
  playerId?: string;
  groupId?: string;
}

export async function clearVisibilityOverride(
  database: DatabaseLike,
  params: ClearVisibilityOverrideParams,
): Promise<void> {
  await database.execute(
    'DELETE FROM session_visibility_overrides WHERE campaign_id = ? AND target_type = ? AND target_id = ? AND (player_id = ? OR group_id = ?)',
    [params.campaignId, params.targetType, params.targetId, params.playerId ?? null, params.groupId ?? null],
  );
  emitChange({
    kind: 'clear',
    campaignId: params.campaignId,
    targetType: params.targetType,
    targetId: params.targetId,
    playerId: params.playerId ?? null,
    groupId: params.groupId ?? null,
  });
}
