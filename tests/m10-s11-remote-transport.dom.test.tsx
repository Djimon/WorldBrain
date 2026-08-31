// @vitest-environment jsdom
// M10-S11 (#367) + #387: Integrationstest — echter Mount statt Source-Grep.
// Prüft dass PlayerJoinView den Broker-Adapter wirklich anschließt und die
// ConnectStates (connecting → connected / failed) von den echten Adapter-
// Callbacks getrieben werden. Seit #387 ist der Beitritt ein DB-LOSER
// Transport-Handshake: nach `onConnected` sendet die View `join_request`, und
// erst die `join_response` des Hosts (über onMessage) schaltet auf „Beigetreten".

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { JOIN_RESPONSE } from '../src/services/session-transport';
import type { TransportMessage } from '../src/services/session-transport';

// --- Mock reconnect-service: Token-Persistenz + Stored-Token-Check no-op ---
vi.mock('../src/services/reconnect-service', () => ({
  persistToken: vi.fn(async () => {}),
  getStoredToken: vi.fn(async () => null),
  listStoredTokens: vi.fn(async () => []),
  clearStoredToken: vi.fn(async () => {}),
}));

// --- Mock WebRtcTransport: Instanz-Level. attachSignaling triggert Test-
//     spezifisch onConnected/onError; onMessage fängt den Handler, damit der
//     Test die Host-`join_response` simulieren kann (#387-Handshake).
let attachSignalingImpl: (opts: {
  appId: string; roomId: string; peerLabel: 'A' | 'B';
  onConnected?: () => void;
  onError?: (err: Error) => void;
}) => Promise<void>;
let capturedOnMessage: ((msg: TransportMessage) => void) | null = null;

vi.mock('../src/services/webrtc-transport', () => ({
  WebRtcTransport: class {
    async connect() { /* no-op */ }
    async close() { /* no-op */ }
    async send() { /* no-op — join_request wird nicht real übertragen */ }
    onMessage(cb: (msg: TransportMessage) => void) { capturedOnMessage = cb; }
    async attachSignaling(opts: Parameters<typeof attachSignalingImpl>[0]) {
      return attachSignalingImpl(opts);
    }
    static host() { return new this(); }
  },
}));

import { PlayerJoinView } from '../src/ui/PlayerJoinView';

describe('M10-S11 PlayerJoinView integration', () => {
  beforeEach(() => {
    capturedOnMessage = null;
    attachSignalingImpl = async (opts) => {
      // Default: kein Callback — Test-spezifisch überschrieben.
      void opts;
    };
  });
  afterEach(() => cleanup());

  it('connecting → connected (join_request sent) → joined on host join_response', async () => {
    let firedOnConnected: (() => void) | null = null;
    attachSignalingImpl = async (opts) => {
      firedOnConnected = opts.onConnected ?? null;
    };

    render(<PlayerJoinView />);

    const codeInput = screen.getByPlaceholderText(/ABCD-EFGH/i);
    const nameInput = screen.getByPlaceholderText(/Alice/i);
    fireEvent.change(codeInput, { target: { value: 'wbrain://join?code=X&campaign=C1&ns=NS1' } });
    fireEvent.change(nameInput, { target: { value: 'Bob' } });

    fireEvent.click(screen.getByRole('button', { name: /Beitreten/i }));

    // AC: connecting-State sichtbar (Adapter-Handshake läuft, noch kein onConnected).
    await waitFor(() => {
      expect(screen.getByText(/Verbinde… \(bis 20 s\)/i)).toBeInTheDocument();
    });

    // Adapter-Callback feuert → View sendet join_request, zeigt „Verbunden".
    expect(firedOnConnected).not.toBeNull();
    firedOnConnected?.();
    await waitFor(() => {
      expect(screen.getByText(/^Verbunden$/i)).toBeInTheDocument();
    });

    // #387: erst die host-autoritative join_response schaltet auf „Beigetreten".
    expect(capturedOnMessage).not.toBeNull();
    capturedOnMessage?.({
      type: JOIN_RESPONSE,
      token: 'system-dm',
      payload: { ok: true, token: 'tok-1', playerId: 'p-1' },
    });
    // Post-join-View ist Panel mit aria-label="Beigetreten" — robust gegen
    // i18n-Interpolation im Fallback-Modus.
    await waitFor(() => {
      expect(screen.getByRole('status', { name: /Beigetreten/i })).toBeInTheDocument();
    });
  });

  it('connecting → failed when adapter fires onError (with retry button)', async () => {
    let firedOnError: ((err: Error) => void) | null = null;
    attachSignalingImpl = async (opts) => {
      firedOnError = opts.onError ?? null;
    };

    render(<PlayerJoinView />);
    fireEvent.change(screen.getByPlaceholderText(/ABCD-EFGH/i), {
      target: { value: 'wbrain://join?code=X&campaign=C1&ns=NS1' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Alice/i), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: /Beitreten/i }));

    await waitFor(() => expect(firedOnError).not.toBeNull());
    firedOnError?.(new Error('fake broker down'));

    await waitFor(() => {
      expect(screen.getByText(/Verbindung fehlgeschlagen/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Erneut versuchen/i })).toBeInTheDocument();
    });
  });

  it('missing ns parameter → failed with clear message, no adapter call', async () => {
    const calls: number[] = [];
    attachSignalingImpl = async () => { calls.push(1); };

    render(<PlayerJoinView />);
    fireEvent.change(screen.getByPlaceholderText(/ABCD-EFGH/i), {
      target: { value: 'wbrain://join?code=X&campaign=C1' }, // kein ns
    });
    fireEvent.change(screen.getByPlaceholderText(/Alice/i), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: /Beitreten/i }));

    await waitFor(() => {
      expect(screen.getByText(/unvollständig/i)).toBeInTheDocument();
    });
    expect(calls).toHaveLength(0);
  });
});
