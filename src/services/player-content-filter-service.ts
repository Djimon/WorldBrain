// M10-S09 (#358): Player live view — host-side content filtering (D15/D20,
// Decision 8). The client NEVER filters itself; every ID runs here through
// resolveSessionVisibility (S07) — only what returns 'visible' leaves the
// host. Non-released IDs (default gm_only) do not appear in the result.
//
// Live push: driven by the consumer layer (play-cockpit S14, whiteboard S15,
// calendar gate S17) over the WebRTC transport (S01); this service
// provides the filter primitives. The DM triggers a release via
// visibility-service.setVisibilityOverride — the push side listens for a DB change
// or is called by the feature story (no global event bus here).
import type { DatabaseLike } from './entity-service';
import { onVisibilityChange, resolveSessionVisibility, type VisibilityChange } from './visibility-service';
import { filterEventsBySessionNow } from './session-time-service';
import type { SessionTransport } from './session-transport';

export interface PlayerFilterContext {
  campaign_id: string;
  player_id: string;
  group_ids: string[];
}

export interface FilterIdsParams {
  database: DatabaseLike;
  campaignId: string;
  targetType: string;
  ids: string[];
  context: PlayerFilterContext;
}

/**
 * Core primitive: reduces the IDs to those released for the player.
 * Non-released ones (default gm_only) drop out — they never leave the host
 * toward the client.
 */
export async function filterIdsForPlayer(params: FilterIdsParams): Promise<string[]> {
  const results = await Promise.all(
    params.ids.map(async (id) => {
      const result = await resolveSessionVisibility(params.database, {
        campaignId: params.campaignId,
        targetType: params.targetType,
        targetId: id,
        playerId: params.context.player_id,
        groupIds: params.context.group_ids,
      });
      return result === 'visible' ? id : null;
    }),
  );
  return results.filter((id): id is string => id !== null);
}

// Convenience wrapper per content category from D15 — same semantics, different
// targetType constant. Extend as needed per feature (S15 whiteboard, S17
// calendar events, etc.); the content categories 'authoring' / 'graph' /
// 'soundboard' are explicitly OFF — DM-only, never in the player view.

export async function filterEntitiesForPlayer(params: Omit<FilterIdsParams, 'targetType'>): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'entity' });
}

export async function filterImagesForPlayer(params: Omit<FilterIdsParams, 'targetType'>): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'image' });
}

export async function filterMarkersForPlayer(params: Omit<FilterIdsParams, 'targetType'>): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'marker' });
}

export async function filterHandoutsForPlayer(params: Omit<FilterIdsParams, 'targetType'>): Promise<string[]> {
  return filterIdsForPlayer({ ...params, targetType: 'handout' });
}

/**
 * M10-S17 (#363, D16): Filter calendar events for the player — TWO-STAGE:
 * 1. Visibility (S07/Decision 8, like all other categories).
 * 2. **Session-time gate**: events with start_day > "session now" NEVER
 *    leave the host (the future is never delivered). The client never filters itself.
 * Order does not matter (both filters are intersections); we gate first by
 * time (cheap, no DB round-trip per ID) and then by visibility.
 */
export async function filterEventsForPlayer<T extends { id: string; start_day: number }>(
  params: {
    database: DatabaseLike;
    campaignId: string;
    context: PlayerFilterContext;
    events: T[];
  },
): Promise<T[]> {
  // 1. Time gate: only events <= session now.
  const inTime = await filterEventsBySessionNow(params.database, {
    campaignId: params.campaignId,
    events: params.events,
  });
  // 2. Visibility gate over the remaining IDs.
  const visibleIds = new Set(
    await filterIdsForPlayer({
      database: params.database,
      campaignId: params.campaignId,
      targetType: 'event',
      ids: inTime.map((e) => e.id),
      context: params.context,
    }),
  );
  return inTime.filter((e) => visibleIds.has(e.id));
}

/**
 * S09-AC "live push of releases over the transport (S01)": every
 * setVisibilityOverride/clearVisibilityOverride change is pushed as a
 * TransportMessage over the given SessionTransport. The
 * receiving client then decides which view to invalidate
 * (reload / rerender). System-wide token for DM broadcasts: 'system-dm'.
 * The return value is the unregister function.
 */
export function attachVisibilityBroadcaster(
  transport: SessionTransport,
  systemToken = 'system-dm',
): () => void {
  const unsub = onVisibilityChange((change: VisibilityChange) => {
    // Fire-and-forget; if the transport is currently offline, we discard.
    void transport.send({
      type: 'visibility_change',
      token: systemToken,
      payload: change as unknown as Record<string, unknown>,
    }).catch(() => {});
  });
  return unsub;
}
