// Crude Spotify tier — one hidden embed controller per active clip. No
// volume/fade props exist (none possible, D2-equivalent for this tier):
// mounting = play, unmounting = pause. display:none is spike-verified safe
// for uninterrupted playback (audio-hidden-playback-tauri-spike.md covered
// both YouTube and Spotify embeds).
import { useEffect, useRef } from 'react';
import { loadSpotifyIframeApi } from '../services/spotify-iframe-api';
import type { SpotifyController } from '../services/spotify-iframe-api';

export interface SpotifyClipPlayerProps {
  uri: string;
}

export function SpotifyClipPlayer({ uri }: SpotifyClipPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSpotifyIframeApi().then((IFrameAPI) => {
      if (cancelled || !containerRef.current) return;
      IFrameAPI.createController(containerRef.current, { uri, width: '1', height: '1' }, (controller) => {
        if (cancelled) return;
        controllerRef.current = controller;
        controller.play();
      });
    });

    return () => {
      cancelled = true;
      controllerRef.current?.pause();
      controllerRef.current = null;
    };
  }, [uri]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}
