// M10-S05 (#354): „Campaign beitreten" — Auto-Join (D24) im Play-Modus.
// Ein Feld für Einladungslink/-Code + Anzeigename — der Link trägt die
// Rendezvous-Info selbst (Signaling-Details in S11/S12). Gültiger Code
// → sofort aktives Mitglied via session-identity-service, dann Übergang
// zur Charaktererstellung (S08 baut die Weiterleitung aus).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { joinWithCode } from '../services/session-identity-service';
import { WebRtcTransport } from '../services/webrtc-transport';
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
  /** Callback nach erfolgreichem Join (Token verfügbar) → S08 nimmt hier auf.
   *  `transport` (#386): der verbundene Broker-Transport wird hochgereicht,
   *  damit die Shell den DB-losen Client-Store daran anschließt (D29-Feed)
   *  und der Player Token-Bewegungs-Intents senden kann. */
  onJoined?: (result: { token: string; playerId: string; displayName: string; transport?: WebRtcTransport }) => void;
}

// S11 (#367): Connect-Flow-States für die Broker-Verbindung.
// idle       = User hat noch nichts gedrückt / gerade Formular offen
// connecting = Adapter läuft (Cold-Announce über Nostr-Relays kann bis ~20s dauern)
// connected  = onOpen gefeuert, Peer sitzt im Raum
// failed     = alle Fallback-Strategien erschöpft ODER NAT-Traversal gescheitert
export type ConnectState = 'idle' | 'connecting' | 'connected' | 'failed';

/**
 * Parst Einladungslinks der Form `wbrain://join?code=X&campaign=Y&ns=Z`.
 * `ns` = per-Host `appId` (Broker-Namespace, aus S11). Wenn kein `ns` im
 * Link ist, bleibt appId leer und der Adapter würde einen leeren Namespace
 * versuchen — dann konstruktiv scheitern.
 */
export function parseInviteLink(input: string): { code: string; campaign: string; appId: string } {
  const trimmed = input.trim();
  if (trimmed === '') return { code: '', campaign: '', appId: '' };
  try {
    const url = new URL(trimmed);
    return {
      code: url.searchParams.get('code') ?? '',
      campaign: url.searchParams.get('campaign') ?? '',
      appId: url.searchParams.get('ns') ?? '',
    };
  } catch {
    // Nackter Code (kein URL-Format) — S05 akzeptiert das.
    return { code: trimmed, campaign: '', appId: '' };
  }
}

export function PlayerJoinView({ database, onJoined }: PlayerJoinViewProps) {
  const { t } = useTranslation('multiplayer');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  // Transport-Ref: bleibt über Renders erhalten damit close() beim Unmount klappt.
  const transportRef = useRef<WebRtcTransport | null>(null);
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
    setConnectState('connecting');
    try {
      const parsed = parseInviteLink(code);
      const name = displayName.trim();
      // 1) Lokaler Token-Auth (kein Broker beteiligt).
      const result = await joinWithCode(database, {
        code: parsed.code !== '' ? parsed.code : code.trim(),
        displayName: name,
      });
      await persistToken({
        hostLabel: '',
        code: code.trim(),
        token: result.token,
        displayName: name,
        campaignName: parsed.campaign,
        playerId: result.playerId,
      });
      // 2) S11: echter Broker-Handshake. `ns` aus dem Link = appId (per-Host
      //    Namespace, unerratbar). ConnectState wird von den Adapter-
      //    Callbacks getrieben — kein Fassaden-connected mehr.
      if (parsed.appId !== '') {
        const transport = new WebRtcTransport({ campaignId: parsed.campaign });
        transportRef.current = transport;
        await transport.connect();
        await transport.attachSignaling({
          appId: parsed.appId,
          roomId: parsed.campaign,
          peerLabel: 'B', // Joiner ist B (Answerer); Host ist A (Initiator).
          onConnected: () => {
            setConnectState('connected');
            setJoinedName(name);
            // #386: den verbundenen Transport hochreichen → Shell speist Store.
            onJoined?.({ ...result, displayName: name, transport: transportRef.current ?? undefined });
          },
          onError: (err) => {
            setError(`${t('join.errorBroker', 'Verbindung zum Host fehlgeschlagen.')} — ${err.message}`);
            setConnectState('failed');
          },
        });
      } else {
        // Kein `ns` im Link → alter/kaputter Link. Warnung, Token bleibt gültig.
        setError(t('join.errorMissingNs', 'Einladungslink unvollständig (fehlender Broker-Namespace).'));
        setConnectState('failed');
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('join.errorInvalid', 'Ungültiger Einladungscode oder Host nicht erreichbar.')} — ${raw}`);
      setConnectState('failed');
    } finally {
      setBusy(false);
    }
  }

  // Transport beim Unmount aufräumen — sonst bleiben Broker-Sockets offen.
  useEffect(() => {
    return () => {
      const t = transportRef.current;
      if (t !== null) void t.close();
    };
  }, []);

  function retry() {
    void handleJoin();
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
      {connectState === 'connecting' && (
        <StatusChip tone="muted" role="status">
          {t('join.stateConnecting', 'Verbinde… (bis 20 s)')}
        </StatusChip>
      )}
      {connectState === 'connected' && (
        <StatusChip tone="success" role="status">
          {t('join.stateConnected', 'Verbunden')}
        </StatusChip>
      )}
      {connectState === 'failed' && (
        <div className="u-row u-gap-2">
          <StatusChip tone="failure" role="status">
            {t('join.stateFailed', 'Verbindung fehlgeschlagen — ist der Host online?')}
          </StatusChip>
          <Button size="compact" onClick={() => retry()}>
            {t('join.retry', 'Erneut versuchen')}
          </Button>
        </div>
      )}
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
