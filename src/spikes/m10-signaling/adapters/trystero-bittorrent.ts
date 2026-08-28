// Trystero + BitTorrent-Tracker — dritte Fallback-Strategie. v0.25:
// eigenes Paket `@trystero-p2p/torrent` (`trystero/torrent` = deprecated).
import type { AdapterFactory } from '../types';
import { joinTrystero, reportTrysteroBrokerInfo } from './trystero-nostr';

export const trysteroBittorrentAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/torrent');
  await reportTrysteroBrokerInfo(mod, 'bittorrent', opts);
  return joinTrystero(mod.joinRoom, mod.getRelaySockets, opts);
};
