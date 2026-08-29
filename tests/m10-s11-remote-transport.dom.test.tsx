// @vitest-environment jsdom
// M10-S11 (#367): Integrationstest — echter Mount statt Source-Grep.
// Prüft dass PlayerJoinView den Broker-Adapter wirklich anschließt und
// die ConnectStates (connecting → connected / failed) von den echten
// Adapter-Callbacks getrieben werden, nicht als Fassade um lokale DB-Writes.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// --- Mock joinWithCode: liefert deterministischen Token, kein DB-I/O ---
vi.mock('../src/services/session-identity-service', () => ({
  joinWithCode: vi.fn(async () => ({ token: 'tok-1', playerId: 'p-1' })),
}));

// --- Mock reconnect-service: Token-Persistenz + Stored-Token-Check no-op ---
vi.mock('../src/services/reconnect-service', () => ({
  persistToken: vi.fn(async () => {}),
  listStoredTokens: vi.fn(async () => []),
  clearStoredToken: vi.fn(async () => {}),
  ping: vi.fn(async () => false),
  reconnect: vi.fn(async () => ({ success: false, reason: 'no_host' as const })),
}));

// --- Mock WebRtcTransport: Instanz-Level; attachSignaling triggert nach
//     kurzem Delay onConnected — dadurch prüfen wir die Bindung von
//     ConnectState an die echten Adapter-Callbacks.
let attachSignalingImpl: (opts: {
  appId: string; roomId: string; peerLabel: 'A' | 'B';
  onConnected?: () => void;
  onError?: (err: Error) => void;
}) => Promise<void>;

vi.mock('../src/services/webrtc-transport', () => ({
  WebRtcTransport: class {
    async connect() { /* no-op */ }
    async close() { /* no-op */ }
    async attachSignaling(opts: Parameters<typeof attachSignalingImpl>[0]) {
      return attachSignalingImpl(opts);
    }
    static host() { return new this(); }
  },
}));

import { PlayerJoinView } from '../src/ui/PlayerJoinView';

const database = {
  select: vi.fn(async () => [] as unknown[]),
  execute: vi.fn(async () => {}),
} as unknown as Parameters<typeof PlayerJoinView>[0]['database'];

describe('M10-S11 PlayerJoinView integration', () => {
  beforeEach(() => {
    attachSignalingImpl = async (opts) => {
      // Default: kein Callback — Test-spezifisch überschrieben.
      void opts;
    };
  });
  afterEach(() => cleanup());

  it('connecting → connected when adapter fires onConnected', async () => {
    let firedOnConnected: (() => void) | null = null;
    attachSignalingImpl = async (opts) => {
      firedOnConnected = opts.onConnected ?? null;
    };

    render(<PlayerJoinView database={database} />);

    const codeInput = screen.getByPlaceholderText(/ABCD-EFGH/i);
    const nameInput = screen.getByPlaceholderText(/Alice/i);
    fireEvent.change(codeInput, { target: { value: 'wbrain://join?code=X&campaign=C1&ns=NS1' } });
    fireEvent.change(nameInput, { target: { value: 'Bob' } });

    fireEvent.click(screen.getByRole('button', { name: /Beitreten/i }));

    // AC: connecting-State sichtbar (Adapter-Handshake läuft, noch kein onConnected).
    await waitFor(() => {
      expect(screen.getByText(/Verbinde… \(bis 20 s\)/i)).toBeInTheDocument();
    });

    // Adapter-Callback feuert → connected-State erwartet.
    // Der connected-Zustand wechselt die UI zur post-join-View („Beigetreten"),
    // die den Namen zeigt — das ist die sichtbare „connected"-Manifestation.
    expect(firedOnConnected).not.toBeNull();
    firedOnConnected?.();
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

    render(<PlayerJoinView database={database} />);
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

    render(<PlayerJoinView database={database} />);
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
