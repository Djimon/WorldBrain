// M10-S14 (#360) + #374: Play-Cockpit — Reiter Map/Kampflog/Spotlight +
// Free-Browse. Role kommt aus AppModeContext (dm|player). Für den DM sitzt
// LobbyPanel oben als permanentes Kontroll-Element.
//
// Datenherkunft (D30-Membran, #374):
// - DM: liest per `database`-Prop direkt aus der Host-DB (Kampflog, Free-
//   Browse, Lobby-Roster).
// - Player: liest AUSSCHLIESSLICH aus dem transport-gespeisten `store` (kein
//   lokaler DB-Zugriff). Der Store bekommt Snapshot/Delta vom Host.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { onVisibilityChange } from '../services/visibility-service';
import { LobbyPanel } from './LobbyPanel';
import { SessionTimeControl } from './SessionTimeControl';
import { PlayerCharacterSheet } from './PlayerCharacterSheet';
import { DiceRollerWidget } from './DiceRollerWidget';
import { listEntries, type CombatLogEntry } from '../services/combat-log-service';
import type { PlayClientStoreImpl } from '../services/play-client-store';
import { Button, ListSurface, Panel, Tabs } from './primitives';
import { SplitView } from './SplitView';
import { PlayCockpitMap } from './PlayCockpitMap';
import type { SessionTransport } from '../services/session-transport';
import type { SessionRole } from './AppModeContext';

export interface PlayModeViewProps {
  role: SessionRole; // 'dm' | 'player' | null
  activeSessionId: string | null;
  /** DM-Pfad: direkte Host-DB. Für Player NICHT gesetzt (Membran D30). */
  database?: DatabaseLike;
  /** Player-Pfad: transport-gespeister Store. Für DM ungenutzt. */
  store?: PlayClientStoreImpl;
  playerId?: string;
  playerGroupIds?: string[];
  /** M10-#386: Host-Transport für den Token-Broadcast der präsentierten Karte. */
  transport?: Pick<SessionTransport, 'send'>;
}

type CockpitTab = 'map' | 'combatlog' | 'spotlight' | 'browse' | 'sheet';

interface EntityRef { id: string; title: string; type: string }
interface BaseEntityRow { id: string; title: string; type: string }

export function PlayModeView({ role, activeSessionId, database, store, playerId, playerGroupIds: _pgs = [], transport }: PlayModeViewProps) {
  const { t } = useTranslation('multiplayer');
  const [activeTab, setActiveTab] = useState<CockpitTab>('map');
  const [browseItems, setBrowseItems] = useState<EntityRef[]>([]);
  const [logEntries, setLogEntries] = useState<CombatLogEntry[]>([]);
  const [logTick, setLogTick] = useState(0);
  const [visTick, setVisTick] = useState(0);
  const [storeTick, setStoreTick] = useState(0);
  const campaignId = activeSessionId ?? '';
  const isPlayer = role === 'player';

  // S09 Live-Push: lokaler Listener; bei Remote-Client wird derselbe Effekt
  // durch eine 'visibility_change'-Nachricht des Hosts ausgelöst (S11/S12).
  useEffect(() => {
    return onVisibilityChange((change) => {
      if (change.campaignId !== campaignId) return;
      setVisTick((n) => n + 1);
    });
  }, [campaignId]);

  // Store-Abo (Player): rerender auf Snapshot/Delta.
  useEffect(() => {
    if (!isPlayer || !store) return;
    return store.subscribe(() => setStoreTick((n) => n + 1));
  }, [isPlayer, store]);

  // Kampflog — DM aus DB, Player aus Store.
  useEffect(() => {
    if (activeTab !== 'combatlog' || campaignId === '') return;
    if (isPlayer) {
      if (!store) { setLogEntries([]); return; }
      const fromStore = store.list('combat_log').map((e) => ({
        id: e.id,
        campaign_id: campaignId,
        actor_display: String(e.data.actor_display ?? ''),
        actor_player_id: (e.data.actor_player_id as string | null) ?? null,
        text: String(e.data.text ?? ''),
        visibility: String(e.data.visibility ?? 'all'),
        created_at: String(e.data.created_at ?? ''),
      })) as CombatLogEntry[];
      setLogEntries(fromStore);
      return;
    }
    if (!database) { setLogEntries([]); return; }
    let cancelled = false;
    void listEntries(database, { campaignId, role: 'dm', playerId }).then((es) => {
      if (!cancelled) setLogEntries(es);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [database, store, isPlayer, activeTab, campaignId, playerId, logTick, storeTick]);

  // Free-Browse — DM aus DB (direktes SELECT), Player aus Store.
  useEffect(() => {
    if (isPlayer) {
      if (!store) { setBrowseItems([]); return; }
      const items = store.list('entity').map((e) => ({
        id: e.id,
        title: String(e.data.title ?? ''),
        type: String(e.data.type ?? ''),
      }));
      setBrowseItems(items);
      return;
    }
    if (!database) { setBrowseItems([]); return; }
    let cancelled = false;
    void database.select<BaseEntityRow>('SELECT id, title, type FROM base_entities ORDER BY title').then((rows) => {
      if (!cancelled) setBrowseItems(rows);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [database, store, isPlayer, campaignId, visTick, storeTick]);

  // S19 (#364): DM kann Map ‖ Kampflog als 2-Pane-Split nebeneinander sehen
  // (In-App, kein OS-Pop-out). Nur DM (der Anwendungsfall aus D21).
  const [splitMode, setSplitMode] = useState(false);

  const mapPane = (
    <PlayCockpitMap
      role={role === 'player' ? 'player' : 'dm'}
      campaignId={campaignId}
      database={database}
      store={store}
      transport={transport}
      playerId={playerId}
    />
  );

  const combatPane = (
    <Panel className="play-cockpit__pane u-stack u-gap-2">
      <h3>{t('cockpit.combatLogTitle', 'Kampflog')}</h3>
      {!isPlayer && database !== undefined && campaignId !== '' && (
        <DiceRollerWidget
          database={database}
          campaignId={campaignId}
          actorDisplay="DM"
          onPosted={() => setLogTick((n) => n + 1)}
        />
      )}
      {isPlayer && store !== undefined && store.isOffline() && (
        <p className="u-muted">{t('cockpit.offline', 'Host offline — noch keine Daten.')}</p>
      )}
      <ListSurface className="play-cockpit__log-list">
        {logEntries.length === 0 && <li>{t('cockpit.logEmpty', 'Noch keine Einträge.')}</li>}
        {logEntries.map((e) => (
          <li key={e.id}>
            <span className="u-muted">[{e.visibility}]</span> {e.text}
          </li>
        ))}
      </ListSurface>
    </Panel>
  );

  // Player sieht zusätzlich den „Bogen"-Reiter (D13/D14).
  const tabOptions = [
    { id: 'map', label: t('cockpit.tabMap', 'Map') },
    { id: 'combatlog', label: t('cockpit.tabCombatLog', 'Kampflog') },
    { id: 'spotlight', label: t('cockpit.tabSpotlight', 'Spotlight') },
    { id: 'browse', label: t('cockpit.tabBrowse', 'Free-Browse') },
    ...(isPlayer && playerId
      ? [{ id: 'sheet' as const, label: t('cockpit.tabSheet', 'Bogen') }]
      : []),
  ] as const;

  return (
    <div className="workspace-area play-cockpit u-stack u-gap-3" data-play-role={role ?? ''}
      data-session-id={activeSessionId ?? ''}>
      {role === 'dm' && database !== undefined && campaignId !== '' && (
        <LobbyPanel database={database} campaignId={campaignId} />
      )}

      {/* S17 (#363): DM-Session-Zeit-Control (voranschreiten + absolut setzen).
          Nur DM; das host-seitige Kalender-Gate hängt am resultierenden
          Session-Jetzt. */}
      {role === 'dm' && database !== undefined && campaignId !== '' && (
        <SessionTimeControl database={database} campaignId={campaignId}
          onChanged={() => setVisTick((n) => n + 1)} />
      )}

      <div className="u-row u-gap-2">
        <Tabs
          label={t('cockpit.tabsLabel', 'Cockpit-Reiter')}
          activeId={activeTab}
          options={tabOptions}
          onSelect={(id) => setActiveTab(id as CockpitTab)}
        />
        {role === 'dm' && (
          <Button
            size="compact"
            tone={splitMode ? 'accent' : 'neutral'}
            variant={splitMode ? undefined : 'outline'}
            aria-pressed={splitMode}
            onClick={() => setSplitMode((s) => !s)}
          >
            {t('cockpit.splitToggle', 'Split: Map ‖ Kampflog')}
          </Button>
        )}
      </div>

      {/* S19: DM-Split zeigt Map ‖ Kampflog nebeneinander (überschreibt die
          Tab-Ansicht solange aktiv). */}
      {splitMode && role === 'dm' ? (
        <div className="play-cockpit__split">
          <SplitView primary={mapPane} secondary={combatPane} />
        </div>
      ) : (
        <>
          {activeTab === 'map' && mapPane}
          {activeTab === 'combatlog' && combatPane}

      {activeTab === 'spotlight' && (
        <Panel className="play-cockpit__pane">
          <h3>{t('cockpit.spotlightTitle', 'Spotlight')}</h3>
          <p>{t('cockpit.spotlightStub', 'Spotlight/Whiteboard — Panel wird durch S15 (Whiteboard-Elemente + per-Spieler-Boards) gefüllt.')}</p>
        </Panel>
      )}

      {activeTab === 'sheet' && isPlayer && playerId && campaignId !== '' && store !== undefined && (
        <PlayerCharacterSheet
          store={store}
          campaignId={campaignId}
          playerId={playerId}
        />
      )}

      {activeTab === 'browse' && (
        <Panel className="play-cockpit__pane u-stack u-gap-2">
          <h3>{t('cockpit.browseTitle', 'Free-Browse')}</h3>
          <p>{t('cockpit.browseHint', 'Alle Entities, die der DM für dich freigegeben hat (bzw. für den DM: alle).')}</p>
          {isPlayer && store !== undefined && store.isOffline() && (
            <p className="u-muted">{t('cockpit.offline', 'Host offline — noch keine Daten.')}</p>
          )}
          <ListSurface className="play-cockpit__browse-list">
            {browseItems.length === 0 && <li>{t('cockpit.browseEmpty', 'Nichts freigegeben.')}</li>}
            {browseItems.map((it) => (
              <li key={it.id}>
                <span>{it.title}</span>
                <span className="u-muted"> — {it.type}</span>
              </li>
            ))}
          </ListSurface>
        </Panel>
      )}
        </>
      )}
    </div>
  );
}

export default PlayModeView;
