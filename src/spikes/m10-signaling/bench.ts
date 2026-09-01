// Bench runner: 10 cold starts per adapter, measures success rate + median TTC.
// "Success" = onOpen fires AND a ping payload round-trips < TIMEOUT_MS.
//
// Convention: the bench runs in TWO windows in parallel — side A clicks
// "Run 10", side B clicks "Run 10" with the same roomId prefix; the
// results are logged per side (each side sees its own numbers).
// For the matrix what counts: per cold start both sides "success" → 1/10.

import type { AdapterFactory, AdapterKey } from './types';
import { trysteroNostrAdapter } from './adapters/trystero-nostr';
import { trysteroMqttAdapter } from './adapters/trystero-mqtt';
import { trysteroBittorrentAdapter } from './adapters/trystero-bittorrent';
import { peerjsAdapter } from './adapters/peerjs';
import { manualSdpAdapter } from './adapters/manual-sdp';
import type { LogWriter } from './log-writer';

export const APP_ID = 'wbx-m10-signaling-spike';

export const ADAPTERS: Record<AdapterKey, AdapterFactory> = {
  'trystero-nostr': trysteroNostrAdapter,
  'trystero-mqtt': trysteroMqttAdapter,
  'trystero-bittorrent': trysteroBittorrentAdapter,
  peerjs: peerjsAdapter,
  'manual-sdp': manualSdpAdapter,
};

export type FailReason =
  | 'no-peer-joined'      // room joined, but no other peer within TIMEOUT
  | 'peer-joined-no-ping' // peer appeared, but the ping RTT didn't come back
  | 'adapter-error'       // adapter threw an exception or onError fired
  | 'timeout-before-open' // never an open event, but also no error
  | 'not-auto-benchable'; // adapter (manual-sdp) needs user interaction per attempt

export interface AttemptResult {
  attempt: number;
  success: boolean;
  timeToOpenMs: number | null;
  pingRttMs: number | null;
  failReason?: FailReason;
  error?: string;
  roomId: string;
  /** Broker visibility: selfId, relay URLs, socket states, retry events. */
  diagnostics: string[];
}

export interface BenchResult {
  adapter: AdapterKey;
  peerLabel: 'A' | 'B';
  platform: string;
  attempts: AttemptResult[];
  successes: number;
  medianTtcMs: number | null;
  timestamp: string;
}

// Timeout: on a cold announce over Nostr the first attempt on a phone
// hotspot often takes more than 10s. 20s is the compromise between an "honest
// cold-start window" and "the user doesn't want to wait forever".
const TIMEOUT_MS = 20_000;

export interface BenchProgress {
  attempt: number;
  total: number;
  lastResult?: AttemptResult;
}

export async function runBench(
  adapter: AdapterKey,
  peerLabel: 'A' | 'B',
  roomIdPrefix: string,
  runCount: number,
  onProgress: (p: BenchProgress) => void,
  logWriter?: LogWriter,
): Promise<BenchResult> {
  await logWriter?.writeRaw(`\n=================================================================`);
  await logWriter?.writeRaw(`RUN: adapter=${adapter} peer=${peerLabel} roomIdPrefix="${roomIdPrefix}" runs=${runCount}`);
  await logWriter?.writeRaw(`     appId="${APP_ID}"`);
  await logWriter?.writeRaw(`=================================================================\n`);
  // Manual SDP is copy-paste — not auto-benchable. Short-circuit with a clear
  // reason instead of producing N pointless timeouts.
  if (adapter === 'manual-sdp') {
    const attempts: AttemptResult[] = [];
    for (let i = 1; i <= runCount; i++) {
      const r: AttemptResult = {
        attempt: i, success: false, timeToOpenMs: null, pingRttMs: null,
        failReason: 'not-auto-benchable',
        error: 'Manual SDP braucht Copy/Paste pro Attempt — nicht auto-benchbar. Für Verifizierung: 1× manuellen Test außerhalb der Bench fahren.',
        roomId: roomIdPrefix,
        diagnostics: [],
      };
      attempts.push(r);
      onProgress({ attempt: i, total: runCount, lastResult: r });
    }
    return {
      adapter, peerLabel, platform: navigator.userAgent, attempts,
      successes: 0, medianTtcMs: null, timestamp: new Date().toISOString(),
    };
  }

  const factory = ADAPTERS[adapter];
  const attempts: AttemptResult[] = [];
  for (let i = 1; i <= runCount; i++) {
    // IMPORTANT: roomId MUST be IDENTICAL on both sides, otherwise the peers
    // never find each other. Deterministic from prefix+attempt index. Cold-start
    // freshness comes from the NEW factory() call (new RTCPeerConnection,
    // new joinRoom), not from a random roomId.
    // 1-room mode: all attempts use the SAME room. Both peers join
    // the same room, order doesn't matter — cold-start freshness comes from
    // the NEW factory() call (fresh Trystero instance, new peer ID) not
    // from a changing roomId. This way time-offset starts also find each other.
    const roomId = roomIdPrefix;
    await logWriter?.writeRaw(`\n--- attempt ${i}/${runCount} — roomId="${roomId}" ---`);
    console.log(`[bench] ${adapter} attempt ${i}/${runCount} — room=${roomId}`);
    const result = await runOneAttempt(factory, peerLabel, roomId, i, logWriter);
    console.log(`[bench] ${adapter} #${i}: success=${result.success}${result.failReason ? ` reason=${result.failReason}` : ''}${result.error ? ` err=${result.error}` : ''}`);
    await logWriter?.writeRaw(`--- result: ${result.success ? 'SUCCESS' : 'FAIL'} ttc=${result.timeToOpenMs}ms rtt=${result.pingRttMs}ms reason=${result.failReason ?? '-'} ---`);
    attempts.push(result);
    onProgress({ attempt: i, total: runCount, lastResult: result });
    // 500ms pause between attempts — the PeerJS broker (and Nostr relays)
    // need time between close/register to cleanly release the same ID/room,
    // otherwise the next attempt collides with the previous one.
    if (i < runCount) await new Promise<void>((r) => setTimeout(r, 500));
  }
  const okTimes = attempts.filter((a) => a.success && a.timeToOpenMs !== null).map((a) => a.timeToOpenMs as number);
  const median = okTimes.length > 0 ? computeMedian(okTimes) : null;
  return {
    adapter,
    peerLabel,
    platform: navigator.userAgent,
    attempts,
    successes: attempts.filter((a) => a.success).length,
    medianTtcMs: median,
    timestamp: new Date().toISOString(),
  };
}

async function runOneAttempt(
  factory: AdapterFactory,
  peerLabel: 'A' | 'B',
  roomId: string,
  attempt: number,
  logWriter?: LogWriter,
): Promise<AttemptResult> {
  const started = performance.now();
  let openedAt: number | null = null;
  let pingSentAt: number | null = null;
  let pingRtt: number | null = null;
  let capturedError: Error | null = null;
  const diagnostics: string[] = [];
  const capture = (msg: string) => {
    const t = (performance.now() - started).toFixed(0);
    const line = `+${t}ms ${msg}`;
    diagnostics.push(line);
    void logWriter?.write(line);
  };

  // Ping protocol: {id, echo:false} = new ping from the sender.
  // {id, echo:true} = the peer's reply. Only when OUR OWN id comes back with
  // echo:true is it a real roundtrip (not just any traffic).
  const myPingId = Math.random().toString(36).slice(2);
  const pingSettled = new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (openedAt !== null && pingSentAt === null) {
        pingSentAt = performance.now();
        try { handle?.send({ id: myPingId, echo: false }); } catch { /* ignore */ }
      }
      if (pingRtt !== null) { clearInterval(check); resolve(); }
    }, 50);
    setTimeout(() => { clearInterval(check); resolve(); }, TIMEOUT_MS);
  });

  let handle: Awaited<ReturnType<AdapterFactory>> | null = null;
  try {
    handle = await factory({
      roomId,
      peerLabel,
      appId: APP_ID,
      onOpen: () => { openedAt = performance.now(); capture('adapter reports OPEN (peer joined)'); },
      onDiagnostic: capture,
      onMessage: (_from, payload) => {
        // Payload can be structured or a string (manual-sdp stringifies).
        // Only interpret JSON objects with {id, echo}.
        const p = typeof payload === 'object' && payload !== null
          ? payload as { id?: string; echo?: boolean }
          : null;
        if (p?.id === undefined || typeof p.echo !== 'boolean') return;

        if (p.id === myPingId && p.echo === true) {
          // MY ping is back → real roundtrip.
          if (pingSentAt !== null && pingRtt === null) {
            pingRtt = performance.now() - pingSentAt;
          }
        } else if (p.echo === false) {
          // Ping from the other peer → reply with echo:true.
          try { handle?.send({ id: p.id, echo: true }); } catch { /* ignore */ }
        }
      },
      onError: (err) => { capturedError = err; },
    });
    await pingSettled;
  } catch (e) {
    capturedError = e instanceof Error ? e : new Error(String(e));
  } finally {
    try { await handle?.close(); } catch { /* ignore */ }
  }

  const success = openedAt !== null && pingRtt !== null && (openedAt - started) < TIMEOUT_MS;
  let failReason: FailReason | undefined;
  if (!success) {
    if (capturedError !== null) failReason = 'adapter-error';
    else if (openedAt === null) failReason = 'no-peer-joined';
    else if (pingRtt === null) failReason = 'peer-joined-no-ping';
    else failReason = 'timeout-before-open';
  }
  // Success → don't carry along an error history. Recovery errors (e.g.
  // PeerJS retry-after-`peer-unavailable`) are not a user-facing failure.
  return {
    attempt,
    success,
    timeToOpenMs: openedAt !== null ? openedAt - started : null,
    pingRttMs: pingRtt,
    failReason: success ? undefined : failReason,
    error: success || capturedError === null ? undefined : (capturedError as Error).message,
    roomId,
    diagnostics,
  };
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
