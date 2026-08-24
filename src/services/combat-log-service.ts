// M10-S16 (#362): Kampflog — Persistenz + Sichtbarkeits-Routing (D17).
// Ein Eintrag ist entweder 'private' (nur der Werfer), 'dm_only' (Werfer +
// DM) oder 'all' (alle Campaign-Mitglieder). listEntries filtert host-seitig
// nach Rolle des Aufrufers — der Client-Filter ist die zweite Reihe.
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
    if (e.visibility === 'dm_only') return e.actor_player_id === pid; // Werfer sieht eigenen Wurf
    // 'private' → nur der Werfer
    return e.actor_player_id === pid;
  });
}
