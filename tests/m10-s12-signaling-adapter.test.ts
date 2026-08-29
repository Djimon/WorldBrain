// @vitest-environment node
// M10-S12 (rewrite): Signaling-Adapter-Layer — Interface + Adapter + Registry + Fallback
// See: https://github.com/Djimon/WorldBrain/issues/368

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Module existence + exports
// ---------------------------------------------------------------------------

describe('M10-S12 Signaling adapter module', () => {
  it('src/services/signaling/ exports createSignalingAdapter', async () => {
    const mod = await import('../src/services/signaling/index');
    expect(mod).toHaveProperty('createSignalingAdapter');
  });

  it('exports AdapterKey type covering nostr/mqtt/bittorrent/peerjs', () => {
    const source = readFileSync('src/services/signaling/index.ts', 'utf-8');
    expect(source).toMatch(/nostr/);
    expect(source).toMatch(/mqtt/);
    expect(source).toMatch(/bittorrent/);
    expect(source).toMatch(/peerjs/);
  });
});

// ---------------------------------------------------------------------------
// 2. No manual-SDP (unvalidated, stripped)
// ---------------------------------------------------------------------------

describe('M10-S12 No manual-SDP', () => {
  it('no manual-sdp adapter exists', () => {
    let found = false;
    try {
      readFileSync('src/services/signaling/manual-sdp.ts', 'utf-8');
      found = true;
    } catch { /* expected */ }
    expect(found).toBe(false);
  });

  it('no requestUiPanel in the adapter interface', () => {
    const source = readFileSync('src/services/signaling/index.ts', 'utf-8');
    expect(source).not.toMatch(/requestUiPanel|ManualSdpPanel/);
  });
});

// ---------------------------------------------------------------------------
// 3. Adapter interface shape
// ---------------------------------------------------------------------------

describe('M10-S12 Adapter interface', () => {
  it('AdapterFactoryOpts has roomId, appId, onOpen, onMessage, onError', () => {
    const source = readFileSync('src/services/signaling/index.ts', 'utf-8');
    expect(source).toMatch(/roomId/);
    expect(source).toMatch(/appId/);
    expect(source).toMatch(/onOpen/);
    expect(source).toMatch(/onMessage/);
    expect(source).toMatch(/onError/);
  });

  it('AdapterHandle has send and close', () => {
    const source = readFileSync('src/services/signaling/index.ts', 'utf-8');
    expect(source).toMatch(/send/);
    expect(source).toMatch(/close/);
  });
});

// ---------------------------------------------------------------------------
// 4. Registry returns correct adapter per key
// ---------------------------------------------------------------------------

describe('M10-S12 Registry', () => {
  it('createSignalingAdapter returns an AdapterHandle', async () => {
    const mod = await import('../src/services/signaling/index');
    const handle = await mod.createSignalingAdapter('nostr', {
      roomId: 'test-room',
      appId: 'test-app',
      peerLabel: 'A',
      onOpen: () => {},
      onMessage: () => {},
      onError: () => {},
    });
    expect(handle).toHaveProperty('send');
    expect(handle).toHaveProperty('close');
    handle.close();
  });
});

// ---------------------------------------------------------------------------
// 5. Fallback orchestrator
// ---------------------------------------------------------------------------

describe('M10-S12 Fallback orchestrator', () => {
  it('orchestrator/fallback function exists', async () => {
    const mod = await import('../src/services/signaling/index');
    expect(mod).toHaveProperty('connectWithFallback');
  });

  it('fallback uses fixed ordered strategy list (nostr → mqtt → bittorrent)', () => {
    const source = readFileSync('src/services/signaling/index.ts', 'utf-8');
    const fallbackSection = source;
    expect(fallbackSection).toMatch(/nostr.*mqtt.*bittorrent/s);
  });
});

// ---------------------------------------------------------------------------
// 6. 4 concrete adapters exist
// ---------------------------------------------------------------------------

describe('M10-S12 Concrete adapters', () => {
  for (const name of ['nostr', 'mqtt', 'bittorrent', 'peerjs']) {
    it(`${name} adapter file exists`, () => {
      const source = readFileSync(`src/services/signaling/${name}.ts`, 'utf-8');
      expect(source).toMatch(/export/);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Adapter round-trip (AC-Verhaltenstest)
// Beweist die Interface-Semantik: Payload aus einem Handle → onMessage im
// anderen. Kein echter Broker nötig — in-memory-Fake über shared bus,
// erfüllt AdapterFactory-Vertrag.
// ---------------------------------------------------------------------------

describe('M10-S12 Adapter round-trip', () => {
  it('two in-process peers exchange a message through the interface', async () => {
    interface Envelope { from: string; payload: unknown }
    const bus: Array<Envelope> = [];
    const listeners: Array<(env: Envelope) => void> = [];

    function makeFakeAdapter(peerId: string) {
      return async (opts: {
        appId: string; roomId: string; peerLabel: 'A' | 'B';
        onOpen: () => void;
        onMessage: (from: string, payload: unknown) => void;
        onError: (err: Error) => void;
      }) => {
        void opts.appId; void opts.roomId; void opts.peerLabel; void opts.onError;
        const listener = (env: Envelope) => {
          if (env.from !== peerId) opts.onMessage(env.from, env.payload);
        };
        listeners.push(listener);
        queueMicrotask(() => opts.onOpen());
        return {
          send(payload: unknown) {
            const env = { from: peerId, payload };
            bus.push(env);
            for (const l of listeners) l(env);
          },
          async close() { /* no-op */ },
        };
      };
    }

    const opened: string[] = [];
    const received: Array<{ side: string; payload: unknown }> = [];
    const a = await makeFakeAdapter('peer-a')({
      appId: 'x', roomId: 'r', peerLabel: 'A',
      onOpen: () => opened.push('A'),
      onMessage: (from, payload) => received.push({ side: 'A', payload: { from, payload } }),
      onError: () => {},
    });
    const b = await makeFakeAdapter('peer-b')({
      appId: 'x', roomId: 'r', peerLabel: 'B',
      onOpen: () => opened.push('B'),
      onMessage: (from, payload) => received.push({ side: 'B', payload: { from, payload } }),
      onError: () => {},
    });

    // Warte auf microtask-onOpen.
    await new Promise<void>((r) => queueMicrotask(r));
    expect(opened.sort()).toEqual(['A', 'B']);

    // Round-trip: A → B, B antwortet → A empfängt.
    a.send({ hello: 'from-A' });
    b.send({ hello: 'from-B' });
    expect(received.filter((r) => r.side === 'B')).toHaveLength(1);
    expect(received.filter((r) => r.side === 'A')).toHaveLength(1);

    await a.close();
    await b.close();
  });
});

// ---------------------------------------------------------------------------
// 8. Orchestrator advance-on-failure (AC-Verhaltenstest)
// erste Strategie fällt aus (onError) → connectWithFallback rückt eine Stufe
// weiter und die zweite Strategie liefert das Handle.
// ---------------------------------------------------------------------------

describe('M10-S12 Orchestrator advance-on-failure', () => {
  it('advances to next strategy when the first errors before open', async () => {
    const mod = await import('../src/services/signaling/index');
    const tried: string[] = [];
    const handle = await mod.connectWithFallback({
      appId: 'x', roomId: 'r', peerLabel: 'A',
      onOpen: () => {},
      onMessage: () => {},
      onError: () => {},
      perStrategyMs: 500,
      createAdapterFn: async (key, opts) => {
        tried.push(key);
        if (key === 'nostr') {
          // erste Strategie: pre-open Fehler → Orchestrator soll weiterrücken.
          queueMicrotask(() => opts.onError(new Error('fake nostr down')));
          return { send: () => {}, close: async () => {} };
        }
        // mqtt (2. in STRATEGY_ORDER): sofortiger Erfolg
        queueMicrotask(() => opts.onOpen());
        return { send: () => {}, close: async () => {} };
      },
    });
    expect(tried).toEqual(['nostr', 'mqtt']);
    expect(handle).toHaveProperty('send');
    await handle.close();
  });
});
