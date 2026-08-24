// M10-S14 (#360): Play-Cockpit — Reiter Map/Kampflog/Spotlight + Free-Browse.
// Von S22 als `session`-Bereich des Play-Modus gemountet; role kommt aus dem
// AppModeContext (dm|player). LobbyPanel (S06) sitzt weiterhin oben als
// permanentes Kontroll-Element für den DM.
// Inhalte der Reiter (echte Regel-Engine / Whiteboard / Würfel) leben in
// S15/S16/M10b — dieses File liefert Gerüst + Free-Browse + Mount-Punkte.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../services/DatabaseContext';
import { listEntitiesByType } from '../services/entity-service';
import { filterEntitiesForPlayer } from '../services/player-content-filter-service';
import { LobbyPanel } from './LobbyPanel';
import { PlayerCharacterSheet } from './PlayerCharacterSheet';
import { DiceRollerWidget } from './DiceRollerWidget';
import { listEntries, type CombatLogEntry } from '../services/combat-log-service';
import { Panel, Tabs } from './primitives';
import type { SessionRole } from './AppModeContext';

export interface PlayModeViewProps {
  role: SessionRole; // 'dm' | 'player' | null
  activeSessionId: string | null;
  /** Für Player: seine playerId + Gruppen — für die host-seitige Filterung.
   *  Wird von der Player-Live-Sicht (S09) beim Reconnect / Join gesetzt. */
  playerId?: string;
  playerGroupIds?: string[];
}

type CockpitTab = 'map' | 'combatlog' | 'spotlight' | 'browse' | 'sheet';

interface EntityRef { id: string; title: string; type: string }

export function PlayModeView({ role, activeSessionId, playerId, playerGroupIds = [] }: PlayModeViewProps) {
  const { t } = useTranslation('multiplayer');
  const database = useDatabase();
  const [activeTab, setActiveTab] = useState<CockpitTab>('map');
  const [browseItems, setBrowseItems] = useState<EntityRef[]>([]);
  const [logEntries, setLogEntries] = useState<CombatLogEntry[]>([]);
  const [logTick, setLogTick] = useState(0);
  const campaignId = activeSessionId ?? '';

  // Kampflog laden — role-basiertes host-seitiges Filtern (D17).
  useEffect(() => {
    if (activeTab !== 'combatlog' || campaignId === '') return;
    let cancelled = false;
    void listEntries(database, {
      campaignId,
      role: role === 'player' ? 'player' : 'dm',
      playerId,
    }).then((es) => { if (!cancelled) setLogEntries(es); }).catch(console.error);
    return () => { cancelled = true; };
  }, [database, activeTab, campaignId, role, playerId, logTick]);

  // Free-Browse (D15): der Player sieht Entities nur wenn host-seitig
  // freigegeben (S09-Filter); der DM sieht alles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await listEntitiesByType({ database, type: null });
      const items: EntityRef[] = raw.map((r) => ({ id: r.id, title: r.title, type: r.type }));
      if (role === 'player' && playerId && campaignId !== '') {
        const allowed = await filterEntitiesForPlayer({
          database,
          campaignId,
          ids: items.map((i) => i.id),
          context: { campaign_id: campaignId, player_id: playerId, group_ids: playerGroupIds },
        });
        const set = new Set(allowed);
        if (!cancelled) setBrowseItems(items.filter((i) => set.has(i.id)));
      } else if (!cancelled) {
        setBrowseItems(items);
      }
    })().catch(console.error);
    return () => { cancelled = true; };
  }, [database, role, campaignId, playerId, playerGroupIds.join(',')]);

  // Player bekommt zusätzlich den „Bogen"-Reiter (S08-Charaktersheet als
  // Aktionsquelle, D13/D14). DM sieht den nicht (fremde Bögen unsichtbar, D20).
  const tabOptions = [
    { id: 'map', label: t('cockpit.tabMap', 'Map') },
    { id: 'combatlog', label: t('cockpit.tabCombatLog', 'Kampflog') },
    { id: 'spotlight', label: t('cockpit.tabSpotlight', 'Spotlight') },
    { id: 'browse', label: t('cockpit.tabBrowse', 'Free-Browse') },
    ...(role === 'player' && playerId
      ? [{ id: 'sheet' as const, label: t('cockpit.tabSheet', 'Bogen') }]
      : []),
  ] as const;

  return (
    <div className="workspace-area play-cockpit u-stack u-gap-3" data-play-role={role ?? ''}
      data-session-id={activeSessionId ?? ''}>
      {role === 'dm' && campaignId !== '' && (
        <LobbyPanel database={database} campaignId={campaignId} />
      )}

      <Tabs
        label={t('cockpit.tabsLabel', 'Cockpit-Reiter')}
        activeId={activeTab}
        options={tabOptions}
        onSelect={(id) => setActiveTab(id as CockpitTab)}
      />

      {activeTab === 'map' && (
        <Panel className="play-cockpit__pane">
          <p>{t('cockpit.mapStub', 'Karten-Reiter — MapViewer-Einbettung folgt (nutzt bestehende Map-Komponenten + Fog/Token).')}</p>
        </Panel>
      )}

      {activeTab === 'combatlog' && (
        <Panel className="play-cockpit__pane u-stack u-gap-2">
          <h3>{t('cockpit.combatLogTitle', 'Kampflog')}</h3>
          {campaignId !== '' && (
            <DiceRollerWidget
              database={database}
              campaignId={campaignId}
              actorDisplay={role === 'dm' ? 'DM' : (playerId ?? 'Player')}
              actorPlayerId={role === 'player' ? playerId : undefined}
              onPosted={() => setLogTick((n) => n + 1)}
            />
          )}
          <ul className="play-cockpit__log-list">
            {logEntries.length === 0 && <li>{t('cockpit.logEmpty', 'Noch keine Einträge.')}</li>}
            {logEntries.map((e) => (
              <li key={e.id}>
                <span className="u-muted">[{e.visibility}]</span> {e.text}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {activeTab === 'spotlight' && (
        <Panel className="play-cockpit__pane">
          <h3>{t('cockpit.spotlightTitle', 'Spotlight')}</h3>
          <p>{t('cockpit.spotlightStub', 'Spotlight/Whiteboard — Panel wird durch S15 (Whiteboard-Elemente + per-Spieler-Boards) gefüllt.')}</p>
        </Panel>
      )}

      {activeTab === 'sheet' && role === 'player' && playerId && campaignId !== '' && (
        <PlayerCharacterSheet
          database={database}
          campaignId={campaignId}
          playerId={playerId}
          onPostAction={(action) => {
            void import('../services/combat-log-service').then(({ postEntry }) =>
              postEntry(database, {
                campaignId,
                actorDisplay: action.characterId,
                actorPlayerId: playerId,
                text: action.text,
                visibility: 'all',
              }),
            );
          }}
        />
      )}

      {activeTab === 'browse' && (
        <Panel className="play-cockpit__pane u-stack u-gap-2">
          <h3>{t('cockpit.browseTitle', 'Free-Browse')}</h3>
          <p>{t('cockpit.browseHint', 'Alle Entities, die der DM für dich freigegeben hat (bzw. für den DM: alle).')}</p>
          <ul className="play-cockpit__browse-list">
            {browseItems.length === 0 && <li>{t('cockpit.browseEmpty', 'Nichts freigegeben.')}</li>}
            {browseItems.map((it) => (
              <li key={it.id}>
                <span>{it.title}</span>
                <span className="u-muted"> — {it.type}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export default PlayModeView;
