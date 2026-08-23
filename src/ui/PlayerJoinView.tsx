// M10-S05 (#354): „Campaign beitreten" — Auto-Join (D24) im Play-Modus.
// Ein Feld für Einladungslink/-Code + Anzeigename — der Link trägt die
// Rendezvous-Info selbst (Signaling-Details in S11/S12). Gültiger Code
// → sofort aktives Mitglied via session-identity-service, dann Übergang
// zur Charaktererstellung (S08 baut die Weiterleitung aus).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { joinWithCode } from '../services/session-identity-service';
import {
  clearStoredToken,
  listStoredTokens,
  persistToken,
  reconnect as reconnectSession,
} from '../services/reconnect-service';
import { Button, Field, Panel, StatusChip } from './primitives';

// M10-S05/S10: Token-Persistenz + Reconnect leben in reconnect-service.
// Wir speichern den zuletzt aktiven Token für diesen Client und stellen ihn
// beim Mount wieder her, sofern reconnect() ihn (server- oder client-seitig)
// noch akzeptiert. Gekickte Tokens werden verworfen.

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
  const [joinedName, setJoinedName] = useState<string | null>(null);

  // Reconnect-Check beim Mount (D10/D11): existiert ein persistierter Token →
  // reconnect versuchen; Erfolg → Success-Screen ohne Neu-Join. Verhindert,
  // dass mehrfaches Öffnen der Play-Sicht weitere Player-Rows anlegt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = (await listStoredTokens())[0];
      if (!stored || cancelled) return;
      const result = await reconnectSession({ token: stored.token, database });
      if (cancelled) return;
      if (result.success) {
        setJoinedName(stored.displayName);
        onJoined?.({
          token: stored.token,
          playerId: stored.playerId ?? '',
          displayName: stored.displayName,
        });
      } else {
        await clearStoredToken(stored.token);
      }
    })().catch(() => { /* fail-open: normales Formular anzeigen */ });
    return () => { cancelled = true; };
  }, [database]);

  const canSubmit = code.trim() !== '' && displayName.trim() !== '' && !busy;

  async function handleJoin() {
    setError(null);
    setBusy(true);
    try {
      const name = displayName.trim();
      const result = await joinWithCode(database, {
        code: code.trim(),
        displayName: name,
      });
      await persistToken({
        hostLabel: '', // D10-Slot; wird gesetzt wenn Host-Label bekannt ist.
        code: code.trim(),
        token: result.token,
        displayName: name,
        campaignName: '',
        playerId: result.playerId,
      });
      setJoinedName(name);
      onJoined?.({ ...result, displayName: name });
    } catch (e) {
      // AC: Fehler NUR bei ungültigem Code / Host nicht erreichbar — nie
      // DM-Ablehnung. Realer Fehler-Text hilft beim Live-Debug.
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('join.errorInvalid', 'Ungültiger Einladungscode oder Host nicht erreichbar.')} — ${raw}`);
    } finally {
      setBusy(false);
    }
  }

  if (joinedName !== null) {
    return (
      <Panel className="player-join-view u-stack u-gap-3" role="status"
        aria-label={t('join.joinedTitle', 'Beigetreten')}>
        <h2>{t('join.joinedTitle', 'Beigetreten')}</h2>
        <StatusChip tone="success">
          {t('join.joinedMsg', 'Willkommen, {{name}}! Du bist der Campaign beigetreten.', { name: joinedName })}
        </StatusChip>
        <p>{t('join.nextStep', 'Nächster Schritt: Charaktererstellung (folgt in S08).')}</p>
      </Panel>
    );
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
