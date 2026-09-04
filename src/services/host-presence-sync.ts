// M10-S2 (#421): host-side presence feed for the DB-less player lobby.
//
// The player is DB-less (D29/D30) and therefore has no way to read the roster of
// connected players itself. The host — the sole ground truth — broadcasts the active
// roster (+ the session-live flag) over the transport as a dedicated `roster` message.
// The player lobby consumes it directly (NOT via the reset-on-snapshot client store,
// which map snapshots would wipe).
//
// Broadcast points (wired in WorkspaceShell): on session Start, after each join
// (onAfterJoin), and after a Kick. Host→player only, sent under SYSTEM_TOKEN.
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, RosterEntry } from './session-transport';
import { encodeRoster } from './session-transport';
import { listCampaignPlayers } from './player-membership-service';

interface PlayerNameRow { id: string; display_name: string }

/**
 * Reads the active roster from the host DB and broadcasts it (+ `live`) to all
 * connected players. `live` reflects whether the DM has opened the session (Start).
 */
export async function broadcastRoster(params: {
  transport: Pick<SessionTransport, 'send'>;
  database: DatabaseLike;
  campaignId: string;
  live: boolean;
}): Promise<void> {
  const { transport, database, campaignId, live } = params;
  const rows = await listCampaignPlayers(database, campaignId);
  const active = rows.filter((r) => r.status === 'active');

  let players: RosterEntry[] = [];
  if (active.length > 0) {
    const ids = active.map((r) => r.player_id);
    const placeholders = ids.map(() => '?').join(',');
    const names = await database.select<PlayerNameRow>(
      `SELECT id, display_name FROM players WHERE id IN (${placeholders})`,
      ids,
    );
    const nameById: Record<string, string> = {};
    for (const n of names) nameById[n.id] = n.display_name;
    players = active.map((r) => ({ playerId: r.player_id, displayName: nameById[r.player_id] ?? r.player_id }));
  }

  await transport.send(encodeRoster({ players, live }));
}
