// M10-S09: Stub — implement in RED→GREEN phase
import type { DatabaseLike } from './entity-service';
// visibility-service integration will be wired here
import {} from './visibility-service';

export type PlayerFilterContext = { session_id: string; player_id: string; group_ids: string[] };

export type VisibilityChangedCallback = (sessionId: string, targetType: string, targetId: string) => void;
export const onVisibilityChanged: VisibilityChangedCallback | null = null;

export async function filterEntitiesForPlayer(_: { database: DatabaseLike; sessionId: string; entityIds: string[]; context: PlayerFilterContext }): Promise<string[]> { throw new Error('not implemented'); }
export async function filterImagesForPlayer(_: { database: DatabaseLike; sessionId: string; imageIds: string[]; context: PlayerFilterContext }): Promise<string[]> { throw new Error('not implemented'); }
