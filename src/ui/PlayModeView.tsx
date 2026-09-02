// M10-S14 (#360) + #374: Play cockpit — tabs Map/Combat log/Spotlight +
// Free-Browse. Role comes from AppModeContext (dm|player). For the DM the
// LobbyPanel sits on top as a permanent control element.
//
// Data source (D30 membrane, #374):
// - DM: reads via the `database` prop directly from the host DB (combat log, free-
//   browse, lobby roster).
// - Player: reads EXCLUSIVELY from the transport-fed `store` (no
//   local DB access). The store receives snapshot/delta from the host.
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { feature } from '../config/features';
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
import type { SessionTransport } from '../services/session-transport';
import type { SessionRole } from './AppModeContext';

// pre-release S2-Folge (#412): the play-side map (Map tab + split) is part of the `maps`
// feature — gated by the same flag as the edit maps area. Lazy + directly-inlined constant
// so a release build with "maps": false tree-shakes PlayCockpitMap (and MapViewer) out of
// dist/ AND drops the Map tab from the play cockpit. See src/config/features.ts.
const PlayCockpitMap = import.meta.env.DEV || __FEATURE_MAPS__
  ? lazy(() => import('./PlayCockpitMap').then((m) => ({ default: m.PlayCockpitMap })))
  : null;

export interface PlayModeViewProps {
  role: SessionRole; // 'dm' | 'player' | null
  activeSessionId: string | null;
  /** DM path: direct host DB. NOT set for players (membrane D30). */
  database?: DatabaseLike;
  /** Player path: transport-fed store. Unused for the DM. */
  store?: PlayClientStoreImpl;
  playerId?: string;
  playerGroupIds?: string[];
  /** M10-#386: host transport for the token broadcast of the presented map. */
  transport?: Pick<SessionTransport, 'send'>;
}

type CockpitTab = 'map' | 'combatlog' | 'spotlight' | 'browse' | 'sheet';

interface EntityRef { id: string; title: string; type: string }
interface BaseEntityRow { id: string; title: string; type: string }

export function PlayModeView({ role, activeSessionId, database, store, playerId, playerGroupIds: _pgs = [], transport }: PlayModeViewProps) {
  const { t } = useTranslation('multiplayer');
  const mapsEnabled = feature('maps');
  const [activeTab, setActiveTab] = useState<CockpitTab>(mapsEnabled ? 'map' : 'combatlog');
  const [browseItems, setBrowseItems] = useState<EntityRef[]>([]);
  const [logEntries, setLogEntries] = useState<CombatLogEntry[]>([]);
  const [logTick, setLogTick] = useState(0);
  const [visTick, setVisTick] = useState(0);
  const [storeTick, setStoreTick] = useState(0);
  const campaignId = activeSessionId ?? '';
  const isPlayer = role === 'player';

  // S09 live push: local listener; on a remote client the same effect is
  // triggered by a 'visibility_change' message from the host (S11/S12).
  useEffect(() => {
    return onVisibilityChange((change) => {
      if (change.campaignId !== campaignId) return;
      setVisTick((n) => n + 1);
    });
  }, [campaignId]);

  // Store subscription (player): rerender on snapshot/delta.
  useEffect(() => {
    if (!isPlayer || !store) return;
    return store.subscribe(() => setStoreTick((n) => n + 1));
  }, [isPlayer, store]);

  // Combat log — DM from DB, player from store.
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

  // Free-Browse — DM from DB (direct SELECT), player from store.
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

  // S19 (#364): the DM can view Map ‖ Combat log side by side as a 2-pane split
  // (in-app, no OS pop-out). DM only (the use case from D21).
  const [splitMode, setSplitMode] = useState(false);

  const mapPane = PlayCockpitMap ? (
    <Suspense fallback={null}>
      <PlayCockpitMap
        role={role === 'player' ? 'player' : 'dm'}
        campaignId={campaignId}
        database={database}
        store={store}
        transport={transport}
        playerId={playerId}
      />
    </Suspense>
  ) : null;

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

  // The player additionally sees the "Sheet" tab (D13/D14).
  const tabOptions = [
    ...(mapsEnabled ? [{ id: 'map' as const, label: t('cockpit.tabMap', 'Map') }] : []),
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

      {/* S17 (#363): DM session-time control (advance + set absolute).
          DM only; the host-side calendar gate hangs off the resulting
          session-now. */}
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
        {role === 'dm' && mapsEnabled && (
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

      {/* S19: the DM split shows Map ‖ Combat log side by side (overrides the
          tab view while active). */}
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
