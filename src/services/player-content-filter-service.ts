// M10-S09 (#358): Spieler-Live-Sicht — host-seitige Content-Filterung (D15/D20,
// Decision 8). Der Client filtert NIE selbst; jede ID läuft hier durch
// resolveSessionVisibility (S07) — nur was 'visible' zurückgibt verlässt den
// Host. Nicht-freigegebene IDs (default gm_only) tauchen im Ergebnis nicht auf.
//
// Live-Push: wird von der Consumer-Schicht (Play-Cockpit S14, Whiteboard S15,
// Kalender-Gate S17) über den WebRTC-Transport (S01) getrieben; dieser Service
// stellt die Filter-Primitive bereit. Der DM triggert eine Freigabe via
// visibility-service.setVisibilityOverride — die Push-Seite hört auf DB-Änderung
// bzw. wird von der Feature-Story aufgerufen (kein globales Event-Bus hier).
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
 * Kern-Primitive: reduziert die IDs auf die für den Spieler freigegebenen.
 * Nicht-freigegebene (default gm_only) fallen raus — sie verlassen den Host
 * nie in Richtung Client.
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

// Convenience-Wrapper pro Content-Kategorie aus D15 — gleiche Semantik, andere
// targetType-Konstante. Ergänzt bei Bedarf pro Feature (S15 Whiteboard, S17
// Kalender-Events, etc.); die Content-Kategorien 'authoring' / 'graph' /
// 'soundboard' sind explizit AUS — DM-only, nie im Player-View.

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
 * M10-S17 (#363, D16): Kalender-Events für den Spieler filtern — ZWEISTUFIG:
 * 1. Sichtbarkeit (S07/Decision 8, wie alle anderen Kategorien).
 * 2. **Session-Zeit-Gate**: Events mit start_day > „Session-Jetzt" verlassen
 *    den Host NIE (Zukunft nie ausgeliefert). Der Client filtert nie selbst.
 * Reihenfolge egal (beide Filter sind Schnitte); wir gaten zuerst über die
 * Zeit (billig, ohne DB-Roundtrip pro ID) und danach über die Sichtbarkeit.
 */
export async function filterEventsForPlayer<T extends { id: string; start_day: number }>(
  params: {
    database: DatabaseLike;
    campaignId: string;
    context: PlayerFilterContext;
    events: T[];
  },
): Promise<T[]> {
  // 1. Zeit-Gate: nur Events <= Session-Jetzt.
  const inTime = await filterEventsBySessionNow(params.database, {
    campaignId: params.campaignId,
    events: params.events,
  });
  // 2. Sichtbarkeits-Gate über die verbleibenden IDs.
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
 * S09-AC „Live-Push der Freigaben über den Transport (S01)": jede
 * setVisibilityOverride/clearVisibilityOverride-Änderung wird als
 * TransportMessage über den übergebenen SessionTransport gepusht. Der
 * Empfänger-Client entscheidet dann, welche Sicht zu invalidieren ist
 * (Reload / rerender). Systemweit-Token für DM-Broadcasts: 'system-dm'.
 * Der Rückgabewert ist die Unregister-Funktion.
 */
export function attachVisibilityBroadcaster(
  transport: SessionTransport,
  systemToken = 'system-dm',
): () => void {
  const unsub = onVisibilityChange((change: VisibilityChange) => {
    // Fire-and-forget; wenn der Transport gerade offline ist, verwerfen wir.
    void transport.send({
      type: 'visibility_change',
      token: systemToken,
      payload: change as unknown as Record<string, unknown>,
    }).catch(() => {});
  });
  return unsub;
}
