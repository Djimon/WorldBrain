// M10-S05 (#354): „Campaign beitreten" — Auto-Join (D24) im Play-Modus.
// Ein Feld für Einladungslink/-Code + Anzeigename — der Link trägt die
// Rendezvous-Info selbst (Signaling-Details in S11/S12). Gültiger Code
// → sofort aktives Mitglied via session-identity-service, dann Übergang
// zur Charaktererstellung (S08 baut die Weiterleitung aus).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { joinWithCode, validateToken } from '../services/session-identity-service';
import { Button, Field, Panel, StatusChip } from './primitives';

// M10-S05: Token + Displayname bleiben pro Browser-Client in localStorage
// stehen. Beim nächsten Mount reconnecten wir ohne neuen Join, sofern
// validateToken() den Token noch als aktiv (nicht gekickt) erkennt.
// (Volle Persistenz-Story S10.)
const TOKEN_KEY = 'wbrain.session-token';
const NAME_KEY = 'wbrain.session-name';
const PLAYER_ID_KEY = 'wbrain.session-player-id';

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

  // Reconnect-Check beim Mount: existiert ein gültiger Token → Success-Screen
  // ohne neuen Join. Verhindert dass mehrfaches Öffnen der Play-Sicht
  // weitere Player-Rows anlegt.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (stored === null || stored === '') return;
    let cancelled = false;
    void validateToken(database, stored).then((ok) => {
      if (cancelled) return;
      if (ok) {
        const name = window.localStorage.getItem(NAME_KEY) ?? '';
        const pid = window.localStorage.getItem(PLAYER_ID_KEY) ?? '';
        setJoinedName(name);
        // Parent (WorkspaceShell) auf Sheet-Sicht schalten.
        if (pid !== '') onJoined?.({ token: stored, playerId: pid, displayName: name });
      } else {
        // Token invalidiert (kicked / DB weg) — Slate clearen.
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(NAME_KEY);
        window.localStorage.removeItem(PLAYER_ID_KEY);
      }
    }).catch(() => { /* fail-open: normales Formular anzeigen */ });
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
      window.localStorage.setItem(TOKEN_KEY, result.token);
      window.localStorage.setItem(NAME_KEY, name);
      window.localStorage.setItem(PLAYER_ID_KEY, result.playerId);
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
