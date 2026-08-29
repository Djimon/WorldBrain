// M10-S12 (#368): Trystero + BitTorrent-Tracker — zweiter Fallback (Spike 9/10).
// Trystero-Paket-Name: `@trystero-p2p/torrent`; interner AdapterKey bleibt
// semantisch „bittorrent" (das sind die Tracker).
import type { AdapterFactory } from './types';
import { joinTrystero } from './nostr';

export const bittorrentAdapter: AdapterFactory = async (opts) => {
  const mod = await import('@trystero-p2p/torrent');
  return joinTrystero(mod.joinRoom, opts);
};
