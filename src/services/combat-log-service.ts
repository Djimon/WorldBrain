// M10-S16 (#362): combat log — persistence + visibility routing (D17).
// An entry is either 'private' (roller only), 'dm_only' (roller +
// DM) or 'all' (all campaign members). listEntries filters host-side
// by the caller's role — the client filter is the second line of defense.
import type { DatabaseLike } from './entity-service';
import type { DiceVisibility } from './dice-roller-service';

export interface CombatLogEntry {
  id: string;
  campaign_id: string;
  actor_display: string;
  actor_player_id: string | null;
  text: string;
  visibility: DiceVisibility;
  created_at: string;
}

export interface PostEntryParams {
  campaignId: string;
  actorDisplay: string;
  actorPlayerId?: string;
  text: string;
  visibility?: DiceVisibility;
}

export async function postEntry(db: DatabaseLike, params: PostEntryParams): Promise<CombatLogEntry> {
  const id = `cl_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  const visibility = params.visibility ?? 'all';
  await db.execute(
    'INSERT INTO combat_log (id, campaign_id, actor_display, actor_player_id, text, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.campaignId, params.actorDisplay, params.actorPlayerId ?? null, params.text, visibility, created_at],
  );
  return {
    id, campaign_id: params.campaignId,
    actor_display: params.actorDisplay,
    actor_player_id: params.actorPlayerId ?? null,
    text: params.text, visibility, created_at,
  };
}

export interface ListEntriesParams {
  campaignId: string;
  role: 'dm' | 'player';
  playerId?: string;
  limit?: number;
}

export async function listEntries(db: DatabaseLike, params: ListEntriesParams): Promise<CombatLogEntry[]> {
  const all = await db.select<CombatLogEntry>(
    'SELECT id, campaign_id, actor_display, actor_player_id, text, visibility, created_at FROM combat_log WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?',
    [params.campaignId, params.limit ?? 200],
  );
  if (params.role === 'dm') {
    return all; // DM sieht alles inkl. private von anderen (D17-Aggregation)
  }
  const pid = params.playerId ?? '';
  return all.filter((e) => {
    if (e.visibility === 'all') return true;
    if (e.visibility === 'dm_only') return e.actor_player_id === pid; // roller sees their own roll
    // 'private' → roller only
    return e.actor_player_id === pid;
  });
}
