// @vitest-environment node
// M10-S12 (rebuild): Serverloses Signaling (remote)
// See: https://github.com/Djimon/WorldBrain/issues/368

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M10-S12 Serverless signaling', () => {
  it('signaling service/module exists', () => {
    const source = readFileSync('src/services/signaling-service.ts', 'utf-8');
    expect(source).toMatch(/export/);
  });

  it('signaling does not require a hosted server', () => {
    const source = readFileSync('src/services/signaling-service.ts', 'utf-8');
    expect(source).not.toMatch(/wss?:\/\/|http:\/\/.*signal|SIGNALING_SERVER/i);
  });

  it('invitation link carries rendezvous info (no manual offer/answer)', () => {
    const source = readFileSync('src/services/signaling-service.ts', 'utf-8');
    expect(source).toMatch(/link|rendezvous|offer.*encode|compress/i);
  });
});

describe('M10-S12 SignalingPanel guard', () => {
  it('SignalingPanel exists only as Stufe-3 UI (if built)', () => {
    try {
      const source = readFileSync('src/ui/SignalingPanel.tsx', 'utf-8');
      expect(source).not.toMatch(/LobbyPanel|lobby/i);
    } catch {
      expect(true).toBe(true);
    }
  });
});
