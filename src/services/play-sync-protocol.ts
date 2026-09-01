// M10-D29 (#372): Sync contract between host (R2) and client (R3).
// Pure types — no logic, no DB access. Host and client bind their
// impl modules (play-host-broker, play-client-store) to THESE types; this keeps
// the membrane between the two sides stable.
//
// Deliberately NO DB import — the client knows no local persistence layer
// (D30 membrane). The host serializes its authoritative view into these
// messages and sends them through the transport.

/** Domain categories of the transmitted data (play-cockpit subset D15). */
export type SyncEntityKind =
  | 'entity'
  | 'map'
  | 'marker'
  | 'token'
  | 'calendar_event'
  | 'handout'
  | 'combat_log'
  | 'whiteboard_element'
  | 'session_time'
  | 'player_character';

/** A data object in the sync membrane — already filtered by the host
 *  (S07 visibility, S17 calendar gate); the payload is deliberately opaque. */
export interface SyncEntity {
  kind: SyncEntityKind;
  id: string;
  data: Record<string, unknown>;
}

/**
 * Snapshot: initial data set, host-filtered for ONE recipient.
 * Contains only what the player may see at the time of join/reconnect.
 */
export interface Snapshot {
  type: 'snapshot';
  campaignId: string;
  recipientPlayerId: string;
  serverTime: string;
  entities: SyncEntity[];
}

/**
 * Delta: incremental change (add/update/remove) of ONE released
 * object. `kind` describes the domain category; `op` the change.
 * Special types (token movement, combat-log entry, session-time advance,
 * whiteboard placement) are ordinary add/update deltas with the matching `kind`.
 */
export type DeltaOp = 'add' | 'update' | 'remove';

export interface Delta {
  type: 'delta';
  campaignId: string;
  op: DeltaOp;
  kind: SyncEntityKind;
  id: string;
  data?: Record<string, unknown>;
  serverTime: string;
}

/**
 * ClientAction: player→host intent (rolling dice, moving one's own token, editing
 * one's own sheet). The host is authoritative — it validates, executes and
 * responds with `Delta`s to the authorized recipients.
 */
export type ClientActionKind =
  | 'roll_dice'
  | 'move_own_token'
  | 'edit_own_sheet'
  | 'post_private_note'
  | 'whiteboard_place';

export interface ClientAction {
  type: 'client_action';
  actionKind: ClientActionKind;
  senderPlayerId: string;
  campaignId: string;
  payload: Record<string, unknown>;
  clientTime: string;
}

/** Every message in the membrane is exactly one of these three. */
export type SyncMessage = Snapshot | Delta | ClientAction;
