// M10-#386: Play-Cockpit-Map — ersetzt den Map-Tab-Stub durch die echte Karte
// und schließt den Token-Sync-Loop an.
//
// Zwei Pfade (D29-Membran):
// - DM/Host (database): Play-Map-Picker wählt die präsentierte Karte
//   (persistiert, presented-map-service), MapViewer rendert sie aus der DB;
//   jeder Token-Drag broadcastet via broadcastMovement über den Transport.
// - Player (store, DB-LOS): rendert die präsentierte Karte + Tokens
//   AUSSCHLIESSLICH aus dem transport-gespeisten play-client-store — kein
//   database-Prop. Eingehende Bewegungs-Deltas landen über applyMovementMessage
//   im Store und werden hier gerendert.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import type { SessionTransport } from '../services/session-transport';
import type { PlayClientStoreImpl } from '../services/play-client-store';
import { listMaps, type MapRow } from '../services/map-service';
import { getPresentedMapId, setPresentedMapId } from '../services/presented-map-service';
import { broadcastMovement } from '../services/token-movement-service';
import { sendMoveIntent } from '../services/host-token-sync';
import { MapViewer } from './MapViewer';
import { Button, ListSurface, Panel } from './primitives';

export interface PlayCockpitMapProps {
  role: 'dm' | 'player';
  campaignId: string;
  /** DM/Host-Pfad. Für Player NICHT gesetzt (Membran). */
  database?: DatabaseLike;
  /** Player-Pfad: transport-gespeister Store. */
  store?: PlayClientStoreImpl;
  /** Host-Transport (DM broadcastet) bzw. Player-Transport (Player schickt Intent). */
  transport?: Pick<SessionTransport, 'send'>;
  /** Player-Pfad: eigene Spieler-ID (Absender des Bewegungs-Intents). */
  playerId?: string;
}

interface StoreToken { id: string; x: number; y: number }

export function PlayCockpitMap({ role, campaignId, database, store, transport, playerId }: PlayCockpitMapProps) {
  const { t } = useTranslation('multiplayer');

  // ---- DM/Host-Pfad ------------------------------------------------------
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [presentedId, setPresentedId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'dm' || !database || campaignId === '') return;
    let cancelled = false;
    void Promise.all([listMaps(database), getPresentedMapId(database, campaignId)]).then(([ms, pid]) => {
      if (cancelled) return;
      setMaps(ms);
      setPresentedId(pid);
    });
    return () => { cancelled = true; };
  }, [role, database, campaignId]);

  async function present(mapId: string) {
    if (!database) return;
    await setPresentedMapId(database, { campaignId, mapId });
    setPresentedId(mapId);
  }

  // ---- Player-Pfad (DB-los) ---------------------------------------------
  const [, setStoreTick] = useState(0);
  useEffect(() => {
    if (role !== 'player' || !store) return;
    return store.subscribe(() => setStoreTick((n) => n + 1));
  }, [role, store]);

  if (role === 'player') {
    if (!store) return <Panel className="play-cockpit__pane"><p className="u-muted">{t('cockpit.offline', 'Host offline — noch keine Daten.')}</p></Panel>;
    const mapEntity = store.list('map')[0] ?? null;
    const imageUrl = mapEntity ? String((mapEntity.data as Record<string, unknown>).image_url ?? '') : '';
    const tokens: StoreToken[] = store.list('token').map((e) => ({
      id: e.id,
      x: Number((e.data as Record<string, unknown>).x ?? 0),
      y: Number((e.data as Record<string, unknown>).y ?? 0),
    }));
    return (
      <Panel className="play-cockpit__pane play-cockpit-map">
        {mapEntity === null ? (
          <p className="u-muted">{t('cockpit.mapNonePresented', 'Der DM präsentiert gerade keine Karte.')}</p>
        ) : (
          <div className="play-cockpit-map__stage">
            {imageUrl !== '' && <img className="play-cockpit-map__img" src={imageUrl} alt="" />}
            {tokens.map((tk) => (
              <div
                key={tk.id}
                className="play-cockpit-map__token play-cockpit-map__token--interactive"
                data-token-id={tk.id}
                data-x={tk.x} data-y={tk.y}
                style={{ transform: `translate(${tk.x}px, ${tk.y}px)` }}
                onPointerDown={(e) => {
                  // Host-autoritativ: der Player schreibt NICHT lokal, er schickt
                  // beim Loslassen einen Intent. Ground truth + Broadcast kommen
                  // vom Host zurück (memory: host-authoritative-token-sync).
                  const stage = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                  const startX = tk.x; const startY = tk.y;
                  const startClientX = e.clientX; const startClientY = e.clientY;
                  const onUp = (ev: PointerEvent) => {
                    window.removeEventListener('pointerup', onUp);
                    if (transport === undefined || playerId === undefined) return;
                    const nx = Math.round(startX + (ev.clientX - startClientX));
                    const ny = Math.round(startY + (ev.clientY - startClientY));
                    void stage; // Stage-Rect nur für spätere Clamping-Erweiterung
                    sendMoveIntent(transport, { campaignId, senderPlayerId: playerId, tokenId: tk.id, x: nx, y: ny });
                  };
                  window.addEventListener('pointerup', onUp);
                }}
              />
            ))}
          </div>
        )}
      </Panel>
    );
  }

  // ---- DM-Render ---------------------------------------------------------
  return (
    <div className="play-cockpit-map u-stack u-gap-2">
      <div className="play-cockpit-map__picker u-row u-gap-2" role="group"
        aria-label={t('cockpit.mapPicker', 'Karte präsentieren')}>
        <span className="u-muted">{t('cockpit.mapPicker', 'Karte präsentieren')}:</span>
        <ListSurface className="play-cockpit-map__picker-list">
          {maps.length === 0 && <li className="u-muted">{t('cockpit.noMaps', 'Keine Karten im Projekt.')}</li>}
          {maps.map((m) => (
            <li key={m.id}>
              <Button
                size="compact"
                tone={m.id === presentedId ? 'accent' : 'neutral'}
                variant={m.id === presentedId ? undefined : 'outline'}
                aria-pressed={m.id === presentedId}
                onClick={() => void present(m.id)}
              >
                {m.title}
              </Button>
            </li>
          ))}
        </ListSurface>
      </div>

      {presentedId !== null && database !== undefined ? (
        <MapViewer
          key={`play-mv-${presentedId}`}
          mapId={presentedId}
          sessionId={campaignId}
          database={database}
          onTokenMoved={(tokenId, x, y) => {
            // Token-Sync-Loop: Bewegung live an alle broadcasten (D18).
            if (transport) broadcastMovement({ campaignId, tokenId, x, y }, transport);
          }}
        />
      ) : (
        <Panel className="play-cockpit__pane">
          <p className="u-muted">{t('cockpit.pickMapHint', 'Wähle oben eine Karte, um sie den Spielern zu präsentieren.')}</p>
        </Panel>
      )}
    </div>
  );
}

export default PlayCockpitMap;
