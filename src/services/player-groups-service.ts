// M10-S04: Stub — implement in RED→GREEN phase
import type { DatabaseLike } from './entity-service';

export interface PlayerGroup { id: string; session_id: string; name: string }

export async function createGroup(_: { database: DatabaseLike; sessionId: string; name: string }): Promise<PlayerGroup> { throw new Error('not implemented'); }
export async function renameGroup(_: { database: DatabaseLike; groupId: string; name: string }): Promise<void> { throw new Error('not implemented'); }
export async function deleteGroup(_: { database: DatabaseLike; groupId: string }): Promise<void> { throw new Error('not implemented'); }
export async function addMember(_: { database: DatabaseLike; groupId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }
export async function removeMember(_: { database: DatabaseLike; groupId: string; playerId: string }): Promise<void> { throw new Error('not implemented'); }
export async function listGroups(_: { database: DatabaseLike; sessionId: string }): Promise<PlayerGroup[]> { throw new Error('not implemented'); }
