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

interface PlayerRow { id: string; display_name: string }

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
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [inviteCode, setInviteCode] = useState(currentInviteCode);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await listCampaignPlayers(database, campaignId);
      setPlayers(rows);
      // Anzeigename statt UUID: display_name aus der players-Tabelle nachladen.
      if (rows.length > 0) {
        const ids = rows.map((r) => r.player_id);
        const placeholders = ids.map(() => '?').join(',');
        const names = await database.select<PlayerRow>(
          `SELECT id, display_name FROM players WHERE id IN (${placeholders})`,
          ids,
        );
        const map: Record<string, string> = {};
        for (const n of names) map[n.id] = n.display_name;
        setPlayerNames(map);
      } else {
        setPlayerNames({});
      }
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
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('lobby.regenError', 'Code konnte nicht neu erzeugt werden.')} — ${raw}`);
    }
  }

  // Roster-Anzeige: nur aktive. Gekickte bleiben in der DB (Token-Sperre für
  // Reconnect-Schutz), tauchen aber nicht mehr in "Verbundene Spieler" auf.
  const activePlayers = players.filter((p) => p.status === 'active');

  // Teilbarer Einladungs-Link (D27): trägt Code + Campaign — der Client kann
  // ihn per Paste direkt in den Beitrittsflow einwerfen (S05 akzeptiert
  // Link ODER nackten Code).
  const inviteLink = inviteCode !== ''
    ? `wbrain://join?code=${encodeURIComponent(inviteCode)}&campaign=${encodeURIComponent(campaignId)}`
    : '';

  async function copyToClipboard(text: string) {
    if (text === '') return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(t('lobby.copied', 'kopiert'));
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      setError(t('lobby.copyError', 'Kopieren fehlgeschlagen.'));
    }
  }

  async function handleCopy() {
    await copyToClipboard(inviteCode);
  }
  async function handleCopyLink() {
    await copyToClipboard(inviteLink);
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
            {t('lobby.copy', 'Code kopieren')}
          </Button>
          <Button onClick={() => void handleRegenerate()}>
            {t('lobby.regenerate', 'Neuen Code erzeugen')}
          </Button>
        </div>
        <Field
          label={t('lobby.inviteLinkLabel', 'Einladungslink')}
          value={inviteLink}
          readOnly
          onChange={() => { /* readonly */ }}
        />
        <div className="u-row u-gap-2">
          <Button onClick={() => void handleCopyLink()} disabled={inviteLink === ''}>
            {t('lobby.copyLink', 'Link kopieren')}
          </Button>
          {copyFeedback !== null && <StatusChip tone="success">{copyFeedback}</StatusChip>}
        </div>
      </div>

      {error !== null && (
        <StatusChip tone="failure" role="alert">{error}</StatusChip>
      )}

      <div className="lobby-panel__roster u-stack u-gap-2">
        <h3>{t('lobby.rosterTitle', 'Verbundene Spieler')}</h3>
        <ListSurface>
          {activePlayers.length === 0 && (
            <li className="lobby-panel__empty">{t('lobby.rosterEmpty', 'Noch niemand beigetreten.')}</li>
          )}
          {activePlayers.map((p) => (
            <li key={p.id} className="lobby-panel__player u-row u-gap-2">
              <span className="lobby-panel__player-name">{playerNames[p.player_id] ?? p.player_id}</span>
              <StatusChip tone="success">{t('lobby.online', 'online')}</StatusChip>
              <Button
                tone="danger"
                variant="outline"
                size="compact"
                onClick={() => void handleKick(p.player_id)}
              >
                {t('lobby.kick', 'Kick')}
              </Button>
            </li>
          ))}
        </ListSurface>
      </div>
    </Panel>
  );
}

export default LobbyPanel;
