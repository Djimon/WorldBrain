// M10-S09: Player Live View — server-side content filtering (EPIC-016)
// Filters entity/image ids down to what a player is allowed to see, resolved
// server-side via visibility-service (session_visibility_overrides). Content
// with no matching override never leaves this filter (no client-side hiding).
import type { DatabaseLike } from './entity-service';
import { resolveSessionVisibility } from './visibility-service';
import type { VisibilityContext } from './visibility-service';

export type PlayerFilterContext = { session_id: string; player_id: string; group_ids: string[] };

export type VisibilityChangedCallback = (sessionId: string, targetType: string, targetId: string) => void;
export const onVisibilityChanged: VisibilityChangedCallback | null = null;

async function filterIdsForPlayer(params: {
  database: DatabaseLike;
  sessionId: string;
  targetType: string;
  ids: string[];
  context: PlayerFilterContext;
}): Promise<string[]> {
  const visContext: VisibilityContext = {
    session_id: params.context.session_id,
    player_id: params.context.player_id,
    group_ids: params.context.group_ids,
  };
  const results = await Promise.all(
    params.ids.map(async (id) => {
      const result = await resolveSessionVisibility({
        database: params.database,
        sessionId: params.sessionId,
        targetType: params.targetType,
        targetId: id,
        context: visContext,
      });
      return result === 'visible' ? id : null;
    }),
  );
  return results.filter((id): id is string => id !== null);
}

export async function filterEntitiesForPlayer(params: {
  database: DatabaseLike;
  sessionId: string;
  entityIds: string[];
  context: PlayerFilterContext;
}): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'entity', ids: params.entityIds });
}

export async function filterImagesForPlayer(params: {
  database: DatabaseLike;
  sessionId: string;
  imageIds: string[];
  context: PlayerFilterContext;
}): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'image', ids: params.imageIds });
}
