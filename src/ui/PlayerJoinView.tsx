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
  ping as pingHost,
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
  // D10: Ping-basierte Online-Erkennung + Retry-Button; kein Heartbeat.
  const [hostOnline, setHostOnline] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  async function runReconnect() {
    setChecking(true);
    try {
      const online = await pingHost(database);
      setHostOnline(online);
      if (!online) return;
      const stored = (await listStoredTokens())[0];
      if (!stored) return;
      const result = await reconnectSession({ token: stored.token, database });
      if (result.success) {
        setJoinedName(stored.displayName);
        onJoined?.({
          token: stored.token,
          playerId: stored.playerId ?? '',
          displayName: stored.displayName,
        });
      } else if (result.reason === 'kicked') {
        // Nur bei bestätigt gekicktem Token Slate leeren — bei no_host bleibt
        // der Token erhalten, damit ein späterer Retry noch reconnecten kann.
        await clearStoredToken(stored.token);
      }
    } catch { /* fail-open */ } finally { setChecking(false); }
  }

  // #371 Fix 5: Auto-Reconnect ist NICHT mehr still — der Spieler muss ihn
  // explizit auslösen (Button „Wieder verbinden"). Sonst joint bei einer
  // zweiten lokalen Instanz eine Alt-Sitzung ohne Zutun des Users.
  const [storedTokenExists, setStoredTokenExists] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listStoredTokens().then((toks) => {
      if (!cancelled) setStoredTokenExists(toks.length > 0);
    });
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
        <p>{t('join.nextStep', 'Nächster Schritt: Charaktererstellung.')}</p>
      </Panel>
    );
  }

  // D10: „Host offline"-Zustand mit Retry-Button, wenn Ping fehlschlägt UND
  // ein persistierter Token existiert (der Retry würde reconnecten).
  if (hostOnline === false) {
    return (
      <Panel className="player-join-view u-stack u-gap-3" role="status"
        aria-label={t('join.offlineTitle', 'Host offline')}>
        <h2>{t('join.offlineTitle', 'Host offline')}</h2>
        <StatusChip tone="failure">
          {t('join.offlineMsg', 'Der Host ist gerade nicht erreichbar. Erneut versuchen, sobald verfügbar.')}
        </StatusChip>
        <Button tone="accent" onClick={() => void runReconnect()} disabled={checking}>
          {checking ? t('join.retrying', 'Prüfe…') : t('join.retry', '🔄 Erneut verbinden')}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className="player-join-view u-stack u-gap-3" role="form"
      aria-label={t('join.title', 'Campaign beitreten')}>
      <h2>{t('join.title', 'Campaign beitreten')}</h2>
      {/* #371 Fix 5: expliziter Reconnect statt still automatisch. */}
      {storedTokenExists && (
        <div className="u-row u-gap-2">
          <StatusChip tone="muted">
            {t('join.storedTokenPresent', 'Frühere Sitzung erkannt.')}
          </StatusChip>
          <Button tone="accent" onClick={() => void runReconnect()} disabled={checking}>
            {checking ? t('join.retrying', 'Verbinde…') : t('join.reconnect', 'Wieder verbinden')}
          </Button>
        </div>
      )}
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
