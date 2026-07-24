// M15-S13 (#284): subscribes to a YoutubeTierEngine's slots for one channel
// and renders one hidden YoutubeClipPlayer per currently-audible link clip.
// Balance/EQ are intentionally absent from this component's props — a
// cross-origin YouTube IFrame exposes no Web Audio node, so those controls
// are inert for link clips (D2); the board UI (S14) renders them disabled.
import { useEffect, useState } from 'react';
import { YoutubeClipPlayer } from './YoutubeClipPlayer';
import type { YoutubeSlot, YoutubeTierEngine } from '../services/youtube-tier-engine';

export interface YoutubeChannelPlayersProps {
  channelId: string;
  engine: YoutubeTierEngine;
}

export function YoutubeChannelPlayers({ channelId, engine }: YoutubeChannelPlayersProps) {
  const [slots, setSlots] = useState<YoutubeSlot[]>(() => engine.getSlots(channelId));

  useEffect(() => {
    setSlots(engine.getSlots(channelId));
    return engine.subscribe((changedChannelId, nextSlots) => {
      if (changedChannelId === channelId) setSlots(nextSlots);
    });
  }, [channelId, engine]);

  return (
    <>
      {slots.map((slot) => (
        <YoutubeClipPlayer
          key={slot.clipId}
          videoUrl={slot.videoUrl}
          targetVolume={slot.targetVolume}
          rampSeconds={slot.rampSeconds}
          loop={slot.loop}
          paused={slot.paused}
        />
      ))}
    </>
  );
}
