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
  paused: boolean;
}

export function SpotifyClipPlayer({ uri, paused }: SpotifyClipPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  // Read by the ready callback, which can fire after `paused` has already
  // changed — without this a channel paused before the controller finished
  // loading would still start playing once it became ready.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let cancelled = false;
    // Spotify's createController takes over the given element (replaces its
    // contents, sometimes the element itself). Handing it a plain child we
    // create and remove ourselves — never the React-owned container div
    // directly — keeps React's own reconciliation of that div consistent
    // with the real DOM. Without this, unmounting threw "Failed to execute
    // 'removeChild' on 'Node': the node to be removed is not a child of
    // this node" once Spotify had mutated what React thought it still owned.
    const mountPoint = document.createElement('div');
    containerRef.current?.appendChild(mountPoint);
    console.debug('[SpotifyClipPlayer] mounting', { uri });

    void loadSpotifyIframeApi().then((IFrameAPI) => {
      if (cancelled) { console.debug('[SpotifyClipPlayer] IFrame API ready but already cancelled', { uri }); return; }
      IFrameAPI.createController(mountPoint, { uri, width: '1', height: '1' }, (controller) => {
        if (cancelled) { console.debug('[SpotifyClipPlayer] controller ready but already cancelled', { uri }); return; }
        controllerRef.current = controller;
        if (!pausedRef.current) {
          console.debug('[SpotifyClipPlayer] controller ready, calling play()', { uri });
          controller.play();
        } else {
          console.debug('[SpotifyClipPlayer] controller ready but channel is paused, not calling play()', { uri });
        }
      });
    }).catch((error: unknown) => {
      console.error('[SpotifyClipPlayer] failed to start playback', { uri, error });
    });

    return () => {
      cancelled = true;
      controllerRef.current?.pause();
      controllerRef.current = null;
      mountPoint.remove();
    };
  }, [uri]);

  // Real pause/resume (unlike removing the slot): keeps the embed controller
  // mounted so Spotify retains its own playback position.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (paused) controller.pause(); else controller.play();
  }, [paused]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}
