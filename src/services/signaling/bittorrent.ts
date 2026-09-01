// M10-S12 (#368): Trystero + BitTorrent trackers — second fallback (Spike 9/10).
// Trystero package name: `@trystero-p2p/torrent`; the internal AdapterKey stays
// semantically "bittorrent" (those are the trackers).
import type { AdapterFactory } from './types';
import { joinTrystero } from './nostr';

export const bittorrentAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/torrent');
  return joinTrystero(mod.joinRoom, opts);
};
