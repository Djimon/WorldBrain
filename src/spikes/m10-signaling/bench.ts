// Bench-Runner: 10 Cold-Starts pro Adapter, misst Erfolgsquote + Median-TTC.
// „Erfolg" = onOpen feuert UND ein Ping-Payload round-trippt < TIMEOUT_MS.
//
// Konvention: Der Bench läuft in ZWEI Fenstern parallel — Seite A klickt
// „Run 10", Seite B klickt „Run 10" mit dem gleichen roomId-Prefix; die
// Ergebnisse werden pro Seite geloggt (jede Seite sieht ihre eigenen Zahlen).
// Für die Matrix zählt: pro Cold-Start beide Seiten „Erfolg" → 1/10.

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
  | 'no-peer-joined'      // room joined, aber innerhalb TIMEOUT kein anderer Peer
  | 'peer-joined-no-ping' // Peer erschien, aber Ping-RTT kam nicht zurück
  | 'adapter-error'       // Adapter warf Exception oder onError feuerte
  | 'timeout-before-open' // nie ein open-Event, aber auch kein Fehler
  | 'not-auto-benchable'; // Adapter (manual-sdp) braucht User-Interaktion pro Attempt

export interface AttemptResult {
  attempt: number;
  success: boolean;
  timeToOpenMs: number | null;
  pingRttMs: number | null;
  failReason?: FailReason;
  error?: string;
  roomId: string;
  /** Broker-Sichtbarkeit: selfId, Relay-URLs, Socket-Zustände, Retry-Events. */
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

const TIMEOUT_MS = 10_000; // AC: < 10s (Verwerf-Schwelle)

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
  // Manual-SDP ist Copy/Paste — nicht auto-benchbar. Short-circuit mit klarer
  // Begründung statt N sinnlose Timeouts zu produzieren.
  if (adapter === 'manual-sdp') {
    const attempts: AttemptResult[] = [];
    for (let i = 1; i <= runCount; i++) {
      const r: AttemptResult = {
        attempt: i, success: false, timeToOpenMs: null, pingRttMs: null,
        failReason: 'not-auto-benchable',
        error: 'Manual SDP braucht Copy/Paste pro Attempt — nicht auto-benchbar. Für Verifizierung: 1× manuellen Test außerhalb der Bench fahren.',
        roomId: `${roomIdPrefix}-attempt-${i}`,
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
    // WICHTIG: roomId MUSS auf beiden Seiten IDENTISCH sein, sonst finden sich
    // die Peers nie. Deterministisch aus Prefix+Attempt-Index. Cold-Start-
    // Freshness kommt aus dem NEUEN factory()-Call (neuer RTCPeerConnection,
    // neuer joinRoom), nicht aus zufälliger roomId.
    const roomId = `${roomIdPrefix}-attempt-${i}`;
    await logWriter?.writeRaw(`\n--- attempt ${i}/${runCount} — roomId="${roomId}" ---`);
    console.log(`[bench] ${adapter} attempt ${i}/${runCount} — room=${roomId}`);
    const result = await runOneAttempt(factory, peerLabel, roomId, i, logWriter);
    console.log(`[bench] ${adapter} #${i}: success=${result.success}${result.failReason ? ` reason=${result.failReason}` : ''}${result.error ? ` err=${result.error}` : ''}`);
    await logWriter?.writeRaw(`--- result: ${result.success ? 'SUCCESS' : 'FAIL'} ttc=${result.timeToOpenMs}ms rtt=${result.pingRttMs}ms reason=${result.failReason ?? '-'} ---`);
    attempts.push(result);
    onProgress({ attempt: i, total: runCount, lastResult: result });
    // 500ms Pause zwischen Attempts — PeerJS-Broker (und Nostr-Relays)
    // brauchen Zeit zwischen close/register um dieselbe ID/Room sauber
    // freizugeben, sonst kollidiert der nächste Attempt mit dem vorigen.
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

  // Ping-Protokoll: {id, echo:false} = neuer Ping vom Sender.
  // {id, echo:true} = Reply des Peers. Nur wenn EIGENE id mit echo:true
  // zurückkommt, ist das ein echter Roundtrip (nicht bloß irgendein Traffic).
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
        // Payload kann strukturiert oder String sein (manual-sdp stringifiziert).
        // Nur JSON-Objekte mit {id, echo} interpretieren.
        const p = typeof payload === 'object' && payload !== null
          ? payload as { id?: string; echo?: boolean }
          : null;
        if (p?.id === undefined || typeof p.echo !== 'boolean') return;

        if (p.id === myPingId && p.echo === true) {
          // MEIN Ping ist zurück → echter Roundtrip.
          if (pingSentAt !== null && pingRtt === null) {
            pingRtt = performance.now() - pingSentAt;
          }
        } else if (p.echo === false) {
          // Ping vom anderen Peer → antworten mit echo:true.
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
  // Erfolg → keine Fehler-Historie mitschleppen. Recovery-Errors (z. B.
  // PeerJS retry-nach-`peer-unavailable`) sind kein User-facing Failure.
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
