// M10-S05 (#354) + #387: „Campaign beitreten" — Auto-Join (D24) im Play-Modus,
// jetzt als DB-LOSER Transport-Handshake (D29). Der Player-Client hat KEINE
// Datenbank: Beitritt/Reconnect laufen als Nachrichten über den verbundenen
// Broker-Transport, nicht als lokale `joinWithCode`/`reconnect`-DB-Calls.
//
// Ablauf: Link/Code + Name → Transport per Signaling verbinden (Broker) → sobald
// verbunden `join_request { code, displayName }` senden → der HOST validiert
// gegen SEINE DB und antwortet `join_response { ok, token, playerId }` (+ Initial-
// Snapshot). Bei ok:true reichen wir den verbundenen Transport via onJoined hoch;
// die Shell speist damit den DB-losen Client-Store (D29-Feed).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WebRtcTransport } from '../services/webrtc-transport';
import {
  JOIN_REQUEST,
  RECONNECT_REQUEST,
  JOIN_RESPONSE,
  HANDSHAKE_TOKEN,
} from '../services/session-transport';
import type { TransportMessage, JoinResponsePayload } from '../services/session-transport';
import {
  clearStoredToken,
  listStoredTokens,
  persistToken,
} from '../services/reconnect-service';
import type { StoredToken } from '../services/reconnect-service';
import { Button, Field, Panel, StatusChip } from './primitives';

export interface PlayerJoinViewProps {
  /** Callback nach erfolgreichem Join (Token verfügbar) → S08 nimmt hier auf.
   *  `transport` (#386/#387): der verbundene Broker-Transport wird hochgereicht,
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

export function PlayerJoinView({ onJoined }: PlayerJoinViewProps) {
  const { t } = useTranslation('multiplayer');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  // Transport-Ref: bleibt über Renders erhalten damit close() beim Unmount klappt.
  const transportRef = useRef<WebRtcTransport | null>(null);
  // #387: Disposer für den Join-Handshake-Listener — nach erfolgreichem Join
  // abmelden, damit nur noch die Store-Bridge am Transport hängt.
  const joinDisposeRef = useRef<(() => void) | null>(null);
  // #387: welche Aktion der „Erneut versuchen"-Button wiederholen soll.
  const lastActionRef = useRef<'join' | 'reconnect'>('join');
  // #371 Fix 5: expliziter Reconnect (kein stiller Auto-Reconnect).
  const [storedTokenExists, setStoredTokenExists] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listStoredTokens().then((toks) => {
      if (!cancelled) setStoredTokenExists(toks.length > 0);
    });
    return () => { cancelled = true; };
  }, []);

  const canSubmit = code.trim() !== '' && displayName.trim() !== '' && !busy;

  /**
   * Baut den Broker-Transport, verbindet ihn per Signaling und schickt — sobald
   * der DataChannel offen ist — die Handshake-Nachricht. Die `join_response` des
   * Hosts läuft über `onMessage` in `onResponse`. Gemeinsame Basis von Join und
   * Reconnect (beide sind DB-los, nur die gesendete Nachricht unterscheidet sich).
   */
  async function connectAndHandshake(
    appId: string,
    roomId: string,
    buildRequest: () => TransportMessage,
    onResponse: (payload: JoinResponsePayload) => void,
  ): Promise<void> {
    // #387: alten Transport vor einem neuen Versuch schließen — sonst leaken
    // Broker-Sockets bei jedem Retry.
    const previous = transportRef.current;
    if (previous !== null) void previous.close();
    joinDisposeRef.current?.();
    const transport = new WebRtcTransport({ campaignId: roomId });
    transportRef.current = transport;
    // Host-Antwort entgegennehmen. Multi-Listener-Transport (#387): die Shell hängt
    // nach dem Join zusätzlich ihre Store-Bridge an; dieser Handler wird nach
    // erfolgreichem Join via joinDisposeRef abgemeldet.
    joinDisposeRef.current = transport.onMessage((msg: TransportMessage) => {
      if (msg.type === JOIN_RESPONSE) onResponse(msg.payload as unknown as JoinResponsePayload);
    });
    await transport.connect();
    await transport.attachSignaling({
      appId,
      roomId,
      peerLabel: 'B', // Joiner ist B (Answerer); Host ist A (Initiator).
      onConnected: () => {
        setConnectState('connected');
        void transport.send(buildRequest()).catch((err) => {
          setError(`${t('join.errorBroker', 'Verbindung zum Host fehlgeschlagen.')} — ${err instanceof Error ? err.message : String(err)}`);
          setConnectState('failed');
        });
      },
      onError: (err) => {
        setError(`${t('join.errorBroker', 'Verbindung zum Host fehlgeschlagen.')} — ${err.message}`);
        setConnectState('failed');
      },
    });
  }

  async function handleJoin() {
    setError(null);
    const parsed = parseInviteLink(code);
    const name = displayName.trim();
    if (parsed.appId === '') {
      // Kein `ns` im Link → alter/kaputter Link (kein Broker-Namespace).
      setError(t('join.errorMissingNs', 'Einladungslink unvollständig (fehlender Broker-Namespace).'));
      setConnectState('failed');
      return;
    }
    const rawCode = parsed.code !== '' ? parsed.code : code.trim();
    lastActionRef.current = 'join';
    setBusy(true);
    setConnectState('connecting');
    try {
      await connectAndHandshake(
        parsed.appId,
        parsed.campaign,
        () => ({
          type: JOIN_REQUEST,
          token: HANDSHAKE_TOKEN,
          payload: { code: rawCode, displayName: name },
        }),
        (payload) => { void applyJoinResponse(payload, name, parsed, rawCode); },
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('join.errorInvalid', 'Ungültiger Einladungscode oder Host nicht erreichbar.')} — ${raw}`);
      setConnectState('failed');
    } finally {
      setBusy(false);
    }
  }

  /** Verarbeitet die Host-Antwort auf einen `join_request`. */
  async function applyJoinResponse(
    payload: JoinResponsePayload,
    name: string,
    parsed: { code: string; campaign: string; appId: string },
    rawCode: string,
  ): Promise<void> {
    if (!payload.ok) {
      setError(t('join.errorRejected', 'Beitritt abgelehnt — ungültiger Einladungscode.'));
      setConnectState('failed');
      return;
    }
    // Token client-lokal für Reconnect vormerken (D10 — KEINE Welt-DB, nur die
    // Host-Referenz + Broker-Namespace, damit ein späterer Reconnect signalisieren kann).
    await persistToken({
      hostLabel: '',
      code: rawCode,
      token: payload.token,
      displayName: name,
      campaignName: parsed.campaign,
      playerId: payload.playerId,
      appId: parsed.appId,
      roomId: parsed.campaign,
    });
    setStoredTokenExists(true);
    setJoinedName(name);
    // Join-Handshake-Listener abmelden — ab jetzt hört nur noch die Store-Bridge
    // (die Shell hängt sie via onJoined an; der Snapshot wird ihr per Receive-
    // Replay nachgespielt, falls er vorher ankam).
    joinDisposeRef.current?.();
    joinDisposeRef.current = null;
    onJoined?.({
      token: payload.token,
      playerId: payload.playerId,
      displayName: name,
      transport: transportRef.current ?? undefined,
    });
  }

  /**
   * #371 Fix 5 / #387: expliziter, DB-loser Reconnect. Baut den Transport aus den
   * gespeicherten Broker-Daten (appId/roomId) neu auf und schickt ein
   * `reconnect_request { token }`; der Host bestätigt oder lehnt ab.
   */
  async function runReconnect() {
    setError(null);
    const stored = (await listStoredTokens())[0];
    if (!stored) return;
    if (stored.appId === undefined || stored.appId === '' || stored.roomId === undefined || stored.roomId === '') {
      // Alt-Token ohne Broker-Info (vor #387) — kein DB-loser Reconnect möglich.
      setError(t('join.errorReconnectNoLink', 'Frühere Sitzung ohne Verbindungsinfo — bitte über den Einladungslink neu beitreten.'));
      return;
    }
    lastActionRef.current = 'reconnect';
    setChecking(true);
    setConnectState('connecting');
    try {
      await connectAndHandshake(
        stored.appId,
        stored.roomId,
        () => ({
          type: RECONNECT_REQUEST,
          token: HANDSHAKE_TOKEN,
          payload: { token: stored.token },
        }),
        (payload) => { void applyReconnectResponse(payload, stored); },
      );
    } catch (e) {
      // Host nicht erreichbar → Token BLEIBT erhalten (späterer Retry, D10).
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('join.errorBroker', 'Verbindung zum Host fehlgeschlagen.')} — ${raw}`);
      setConnectState('failed');
    } finally {
      setChecking(false);
    }
  }

  /** Verarbeitet die Host-Antwort auf einen `reconnect_request`. */
  async function applyReconnectResponse(payload: JoinResponsePayload, stored: StoredToken): Promise<void> {
    if (!payload.ok) {
      // Host hat aktiv abgelehnt (gekickt/unbekannt) → Alt-Token verwerfen.
      await clearStoredToken(stored.token);
      setStoredTokenExists(false);
      setError(t('join.errorReconnectFailed', 'Frühere Sitzung ist nicht mehr gültig.'));
      setConnectState('failed');
      return;
    }
    setJoinedName(stored.displayName);
    joinDisposeRef.current?.();
    joinDisposeRef.current = null;
    onJoined?.({
      token: payload.token,
      playerId: payload.playerId,
      displayName: stored.displayName,
      transport: transportRef.current ?? undefined,
    });
  }

  /** „Erneut versuchen" wiederholt die ZULETZT versuchte Aktion (Join oder
   *  Reconnect) — nicht blind Join (#387 Review-Finding). */
  function retry() {
    if (lastActionRef.current === 'reconnect') void runReconnect();
    else void handleJoin();
  }

  // Transport beim Unmount aufräumen — sonst bleiben Broker-Sockets offen.
  useEffect(() => {
    return () => {
      const active = transportRef.current;
      if (active !== null) void active.close();
      joinDisposeRef.current?.();
    };
  }, []);

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
