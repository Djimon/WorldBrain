// M10-#386: Host → Player Snapshot-Push der präsentierten Karte. Schließt die
// Lücke, dass computeSnapshot zwar existierte, aber nie gesendet wurde — ohne
// diesen Push bekäme der DB-lose Player-Store nie Karte + Token-Set.
//
// Der Host baut aus der präsentierten Karte (Bild-URL) + ihren Tokens (x/y)
// einen Snapshot und schickt ihn als TransportMessage. Aufgerufen wenn der DM
// eine Karte präsentiert und wenn der Host-Transport steht (initialer Zustand).
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage } from './session-transport';
import { computeSnapshot, type HostViewItem } from './host-push-service';
import { getPresentedMapId } from './presented-map-service';
import { getMap, getAssetUrl } from './map-service';
import { listLayers } from './map-layer-service';
import { listTokens } from './map-token-service';

const SYSTEM_TOKEN = 'system-dm';

/**
 * Baut + sendet den Snapshot der aktuell präsentierten Karte an die Spieler.
 * Ohne präsentierte Karte wird ein leerer Snapshot gesendet (Player-Sicht
 * zeigt „keine Karte präsentiert"). `recipientPlayerId` optional — für einen
 * gezielten Empfänger; sonst Broadcast-Marker.
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
    // Bild-URL aus dem ersten Image-Layer (wie MapViewer sie auflöst).
    const layers = await listLayers(database, mapId);
    const imageLayer = layers.find((l) => l.layer_type === 'image' && l.asset_id);
    const imageUrl = imageLayer?.asset_id ? getAssetUrl(imageLayer.asset_id) : '';
    entities.push({
      id: mapId,
      visibility: 'all',
      kind: 'map',
      data: { image_url: imageUrl, title: map?.title ?? '' },
    });
    // Tokens der präsentierten Karte (Positionen für die Player-Sicht).
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
  void transport.send(msg).catch(() => { /* offline → verwerfen */ });
}
