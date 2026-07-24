// M15-S13 (#284): one hidden YouTube IFrame player per audible link clip.
// display:none is spike-verified safe for uninterrupted audio-only playback
// (audio-hidden-playback-tauri-spike.md) — no off-screen-position hack
// needed. No autoplay gate for this tier (spike-verified unmuted autoplay
// works in Tauri's WebView2 without a prior user gesture).
import { useEffect, useRef } from 'react';
import { loadYoutubeIframeApi } from '../services/youtube-iframe-api';
import type { YoutubePlayer } from '../services/youtube-iframe-api';
import { parseYoutubeSource } from '../services/youtube-url';

export interface YoutubeClipPlayerProps {
  videoUrl: string;
  targetVolume: number;
  rampSeconds: number;
  loop: boolean;
  paused: boolean;
}

const RAMP_STEPS_PER_SECOND = 20;

export function YoutubeClipPlayer({ videoUrl, targetVolume, rampSeconds, loop, paused }: YoutubeClipPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  // Read by onReady, which can fire after `paused` has already changed —
  // without this a channel paused before the player finished loading would
  // still start playing once it became ready.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Local ramp state — never read back from the player. getVolume() lags one
  // tick behind setVolume() (spike finding), so the ramp must track its own
  // last-applied value instead of re-reading it from the IFrame API.
  const currentVolumeRef = useRef(0);
  const rampTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let player: YoutubePlayer | null = null;
    // YT.Player replaces the given element with its own iframe rather than
    // inserting inside it. Handing it a plain child we create and remove
    // ourselves — never the React-owned container div directly — keeps
    // React's reconciliation of that div consistent with the real DOM (same
    // "removeChild: node is not a child of this node" class of bug hit on
    // the Spotify tier, which uses the identical takes-over-the-element pattern).
    const mountPoint = document.createElement('div');
    containerRef.current?.appendChild(mountPoint);

    void loadYoutubeIframeApi().then((YT) => {
      if (cancelled) return;
      const source = parseYoutubeSource(videoUrl);
      player = new YT.Player(mountPoint, {
        videoId: source.videoId ?? undefined,
        playerVars: { autoplay: 1, controls: 0 },
        events: {
          onReady: (event) => {
            if (source.playlistId) event.target.loadPlaylist({ list: source.playlistId });
            event.target.setVolume(currentVolumeRef.current);
            if (!pausedRef.current) event.target.playVideo();
          },
          onStateChange: (event) => {
            if (loopRef.current && event.data === YT.PlayerState.ENDED) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      if (rampTimerRef.current) clearInterval(rampTimerRef.current);
      player?.destroy();
      playerRef.current = null;
      mountPoint.remove();
    };
    // A new videoUrl is a new clip/player — only remount on that, not on volume changes.
  }, [videoUrl]);

  useEffect(() => {
    const player = playerRef.current;
    if (rampTimerRef.current) { clearInterval(rampTimerRef.current); rampTimerRef.current = null; }

    if (rampSeconds <= 0) {
      currentVolumeRef.current = targetVolume;
      player?.setVolume(targetVolume);
      return;
    }

    const startVolume = currentVolumeRef.current;
    const totalSteps = Math.max(1, Math.round(rampSeconds * RAMP_STEPS_PER_SECOND));
    let step = 0;
    rampTimerRef.current = setInterval(() => {
      step += 1;
      const next = startVolume + ((targetVolume - startVolume) * step) / totalSteps;
      currentVolumeRef.current = next;
      player?.setVolume(Math.round(next));
      if (step >= totalSteps && rampTimerRef.current) {
        clearInterval(rampTimerRef.current);
        rampTimerRef.current = null;
      }
    }, 1000 / RAMP_STEPS_PER_SECOND);

    return () => {
      if (rampTimerRef.current) { clearInterval(rampTimerRef.current); rampTimerRef.current = null; }
    };
  }, [targetVolume, rampSeconds]);

  // Real pause/resume (unlike removing the slot): keeps this player mounted
  // so YouTube retains its own playback position.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (paused) player.pauseVideo(); else player.playVideo();
  }, [paused]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
}
