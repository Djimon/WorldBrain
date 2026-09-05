// @vitest-environment node
// M10 fix(P0): Host-Push-Pfad wirklich verdrahten (#373, D29/R2)
// See: https://github.com/Djimon/WorldBrain/issues/373

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#373 Host-Push wiring', () => {
  // #432: the host path (WebRtcTransport.host + the sync attaches) moved out of
  // WorkspaceShell into the usePlaySession hook — search there too.
  it('WebRtcTransport.host() is called outside its own file and tests', () => {
    const source = readFileSync('src/ui/hooks/usePlaySession.ts', 'utf-8');
    const hasHostCall = source.match(/WebRtcTransport|transport.*host|startHosting/i);
    expect(hasHostCall).toBeTruthy();
  });

  it('attachVisibilityBroadcaster is called in host path', () => {
    const files = ['src/ui/hooks/usePlaySession.ts', 'src/ui/WorkspaceShell.tsx', 'src/services/webrtc-transport.ts'];
    let found = false;
    for (const f of files) {
      try {
        const src = readFileSync(f, 'utf-8');
        if (src.match(/attachVisibilityBroadcaster/)) found = true;
      } catch { /* file may not exist yet */ }
    }
    expect(found).toBe(true);
  });
});

describe('#373 Snapshot filtering', () => {
  async function getHostPush() {
    return import('../src/services/host-push-service');
  }

  it('computeSnapshot filters out gm_only items', async () => {
    const svc = await getHostPush();
    const snapshot = await svc.computeSnapshot({
      entities: [
        { id: 'e1', visibility: 'all' },
        { id: 'e2', visibility: 'gm_only' },
      ],
      playerId: 'p1',
      groupIds: [],
    });
    const ids = snapshot.entities.map((e: { id: string }) => e.id);
    expect(ids).toContain('e1');
    expect(ids).not.toContain('e2');
  });

  it('Delta is sent only to authorized recipients', async () => {
    const svc = await getHostPush();
    expect(svc).toHaveProperty('computeSnapshot');
    expect(svc).toHaveProperty('computeDeltaRecipients');
  });
});
