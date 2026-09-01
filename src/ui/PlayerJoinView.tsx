// M10-S05 (#354) + #387: "Join campaign" — auto-join (D24) in play mode,
// now as a DB-LESS transport handshake (D29). The player client has NO
// database: join/reconnect run as messages over the connected
// broker transport, not as local `joinWithCode`/`reconnect` DB calls.
//
// Flow: link/code + name → connect the transport via signaling (broker) → once
// connected send `join_request { code, displayName }` → the HOST validates
// against ITS DB and replies `join_response { ok, token, playerId }` (+ initial
// snapshot). On ok:true we pass the connected transport up via onJoined;
// the shell feeds the DB-less client store with it (D29 feed).
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
  /** Callback after a successful join (token available) → S08 picks up here.
   *  `transport` (#386/#387): the connected broker transport is passed up,
   *  so the shell attaches the DB-less client store to it (D29 feed)
   *  and the player can send token movement intents. */
  onJoined?: (result: { token: string; playerId: string; displayName: string; transport?: WebRtcTransport }) => void;
}

// S11 (#367): connect-flow states for the broker connection.
// idle       = user hasn't pressed anything yet / form currently open
// connecting = adapter running (cold announce over Nostr relays can take up to ~20s)
// connected  = onOpen fired, peer is in the room
// failed     = all fallback strategies exhausted OR NAT traversal failed
export type ConnectState = 'idle' | 'connecting' | 'connected' | 'failed';

/**
 * Parses invite links of the form `wbrain://join?code=X&campaign=Y&ns=Z`.
 * `ns` = per-host `appId` (broker namespace, from S11). If there is no `ns` in
 * the link, appId stays empty and the adapter would try an empty namespace
 * — then fail by construction.
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
    // Bare code (not URL format) — S05 accepts that.
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
  // Transport ref: persists across renders so close() works on unmount.
  const transportRef = useRef<WebRtcTransport | null>(null);
  // #387: disposer for the join-handshake listener — unsubscribe after a
  // successful join, so only the store bridge remains attached to the transport.
  const joinDisposeRef = useRef<(() => void) | null>(null);
  // #387: which action the "Retry" button should repeat.
  const lastActionRef = useRef<'join' | 'reconnect'>('join');
  // #371 Fix 5: explicit reconnect (no silent auto-reconnect).
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
   * Builds the broker transport, connects it via signaling and sends — once
   * the DataChannel is open — the handshake message. The host's `join_response`
   * runs through `onMessage` into `onResponse`. Shared basis of join and
   * reconnect (both are DB-less, only the sent message differs).
   */
  async function connectAndHandshake(
    appId: string,
    roomId: string,
    buildRequest: () => TransportMessage,
    onResponse: (payload: JoinResponsePayload) => void,
  ): Promise<void> {
    // #387: close the old transport before a new attempt — otherwise broker
    // sockets leak on every retry.
    const previous = transportRef.current;
    if (previous !== null) void previous.close();
    joinDisposeRef.current?.();
    const transport = new WebRtcTransport({ campaignId: roomId });
    transportRef.current = transport;
    // Receive the host response. Multi-listener transport (#387): after the join the
    // shell additionally attaches its store bridge; this handler is unsubscribed
    // after a successful join via joinDisposeRef.
    joinDisposeRef.current = transport.onMessage((msg: TransportMessage) => {
      if (msg.type === JOIN_RESPONSE) onResponse(msg.payload as unknown as JoinResponsePayload);
    });
    await transport.connect();
    await transport.attachSignaling({
      appId,
      roomId,
      peerLabel: 'B', // the joiner is B (answerer); the host is A (initiator).
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
      // No `ns` in the link → old/broken link (no broker namespace).
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

  /** Handles the host response to a `join_request`. */
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
    // Note the token client-locally for reconnect (D10 — NO world DB, only the
    // host reference + broker namespace, so a later reconnect can signal).
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
    // Unsubscribe the join-handshake listener — from now on only the store bridge
    // listens (the shell attaches it via onJoined; the snapshot is replayed to it
    // via receive replay, if it arrived earlier).
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
   * #371 Fix 5 / #387: explicit, DB-less reconnect. Rebuilds the transport from the
   * stored broker data (appId/roomId) and sends a
   * `reconnect_request { token }`; the host confirms or rejects.
   */
  async function runReconnect() {
    setError(null);
    const stored = (await listStoredTokens())[0];
    if (!stored) return;
    if (stored.appId === undefined || stored.appId === '' || stored.roomId === undefined || stored.roomId === '') {
      // Old token without broker info (before #387) — no DB-less reconnect possible.
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
      // Host unreachable → the token is KEPT (later retry, D10).
      const raw = e instanceof Error ? e.message : String(e);
      setError(`${t('join.errorBroker', 'Verbindung zum Host fehlgeschlagen.')} — ${raw}`);
      setConnectState('failed');
    } finally {
      setChecking(false);
    }
  }

  /** Handles the host response to a `reconnect_request`. */
  async function applyReconnectResponse(payload: JoinResponsePayload, stored: StoredToken): Promise<void> {
    if (!payload.ok) {
      // Host actively rejected (kicked/unknown) → discard the old token.
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

  /** "Retry" repeats the LAST attempted action (join or
   *  reconnect) — not blindly join (#387 review finding). */
  function retry() {
    if (lastActionRef.current === 'reconnect') void runReconnect();
    else void handleJoin();
  }

  // Clean up the transport on unmount — otherwise broker sockets stay open.
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
      {/* #371 Fix 5: explicit reconnect instead of silently automatic. */}
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
