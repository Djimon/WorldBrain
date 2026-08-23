// M10-S06 (#355): GM-Lobby — Live-Sicht der verbundenen Spieler + Kick +
// Copy-Code (D24/D27). Auto-Join macht separate Freigabe-Sektionen
// obsolet. Signaling-UI bleibt Stufe 3 (S11/S12) — hier NICHT gemountet.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listCampaignPlayers, kick as kickPlayer } from '../services/player-membership-service';
import { generateInviteCode } from '../services/session-identity-service';
import type { SessionPlayer } from '../services/player-membership-service';
import { Button, Field, ListSurface, Panel, StatusChip } from './primitives';

export interface LobbyPanelProps {
  database: DatabaseLike;
  campaignId: string;
  /** Aktueller Einladungscode — vom Host-Owner initial gesetzt / persistiert. */
  currentInviteCode?: string;
  /** Neuer Code nach Regenerierung — Callback für die Persistenz-Schicht. */
  onInviteCodeChanged?: (newCode: string) => void;
}

export function LobbyPanel({ database, campaignId, currentInviteCode = '', onInviteCodeChanged }: LobbyPanelProps) {
  const { t } = useTranslation('multiplayer');
  const [players, setPlayers] = useState<SessionPlayer[]>([]);
  const [inviteCode, setInviteCode] = useState(currentInviteCode);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await listCampaignPlayers(database, campaignId);
      setPlayers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lobby.loadError', 'Roster konnte nicht geladen werden.'));
    }
  }

  useEffect(() => { void reload(); }, [database, campaignId]);

  async function handleKick(playerId: string) {
    setError(null);
    try {
      await kickPlayer(database, { campaignId, playerId });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lobby.kickError', 'Kick fehlgeschlagen.'));
    }
  }

  async function handleRegenerate() {
    setError(null);
    try {
      const next = await generateInviteCode(database, { campaignId });
      setInviteCode(next);
      onInviteCodeChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('lobby.regenError', 'Code konnte nicht neu erzeugt werden.'));
    }
  }

  async function handleCopy() {
    if (inviteCode === '') return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyFeedback(t('lobby.copied', 'kopiert'));
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      setError(t('lobby.copyError', 'Kopieren fehlgeschlagen.'));
    }
  }

  return (
    <Panel className="lobby-panel u-stack u-gap-3" role="region"
      aria-label={t('lobby.title', 'Lobby')}>
      <h2>{t('lobby.title', 'Lobby')}</h2>

      <div className="lobby-panel__invite u-stack u-gap-2">
        <Field
          label={t('lobby.inviteLabel', 'Einladungscode')}
          value={inviteCode}
          readOnly
          onChange={() => { /* readonly */ }}
        />
        <div className="u-row u-gap-2">
          <Button tone="accent" onClick={() => void handleCopy()} disabled={inviteCode === ''}>
            {t('lobby.copy', 'Kopieren')}
          </Button>
          <Button onClick={() => void handleRegenerate()}>
            {t('lobby.regenerate', 'Neuen Code erzeugen')}
          </Button>
          {copyFeedback !== null && (
            <StatusChip tone="success">{copyFeedback}</StatusChip>
          )}
        </div>
      </div>

      {error !== null && (
        <StatusChip tone="failure" role="alert">{error}</StatusChip>
      )}

      <div className="lobby-panel__roster u-stack u-gap-2">
        <h3>{t('lobby.rosterTitle', 'Verbundene Spieler')}</h3>
        <ListSurface>
          {players.length === 0 && (
            <li className="lobby-panel__empty">{t('lobby.rosterEmpty', 'Noch niemand beigetreten.')}</li>
          )}
          {players.map((p) => (
            <li key={p.id} className="lobby-panel__player u-row u-gap-2">
              <span className="lobby-panel__player-id">{p.player_id}</span>
              <StatusChip tone={p.status === 'active' ? 'success' : 'muted'}>
                {p.status === 'active' ? t('lobby.online', 'online') : t('lobby.offline', 'offline')}
              </StatusChip>
              {p.status === 'active' && (
                <Button
                  tone="danger"
                  variant="outline"
                  size="compact"
                  onClick={() => void handleKick(p.player_id)}
                >
                  {t('lobby.kick', 'Kick')}
                </Button>
              )}
            </li>
          ))}
        </ListSurface>
      </div>
    </Panel>
  );
}

export default LobbyPanel;
