// M10-D28 (#380) Spike-UI. Wegwerf-Harness — bewusst KEINE prod-Primitives,
// eigene minimal-CSS damit das Panel isoliert ist.
// Zwei Fenster gleichzeitig öffnen → in einem „Als A", im anderen „Als B" ausführen.
import { useEffect, useMemo, useState } from 'react';
import type { AdapterKey, ManualSdpPanel } from './types';
import { runBench, type BenchResult, type AttemptResult } from './bench';
import { createLogWriter, type LogWriter } from './log-writer';

const ADAPTER_LABELS: Record<AdapterKey, string> = {
  'trystero-nostr': 'Trystero / Nostr (Hypothese)',
  'trystero-mqtt': 'Trystero / MQTT (Fallback)',
  'trystero-bittorrent': 'Trystero / BitTorrent (Fallback)',
  peerjs: 'PeerJS-Cloud (alternativer Broker)',
  'manual-sdp': 'Manual SDP (Copy/Paste-Fallback)',
};

const CELL: React.CSSProperties = { padding: '4px 8px', border: '1px solid #333' };
const HEADER_CELL: React.CSSProperties = { ...CELL, background: '#222', fontWeight: 600 };

function initialPeerFromUrl(): 'A' | 'B' {
  try {
    const p = new URLSearchParams(window.location.search).get('peer');
    return p === 'B' ? 'B' : 'A';
  } catch { return 'A'; }
}

export function SignalingSpike(): React.ReactElement {
  const [adapter, setAdapter] = useState<AdapterKey>('trystero-nostr');
  const [peerLabel, setPeerLabel] = useState<'A' | 'B'>(initialPeerFromUrl);
  const [roomIdPrefix, setRoomIdPrefix] = useState('spike');
  const [runCount, setRunCount] = useState(10);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ attempt: number; total: number } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<AttemptResult | null>(null);
  const [results, setResults] = useState<BenchResult[]>([]);
  const [manualPanel, setManualPanel] = useState<ManualSdpPanel | null>(null);
  const [remoteBlob, setRemoteBlob] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [logWriter, setLogWriter] = useState<LogWriter | null>(null);
  const [logPath, setLogPath] = useState<string>('(init...)');

  const platform = useMemo(() => navigator.userAgent, []);

  // Log-Writer beim Mount pro Peer initialisieren — eine Datei pro Sitzung.
  useEffect(() => {
    let cancelled = false;
    void createLogWriter(peerLabel).then((w) => {
      if (cancelled) return;
      setLogWriter(w);
      setLogPath(w.getPath());
    });
    return () => { cancelled = true; };
  }, [peerLabel]);

  useEffect(() => {
    // Neuer Adapter → altes manual-Panel wegwerfen.
    setManualPanel(null);
    setRemoteBlob('');
  }, [adapter]);

  async function handleRun() {
    setRunning(true);
    setProgress({ attempt: 0, total: runCount });
    setLastAttempt(null);
    try {
      const res = await runBench(adapter, peerLabel, roomIdPrefix, runCount, (p) => {
        setProgress({ attempt: p.attempt, total: p.total });
        if (p.lastResult) setLastAttempt(p.lastResult);
      }, logWriter ?? undefined);
      setResults((prev) => [...prev, res]);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function handleCopyJson() {
    // Tauri-WebView blockt <a download>, aber clipboard geht überall.
    // Fürs Matrix-Ausfüllen willst du eh Copy → in research-Doc einfügen.
    const json = JSON.stringify(results, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    window.setTimeout(() => setCopyState('idle'), 1500);
  }

  return (
    <div style={{ padding: 20, color: '#eee', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0 }}>M10 Signaling-Spike (#380)</h1>
      <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5 }}>
        <strong style={{ color: '#fc8' }}>Wichtig:</strong> Beide Fenster (A + B) müssen <strong>gleichzeitig</strong> denselben Adapter fahren
        (Run auf beiden Seiten innerhalb ~1&nbsp;s klicken). Sonst sitzt eine Seite alleine im Raum und läuft ins Timeout.
        Gleicher RoomId-Prefix auf beiden Seiten. Für jeden Kandidaten × Plattform Erfolgsquote (x/N) + Median-Zeit in die Matrix übertragen.
      </div>

      <fieldset style={{ border: '1px solid #333', padding: 12 }}>
        <legend>Setup</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label>Adapter:{' '}
            <select value={adapter} onChange={(e) => setAdapter(e.target.value as AdapterKey)} disabled={running}>
              {(Object.keys(ADAPTER_LABELS) as AdapterKey[]).map((k) => (
                <option key={k} value={k}>{ADAPTER_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label>Peer:{' '}
            <select value={peerLabel} onChange={(e) => setPeerLabel(e.target.value as 'A' | 'B')} disabled={running}>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </label>
          <label>RoomId-Prefix:{' '}
            <input value={roomIdPrefix} onChange={(e) => setRoomIdPrefix(e.target.value)} disabled={running}
              style={{ background: '#111', color: '#eee', border: '1px solid #333', padding: '2px 6px' }} />
          </label>
          <label>Runs:{' '}
            <input type="number" min={1} max={100} value={runCount}
              onChange={(e) => setRunCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              disabled={running}
              style={{ background: '#111', color: '#eee', border: '1px solid #333', padding: '2px 6px', width: 60 }} />
          </label>
          <button onClick={() => void handleRun()} disabled={running}
            style={{ padding: '6px 14px', background: running ? '#333' : '#255', color: '#eee', border: 0, cursor: running ? 'wait' : 'pointer' }}>
            {running ? `läuft… (${progress?.attempt}/${progress?.total})` : `Run ${runCount} Cold-Start${runCount === 1 ? '' : 's'}`}
          </button>
          <button onClick={() => void handleCopyJson()} disabled={results.length === 0}
            style={{ padding: '6px 14px', background: '#333', color: '#eee', border: 0, cursor: results.length === 0 ? 'not-allowed' : 'pointer' }}>
            {copyState === 'ok' ? '✓ kopiert' : copyState === 'err' ? '✗ Clipboard-Fehler' : 'JSON kopieren'}
          </button>
        </div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Plattform (UA): {platform}</div>
        <div style={{ color: '#8fd', fontSize: 12, marginTop: 4 }}>
          <strong>Log-Datei:</strong> {logPath}
        </div>
      </fieldset>

      {adapter === 'manual-sdp' && manualPanel !== null && (
        <ManualSdpUi panel={manualPanel} remoteBlob={remoteBlob} onRemoteBlobChange={setRemoteBlob} />
      )}

      {lastAttempt && (
        <div style={{ padding: 8, background: '#1a1a1a', border: '1px solid #333' }}>
          Letzter Versuch #{lastAttempt.attempt}: <strong>{lastAttempt.success ? '✓ open' : '✗ fail'}</strong>
          {lastAttempt.timeToOpenMs !== null && ` · TTC ${lastAttempt.timeToOpenMs.toFixed(0)} ms`}
          {lastAttempt.pingRttMs !== null && ` · RTT ${lastAttempt.pingRttMs.toFixed(0)} ms`}
          {lastAttempt.failReason && ` · Grund: ${lastAttempt.failReason}`}
          {lastAttempt.error && ` · err: ${lastAttempt.error}`}
          <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>room: {lastAttempt.roomId}</div>
        </div>
      )}

      <h2 style={{ marginTop: 12 }}>Ergebnisse (diese Seite: {peerLabel})</h2>
      {results.length === 0 && <div style={{ color: '#888' }}>Noch keine Runs.</div>}
      {results.map((r, idx) => (
        <div key={idx} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{ADAPTER_LABELS[r.adapter]} · {r.timestamp}</div>
          <div style={{ margin: '4px 0' }}>
            Erfolgsquote: <strong>{r.successes}/{r.attempts.length}</strong>
            {r.medianTtcMs !== null && <> · Median TTC: <strong>{r.medianTtcMs.toFixed(0)} ms</strong></>}
          </div>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={HEADER_CELL}>#</th>
                <th style={HEADER_CELL}>ok</th>
                <th style={HEADER_CELL}>TTC ms</th>
                <th style={HEADER_CELL}>RTT ms</th>
                <th style={HEADER_CELL}>Grund</th>
                <th style={HEADER_CELL}>Fehler-Detail</th>
                <th style={HEADER_CELL}>Broker-Log</th>
              </tr>
            </thead>
            <tbody>
              {r.attempts.map((a) => (
                <tr key={a.attempt}>
                  <td style={CELL}>{a.attempt}</td>
                  <td style={{ ...CELL, color: a.success ? '#8f8' : '#f88' }}>{a.success ? 'ja' : 'nein'}</td>
                  <td style={CELL}>{a.timeToOpenMs?.toFixed(0) ?? '—'}</td>
                  <td style={CELL}>{a.pingRttMs?.toFixed(0) ?? '—'}</td>
                  <td style={CELL}>{a.failReason ?? ''}</td>
                  <td style={CELL}>{a.error ?? ''}</td>
                  <td style={CELL}>
                    {a.diagnostics.length === 0 ? '—' : (
                      <details>
                        <summary style={{ cursor: 'pointer' }}>{a.diagnostics.length} Zeilen</summary>
                        <pre style={{ margin: 0, marginTop: 6, fontSize: 11, whiteSpace: 'pre-wrap', maxWidth: 600, background: '#0d0d0d', padding: 6, border: '1px solid #222' }}>
                          {a.diagnostics.join('\n')}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ManualSdpUi({ panel, remoteBlob, onRemoteBlobChange }: {
  panel: ManualSdpPanel;
  remoteBlob: string;
  onRemoteBlobChange: (v: string) => void;
}): React.ReactElement {
  return (
    <fieldset style={{ border: '1px solid #642', padding: 12 }}>
      <legend>Manual SDP — Rolle: {panel.role}</legend>
      <div style={{ marginBottom: 8 }}>Lokaler Blob (kopieren an andere Seite):</div>
      <textarea readOnly value={panel.localBlob} rows={4}
        style={{ width: '100%', background: '#111', color: '#eee', border: '1px solid #333' }} />
      <div style={{ margin: '8px 0' }}>Remote-Blob (von anderer Seite paste, dann Bestätigen):</div>
      <textarea value={remoteBlob} onChange={(e) => onRemoteBlobChange(e.target.value)} rows={4}
        style={{ width: '100%', background: '#111', color: '#eee', border: '1px solid #333' }} />
      <button onClick={() => panel.onRemoteBlob(remoteBlob)}
        style={{ marginTop: 8, padding: '6px 14px', background: '#333', color: '#eee', border: 0 }}>Bestätigen</button>
    </fieldset>
  );
}
