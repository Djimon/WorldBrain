// Subscribes to a SpotifyTierEngine's slots for one channel and renders one
// hidden SpotifyClipPlayer per currently-on clip. Mirrors YoutubeChannelPlayers.
import { useEffect, useState } from 'react';
import { SpotifyClipPlayer } from './SpotifyClipPlayer';
import type { SpotifySlot, SpotifyTierEngine } from '../services/spotify-tier-engine';

export interface SpotifyChannelPlayersProps {
  channelId: string;
  engine: SpotifyTierEngine;
}

export function SpotifyChannelPlayers({ channelId, engine }: SpotifyChannelPlayersProps) {
  const [slots, setSlots] = useState<SpotifySlot[]>(() => engine.getSlots(channelId));

  useEffect(() => {
    setSlots(engine.getSlots(channelId));
    return engine.subscribe((changedChannelId, nextSlots) => {
      if (changedChannelId === channelId) setSlots(nextSlots);
    });
  }, [channelId, engine]);

  return (
    <>
      {slots.map((slot) => <SpotifyClipPlayer key={slot.clipId} uri={slot.uri} paused={slot.paused} />)}
    </>
  );
}
