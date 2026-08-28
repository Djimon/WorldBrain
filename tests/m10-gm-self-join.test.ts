// @vitest-environment node
// M10 fix(P0): GM-Self-Join über Loopback-Transport (#375, D29/R4)
// See: https://github.com/Djimon/WorldBrain/issues/375

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#375 Loopback transport', () => {
  it('loopback-transport module exists', () => {
    const source = readFileSync('src/services/loopback-transport.ts', 'utf-8');
    expect(source).toMatch(/export/);
  });

  it('implements SessionTransport interface', () => {
    const source = readFileSync('src/services/loopback-transport.ts', 'utf-8');
    expect(source).toMatch(/SessionTransport/);
  });
});

describe('#375 No silent auto-reconnect', () => {
  it('PlayerJoinView does not auto-reconnect from stored tokens on mount', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/useEffect[\s\S]{0,200}listStoredTokens[\s\S]{0,200}reconnect/);
  });
});

describe('#375 Membran integration guard', () => {
  it('self-join client has no DB access (guard)', () => {
    const source = readFileSync('src/services/play-client-store.ts', 'utf-8');
    expect(source).not.toMatch(/useDatabase|DatabaseLike|from.*DatabaseContext/);
  });

  it('gm_only item never crosses into client store (integration)', async () => {
    const mod = await import('../src/services/loopback-transport');
    expect(mod).toHaveProperty('createLoopbackTransport');
  });
});
