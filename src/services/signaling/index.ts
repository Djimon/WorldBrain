// M10-S12 (#368): Signaling-Layer-Registry + Fallback-Orchestrator.
// Manueller SDP-Copy/Paste-Pfad wurde nie validiert (Spike #380) und ist im
// gesamten Layer gestrichen — keine UI-Panel-Hooks, kein entsprechender Adapter.
//
// Fallback-Reihenfolge: nostr → mqtt → bittorrent → peerjs
// BEIDE Peers müssen die identische Liste + identisches appId+roomId laufen —
// sonst landen sie auf verschiedenen Relays und finden sich nie.
import type { AdapterFactory, AdapterFactoryOpts, AdapterHandle, AdapterKey } from './types';
import { STRATEGY_ORDER } from './types';
import { nostrAdapter } from './nostr';
import { mqttAdapter } from './mqtt';
import { bittorrentAdapter } from './bittorrent';
import { peerjsAdapter } from './peerjs';

export type { AdapterFactory, AdapterFactoryOpts, AdapterHandle, AdapterKey } from './types';
export { STRATEGY_ORDER } from './types';

// Interface-Vertrag (siehe types.ts für die volle Definition):
//   AdapterFactoryOpts: { appId, roomId, peerLabel, onOpen, onMessage, onError, onDiagnostic? }
//   AdapterHandle: { send, close }

const ADAPTERS: Record<AdapterKey, AdapterFactory> = {
  nostr: nostrAdapter,
  mqtt: mqttAdapter,
  bittorrent: bittorrentAdapter,
  peerjs: peerjsAdapter,
};

/**
 * Registry: liefert einen konkreten Adapter für den gegebenen Key.
 * Wirft wenn der Key unbekannt ist — Aufrufer sollen `AdapterKey`-Typ nutzen.
 */
export async function createSignalingAdapter(
  key: AdapterKey,
  opts: AdapterFactoryOpts,
): Promise<AdapterHandle> {
  const factory = ADAPTERS[key];
  if (!factory) throw new Error(`Unknown signaling adapter: ${key}`);
  return factory(opts);
}

export interface FallbackOpts extends AdapterFactoryOpts {
  /** Zeitbudget pro Strategie (default 8s). Gesamtbudget = perStrategyMs × Kette. */
  perStrategyMs?: number;
  /** Optional: Reihenfolge überschreiben (nur für Tests). BEIDE Peers müssen gleich. */
  order?: AdapterKey[];
  /**
   * Injectable adapter-Factory für Tests — Default: `createSignalingAdapter`.
   * Ermöglicht Orchestrator-Testen (fake-fail / fake-success) ohne Real-Broker.
   */
  createAdapterFn?: (key: AdapterKey, opts: AdapterFactoryOpts) => Promise<AdapterHandle>;
}

/**
 * Fallback-Orchestrator: rückt bei fehlschlagender Strategie eine Stufe weiter.
 * „Fehlschlag" = Adapter feuert onError ODER kein onOpen innerhalb perStrategyMs.
 * Beide Peers müssen dieselbe Order laufen — sonst treffen sie sich nie.
 */
export async function connectWithFallback(opts: FallbackOpts): Promise<AdapterHandle> {
  const perStrategyMs = opts.perStrategyMs ?? 8000;
  const order = opts.order ?? STRATEGY_ORDER;
  const createFn = opts.createAdapterFn ?? createSignalingAdapter;
  let lastErr: Error | null = null;

  for (const key of order) {
    opts.onDiagnostic?.(`[orchestrator] trying strategy: ${key}`);
    try {
      const handle = await new Promise<AdapterHandle>((resolve, reject) => {
        let opened = false;
        let hopped: AdapterHandle | null = null;
        const timer = setTimeout(() => {
          if (!opened) {
            void hopped?.close();
            reject(new Error(`strategy ${key} timed out after ${perStrategyMs}ms`));
          }
        }, perStrategyMs);

        void createFn(key, {
          ...opts,
          onOpen: () => {
            opened = true;
            clearTimeout(timer);
            opts.onOpen();
            if (hopped !== null) resolve(hopped);
          },
          onError: (err) => {
            if (!opened) {
              clearTimeout(timer);
              reject(err);
            } else {
              opts.onError(err);
            }
          },
        }).then((h) => {
          hopped = h;
          if (opened) resolve(h);
        }, (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      opts.onDiagnostic?.(`[orchestrator] connected via ${key}`);
      return handle;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      opts.onDiagnostic?.(`[orchestrator] ${key} failed: ${lastErr.message} — next`);
    }
  }
  throw lastErr ?? new Error('all signaling strategies exhausted');
}
