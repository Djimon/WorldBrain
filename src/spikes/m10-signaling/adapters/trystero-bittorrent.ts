// Trystero + BitTorrent-Tracker — dritte Fallback-Strategie. v0.25:
// eigenes Paket `@trystero-p2p/torrent` (`trystero/torrent` = deprecated).
import type { AdapterFactory } from '../types';
import { joinTrystero } from './trystero-nostr';

export const trysteroBittorrentAdapter: AdapterFactory = async (opts) => {
  const { joinRoom } = await import('@trystero-p2p/torrent');
  return joinTrystero(joinRoom, opts);
};
