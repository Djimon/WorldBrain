// M10-S12 (#368): Trystero + MQTT — fallback strategy (Spike confirmed).
import type { AdapterFactory } from './types';
import { joinTrystero } from './nostr';

export const mqttAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/mqtt');
  return joinTrystero(mod.joinRoom, opts);
};
