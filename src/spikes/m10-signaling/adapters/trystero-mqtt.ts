// Trystero + MQTT — Fallback-Strategie. v0.25: eigenes Paket
// `@trystero-p2p/mqtt` (`trystero/mqtt` wirft Deprecation-Error).
import type { AdapterFactory } from '../types';
import { joinTrystero } from './trystero-nostr';

export const trysteroMqttAdapter: AdapterFactory = async (opts) => {
  const { joinRoom } = await import('@trystero-p2p/mqtt');
  return joinTrystero(joinRoom, opts);
};
