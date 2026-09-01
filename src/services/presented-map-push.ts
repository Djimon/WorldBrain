// M10-#386: Host → player snapshot push of the presented map. Closes the
// gap that computeSnapshot existed but was never sent — without
// this push the DB-less player store would never get map + token set.
//
// The host builds a snapshot from the presented map (image URL) + its tokens (x/y)
// and sends it as a TransportMessage. Called when the DM
// presents a map and when the host transport is up (initial state).
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage } from './session-transport';
import { SYSTEM_TOKEN } from './session-transport';
import { computeSnapshot, type HostViewItem } from './host-push-service';
import { getPresentedMapId } from './presented-map-service';
import { getMap, getAssetUrl } from './map-service';
import { listLayers } from './map-layer-service';
import { listTokens } from './map-token-service';

/**
 * Builds + sends the snapshot of the currently presented map to the players.
 * With no presented map, an empty snapshot is sent (the player view
 * shows "no map presented"). `recipientPlayerId` optional — for a
 * targeted recipient; otherwise a broadcast marker.
 */
export async function pushPresentedMapSnapshot(params: {
  database: DatabaseLike;
  campaignId: string;
  transport: Pick<SessionTransport, 'send'>;
  recipientPlayerId?: string;
}): Promise<void> {
  const { database, campaignId, transport } = params;
  const entities: HostViewItem[] = [];

  const mapId = await getPresentedMapId(database, campaignId);
  if (mapId !== null) {
    const map = await getMap(database, mapId);
    // Image URL from the first image layer (the way MapViewer resolves it).
    const layers = await listLayers(database, mapId);
    const imageLayer = layers.find((l) => l.layer_type === 'image' && l.asset_id);
    const imageUrl = imageLayer?.asset_id ? getAssetUrl(imageLayer.asset_id) : '';
    entities.push({
      id: mapId,
      visibility: 'all',
      kind: 'map',
      data: { image_url: imageUrl, title: map?.title ?? '' },
    });
    // Tokens of the presented map (positions for the player view).
    const tokens = await listTokens(database, mapId, campaignId);
    for (const tk of tokens) {
      entities.push({ id: tk.id, visibility: 'all', kind: 'token', data: { x: tk.x, y: tk.y } });
    }
  }

  const snapshot = await computeSnapshot({
    entities,
    playerId: params.recipientPlayerId ?? 'all',
    groupIds: [],
    campaignId,
  });
  const msg: TransportMessage = {
    type: 'snapshot',
    token: SYSTEM_TOKEN,
    payload: snapshot as unknown as Record<string, unknown>,
  };
  void transport.send(msg).catch(() => { /* offline → discard */ });
}
