// M10-#386: active "presented map" of the play cockpit. In play mode the DM
// deliberately picks a map for the players to see — campaign-scoped +
// persisted, deliberately separate from the edit-mode `selectedMapId`. The ID (+ the
// tokens) are pushed by the host to the players over the transport.
import type { DatabaseLike } from './entity-service';

/**
 * Reads the currently presented map ID of a campaign (or null).
 */
export async function getPresentedMapId(db: DatabaseLike, campaignId: string): Promise<string | null> {
  const rows = await db.select<{ active_map_id: string | null }>(
    'SELECT active_map_id FROM campaigns WHERE id = ?',
    [campaignId],
  );
  return rows[0]?.active_map_id ?? null;
}

/**
 * Sets the presented map (persisted, survives reload/menu switch).
 * `null` = no map presented.
 */
export async function setPresentedMapId(
  db: DatabaseLike,
  params: { campaignId: string; mapId: string | null },
): Promise<void> {
  await db.execute(
    'UPDATE campaigns SET active_map_id = ? WHERE id = ?',
    [params.mapId, params.campaignId],
  );
}
