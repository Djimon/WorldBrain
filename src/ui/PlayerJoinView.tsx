// M10-S05 (#354): „Campaign beitreten" — Auto-Join (D24) im Play-Modus.
// Ein Feld für Einladungslink/-Code + Anzeigename — der Link trägt die
// Rendezvous-Info selbst (Signaling-Details in S11/S12). Gültiger Code
// → sofort aktives Mitglied via session-identity-service, dann Übergang
// zur Charaktererstellung (S08 baut die Weiterleitung aus).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { joinWithCode } from '../services/session-identity-service';
import { Button, Field, Panel, StatusChip } from './primitives';

export interface PlayerJoinViewProps {
  database: DatabaseLike;
  /** Callback nach erfolgreichem Join (Token verfügbar) → S08 nimmt hier auf. */
  onJoined?: (result: { token: string; playerId: string; displayName: string }) => void;
}

export function PlayerJoinView({ database, onJoined }: PlayerJoinViewProps) {
  const { t } = useTranslation('multiplayer');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = code.trim() !== '' && displayName.trim() !== '' && !busy;

  async function handleJoin() {
    setError(null);
    setBusy(true);
    try {
      const result = await joinWithCode(database, {
        code: code.trim(),
        displayName: displayName.trim(),
      });
      onJoined?.({ ...result, displayName: displayName.trim() });
    } catch {
      // AC: Fehler NUR bei ungültigem Code / Host nicht erreichbar — nie
      // DM-Ablehnung. Keine Unterscheidung nach Ursache im UI (D24).
      setError(t('join.errorInvalid', 'Ungültiger Einladungscode oder Host nicht erreichbar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="player-join-view u-stack u-gap-3" role="form"
      aria-label={t('join.title', 'Campaign beitreten')}>
      <h2>{t('join.title', 'Campaign beitreten')}</h2>
      <Field
        label={t('join.codeLabel', 'Einladungslink / Code')}
        placeholder={t('join.codePlaceholder', 'z.B. ABCD-EFGH oder wbrain://…')}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
      />
      <Field
        label={t('join.displayNameLabel', 'Anzeigename')}
        placeholder={t('join.displayNamePlaceholder', 'z.B. Alice')}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      {error !== null && (
        <StatusChip tone="failure" role="alert">{error}</StatusChip>
      )}
      <Button
        tone="accent"
        disabled={!canSubmit}
        onClick={() => void handleJoin()}
      >
        {busy ? t('join.busy', 'Verbinde…') : t('join.submit', 'Beitreten')}
      </Button>
    </Panel>
  );
}

export default PlayerJoinView;
