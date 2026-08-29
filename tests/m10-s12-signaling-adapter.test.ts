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
