// M10-S3 (#422, D17/D30): combat-log sync path host↔player.
//
// The DB-less player (D30) has no combat log of its own. Truth lives in the host DB.
//   - Player rolls (visibility all|dm_only) → `roll_dice` ClientAction over the transport
//     (result computed client-side; dice are a social-contract trust like token moves).
//     'private' NEVER leaves the client (executed purely locally) — the host never sees it.
//   - Host validates the sender is an active member, persists via postEntry (ground truth),
//     and broadcasts ONLY 'all'-visibility entries as `combat_log` add-deltas. dm_only /
//     private are NOT broadcast (a WebRTC send reaches every peer → broadcasting them would
//     leak). The DM sees dm_only in its own log via the DB (marked "nur DM"); the rolling
//     player sees its own dm_only/private via an optimistic local echo in the view.
//   - On join (replayCombatLog) the host re-broadcasts the recent 'all' entries so the
//     joining player gets the history AND it survives the join snapshot's store reset.
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage } from './session-transport';
import { SYSTEM_TOKEN } from './session-transport';
import type { ClientAction } from './play-sync-protocol';
import { postEntry, listEntries, type CombatLogEntry } from './combat-log-service';
import type { DiceVisibility } from './dice-roller-service';

/** A validated roll_dice intent (decoded from the untrusted wire payload). */
export interface DecodedRollIntent {
  senderPlayerId: string;
  actorDisplay: string;
  text: string;
  visibility: DiceVisibility;
}

/**
 * Decode + validate an incoming `client_action` payload as a roll_dice intent — the ONE
 * place the wire shape is asserted (mirrors decodeRoster; no scattered casts). Returns
 * null for anything that is not a well-formed roll_dice intent (caller ignores it).
 */
export function decodeRollIntent(payload: Record<string, unknown>): DecodedRollIntent | null {
  if (payload.actionKind !== 'roll_dice') return null;
  const senderPlayerId = payload.senderPlayerId;
  if (typeof senderPlayerId !== 'string' || senderPlayerId === '') return null;
  const inner = payload.payload;
  if (inner === null || typeof inner !== 'object') return null;
  const p = inner as Record<string, unknown>;
  if (typeof p.text !== 'string') return null;
  // 'private' never travels the wire (local-only) → only all|dm_only are honoured.
  const visibility: DiceVisibility = p.visibility === 'dm_only' ? 'dm_only' : 'all';
  return {
    senderPlayerId,
    actorDisplay: typeof p.actorDisplay === 'string' ? p.actorDisplay : '',
    text: p.text,
    visibility,
  };
}

/** Player → host: a dice-roll intent (visibility all|dm_only only; 'private' stays local). */
export function sendRollIntent(
  transport: Pick<SessionTransport, 'send'>,
  params: { campaignId: string; senderPlayerId: string; actorDisplay: string; text: string; visibility: DiceVisibility; token?: string },
): void {
  const action: ClientAction = {
    type: 'client_action',
    actionKind: 'roll_dice',
    senderPlayerId: params.senderPlayerId,
    campaignId: params.campaignId,
    payload: { actorDisplay: params.actorDisplay, text: params.text, visibility: params.visibility },
    clientTime: new Date().toISOString(),
  };
  const payload: Record<string, unknown> = {
    type: action.type, actionKind: action.actionKind, senderPlayerId: action.senderPlayerId,
    campaignId: action.campaignId, payload: action.payload, clientTime: action.clientTime,
  };
  void transport.send({ type: 'client_action', token: params.token ?? params.senderPlayerId, payload }).catch(() => { /* fire-and-forget */ });
}

/** Broadcast ONE 'all'-visibility entry as a `combat_log` add-delta (leak-safe: only 'all'). */
export function broadcastCombatEntry(transport: Pick<SessionTransport, 'send'>, entry: CombatLogEntry): void {
  if (entry.visibility !== 'all') return;
  // Matches the Delta wire shape (play-sync-protocol) — built as a plain record (no cast).
  const payload: Record<string, unknown> = {
    type: 'delta', campaignId: entry.campaign_id, op: 'add', kind: 'combat_log', id: entry.id,
    data: {
      actor_display: entry.actor_display, actor_player_id: entry.actor_player_id,
      text: entry.text, visibility: entry.visibility, created_at: entry.created_at,
    },
    serverTime: entry.created_at,
  };
  void transport.send({ type: 'delta', token: SYSTEM_TOKEN, payload }).catch(() => { /* offline → discard */ });
}

/**
 * Host side: receive `roll_dice` intents, authorize, persist, broadcast (if 'all').
 * `onPersisted` fires after a player roll is written so the DM's DB-backed log view can
 * reload live (the host does not receive its own broadcast).
 */
export function attachHostCombatSync(params: {
  transport: Pick<SessionTransport, 'onMessage' | 'send'>;
  database: DatabaseLike;
  campaignId: string;
  onPersisted?: () => void;
}): void {
  const { transport, database, campaignId, onPersisted } = params;
  transport.onMessage((msg: TransportMessage) => {
    if (msg.type !== 'client_action') return;
    const intent = decodeRollIntent(msg.payload);
    if (intent === null) return;
    // .catch: a DB error while authorizing/persisting must not become an unhandled rejection.
    void handleRollIntent(database, campaignId, transport, intent, onPersisted)
      .catch(() => { /* authorize/persist failed → no write, no broadcast */ });
  });
}

async function handleRollIntent(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  intent: DecodedRollIntent,
  onPersisted?: () => void,
): Promise<void> {
  // Host determines membership ITSELF (no trust in client-provided status).
  const rows = await database.select<{ status: string }>(
    'SELECT status FROM session_players WHERE campaign_id = ? AND player_id = ?',
    [campaignId, intent.senderPlayerId],
  );
  if ((rows[0]?.status ?? '') !== 'active') return; // kicked/unknown → no write, no broadcast
  const entry = await postEntry(database, {
    campaignId, actorDisplay: intent.actorDisplay,
    actorPlayerId: intent.senderPlayerId, text: intent.text, visibility: intent.visibility,
  });
  broadcastCombatEntry(transport, entry); // 'all' → players; dm_only/private stay off the wire
  onPersisted?.(); // DM's DB view reloads (sees the player's roll, incl. dm_only "nur DM")
}

/**
 * Replays the recent 'all' combat-log entries as add-deltas to the players. Called after
 * the join/reconnect snapshot so the joining player gets the history — and so the log
 * survives the snapshot's store reset (applySnapshot clears the entity map).
 */
export async function replayCombatLog(params: {
  transport: Pick<SessionTransport, 'send'>;
  database: DatabaseLike;
  campaignId: string;
}): Promise<void> {
  const { transport, database, campaignId } = params;
  // role:'player' + empty playerId → only 'all'-visibility entries (leak-safe).
  const entries = await listEntries(database, { campaignId, role: 'player', playerId: '' });
  // listEntries returns newest-first; replay oldest-first so store order matches.
  for (const entry of [...entries].reverse()) broadcastCombatEntry(transport, entry);
}
