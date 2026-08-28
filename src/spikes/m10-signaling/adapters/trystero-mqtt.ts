// Trystero + MQTT — Fallback-Strategie. v0.25: eigenes Paket
// `@trystero-p2p/mqtt` (`trystero/mqtt` wirft Deprecation-Error).
import type { AdapterFactory } from '../types';
import { joinTrystero, reportTrysteroBrokerInfo } from './trystero-nostr';

export const trysteroMqttAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/mqtt');
  await reportTrysteroBrokerInfo(mod, 'mqtt', opts);
  return joinTrystero(mod.joinRoom, mod.getRelaySockets, opts);
};
