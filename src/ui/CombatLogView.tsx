// M10-S3 (#422, D17/D30): Combat-log play-sidebar view — DM + player.
//   - DM: log list from the host DB (listEntries, role='dm' → sees everything incl.
//     dm_only, marked "nur DM") + DiceRollerWidget (DB post → also broadcast to players).
//   - Player (D30, no DB): log list from the transport-fed store (`store.list('combat_log')`,
//     only 'all' arrives from the host) merged with own local echoes (dm_only/private);
//     DiceRollerWidget in player mode (roll_dice intent / local-only 'private').
// Layout: left = log, right = dice panel (AC).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import type { SessionTransport } from '../services/session-transport';
import type { PlayClientStore } from '../services/play-client-store';
import { listEntries, type CombatLogEntry } from '../services/combat-log-service';
import { broadcastCombatEntry } from '../services/host-combat-log-sync';
import type { DiceVisibility } from '../services/dice-roller-service';
import { DiceRollerWidget } from './DiceRollerWidget';
import { Panel, ListSurface, ListRow, StatusChip } from './primitives';

export interface CombatLogViewProps {
  role: 'dm' | 'player';
  campaignId: string;
  /** DM only — direct host-DB read + post. */
  database?: DatabaseLike;
  /** Player only — the transport-fed store (D30 membrane). */
  store?: PlayClientStore & { isOffline?: () => boolean };
  /** DM: host transport (broadcast own posts). Player: send roll intents. */
  transport?: Pick<SessionTransport, 'send'>;
  playerId?: string;
  actorDisplay: string;
  /** DM: bumped by the host when a player roll is persisted → reload the DB log live. */
  refreshToken?: number;
}

function storeEntryToLog(id: string, data: Record<string, unknown>, campaignId: string): CombatLogEntry {
  return {
    id,
    campaign_id: campaignId,
    actor_display: String(data.actor_display ?? ''),
    actor_player_id: (data.actor_player_id as string | null) ?? null,
    text: String(data.text ?? ''),
    visibility: String(data.visibility ?? 'all') as DiceVisibility,
    created_at: String(data.created_at ?? ''),
  };
}

export function CombatLogView({ role, campaignId, database, store, transport, playerId, actorDisplay, refreshToken = 0 }: CombatLogViewProps) {
  const { t } = useTranslation('multiplayer');
  const isPlayer = role === 'player';
  const [entries, setEntries] = useState<CombatLogEntry[]>([]);
  const [localEcho, setLocalEcho] = useState<CombatLogEntry[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  // Player: re-render on store snapshot/delta.
  useEffect(() => {
    if (!isPlayer || !store) return;
    return store.subscribe(() => setReloadTick((n) => n + 1));
  }, [isPlayer, store]);

  // Load the log — DM from DB, player from the store.
  useEffect(() => {
    if (campaignId === '') { setEntries([]); return; }
    if (isPlayer) {
      setEntries(store ? store.list('combat_log').map((e) => storeEntryToLog(e.id, e.data, campaignId)) : []);
      return;
    }
    if (!database) { setEntries([]); return; }
    let cancelled = false;
    void listEntries(database, { campaignId, role: 'dm', playerId })
      .then((es) => { if (!cancelled) setEntries(es); })
      .catch((e) => { if (!cancelled) setEntries([]); void e; });
    return () => { cancelled = true; };
  }, [isPlayer, store, database, campaignId, playerId, reloadTick, refreshToken]);

  // Merge store/DB entries with the player's optimistic local echoes, newest first.
  const merged = [...entries, ...localEcho].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const offline = isPlayer && (store?.isOffline?.() ?? false);

  function visibilityMarker(v: DiceVisibility): string | null {
    if (v === 'dm_only') return t('dice.visDm', 'Nur DM');
    if (v === 'private') return t('dice.visPrivate', 'Privat');
    return null; // 'all' → no marker
  }

  return (
    <div className="workspace-area u-row u-gap-3 u-items-start">
      <Panel className="combat-log-view__log u-stack u-gap-2 u-flex-1">
        <h3>{t('cockpit.combatLogTitle', 'Kampflog')}</h3>
        {offline && <p className="u-muted">{t('cockpit.offline', 'Host offline — noch keine Daten.')}</p>}
        <ListSurface>
          {merged.length === 0 && (
            <ListRow as="div" interactive={false}>
              <span className="u-muted">{t('cockpit.logEmpty', 'Noch keine Einträge.')}</span>
            </ListRow>
          )}
          {merged.map((e) => {
            const marker = visibilityMarker(e.visibility);
            return (
              <ListRow as="div" interactive={false} key={e.id} className="u-row u-gap-2">
                {marker !== null && <StatusChip tone="muted">{marker}</StatusChip>}
                <span>{e.text}</span>
              </ListRow>
            );
          })}
        </ListSurface>
      </Panel>

      <Panel className="combat-log-view__dice u-stack u-gap-2">
        <h3>{t('dice.roll', 'Würfeln')}</h3>
        <DiceRollerWidget
          campaignId={campaignId}
          actorDisplay={actorDisplay}
          database={isPlayer ? undefined : database}
          transport={isPlayer ? transport : undefined}
          senderPlayerId={isPlayer ? playerId : undefined}
          actorPlayerId={isPlayer ? playerId : undefined}
          onPosted={isPlayer ? undefined : (entry) => {
            setReloadTick((n) => n + 1); // reload the DM's DB view
            if (transport) broadcastCombatEntry(transport, entry); // push 'all' to players
          }}
          onLocalRoll={isPlayer ? (entry) => setLocalEcho((prev) => [...prev, entry]) : undefined}
        />
      </Panel>
    </div>
  );
}

export default CombatLogView;
