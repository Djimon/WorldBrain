// M10-S03: Stub — implement in RED→GREEN phase
import type { DatabaseLike } from './entity-service';

export interface Player { id: string; display_name: string; created_at: string }
export interface SessionPlayer { session_id: string; player_id: string; token_hash: string; invite_status: string; joined_at: string | null }

export async function createPlayer(_: { database: DatabaseLike; displayName: string }): Promise<Player> { throw new Error('not implemented'); }
export async function requestJoin(_: { database: DatabaseLike; sessionId: string; playerId: string; tokenHash: string }): Promise<void> { throw new Error('not implemented'); }
export async function approve(_: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }
export async function reject(_: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }
export async function kick(_: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }
export async function listSessionPlayers(_: { database: DatabaseLike; sessionId: string }): Promise<SessionPlayer[]> { throw new Error('not implemented'); }
