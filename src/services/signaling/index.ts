// M10-S12 (#368): Signaling-layer registry + fallback orchestrator.
// The manual SDP copy/paste path was never validated (Spike #380) and is
// removed from the entire layer — no UI panel hooks, no corresponding adapter.
//
// Fallback order: nostr → mqtt → bittorrent → peerjs
// BOTH peers must run the identical list + identical appId+roomId —
// otherwise they land on different relays and never find each other.
import type { AdapterFactory, AdapterFactoryOpts, AdapterHandle, AdapterKey } from './types';
import { STRATEGY_ORDER } from './types';
import { nostrAdapter } from './nostr';
import { mqttAdapter } from './mqtt';
import { bittorrentAdapter } from './bittorrent';
import { peerjsAdapter } from './peerjs';

export type { AdapterFactory, AdapterFactoryOpts, AdapterHandle, AdapterKey } from './types';
export { STRATEGY_ORDER } from './types';

// Interface contract (see types.ts for the full definition):
//   AdapterFactoryOpts: { appId, roomId, peerLabel, onOpen, onMessage, onError, onDiagnostic? }
//   AdapterHandle: { send, close }

const ADAPTERS: Record<AdapterKey, AdapterFactory> = {
  nostr: nostrAdapter,
  mqtt: mqttAdapter,
  bittorrent: bittorrentAdapter,
  peerjs: peerjsAdapter,
};

/**
 * Registry: returns a concrete adapter for the given key.
 * Throws if the key is unknown — callers should use the `AdapterKey` type.
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
  /** Time budget per strategy (default 8s). Total budget = perStrategyMs × chain. */
  perStrategyMs?: number;
  /** Optional: override the order (tests only). BOTH peers must match. */
  order?: AdapterKey[];
  /**
   * Injectable adapter factory for tests — default: `createSignalingAdapter`.
   * Enables orchestrator testing (fake-fail / fake-success) without a real broker.
   */
  createAdapterFn?: (key: AdapterKey, opts: AdapterFactoryOpts) => Promise<AdapterHandle>;
}

/**
 * Fallback orchestrator: advances one step when a strategy fails.
 * "Failure" = the adapter fires onError OR no onOpen within perStrategyMs.
 * Both peers must run the same order — otherwise they never meet.
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
