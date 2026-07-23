// M15-S13 (#284): loads the YouTube IFrame Player API script once (global,
// shared by every clip player in the soundboard window) and resolves once
// window.YT is ready. Spike-verified (audio-youtube-tauri-spike.md): loads
// and plays in Tauri's WebView2 with no CSP/referrer issues, no autoplay
// gate needed for this tier.
export interface YoutubePlayerEvent {
  target: YoutubePlayer;
  data: number;
}

export interface YoutubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  loadPlaylist(params: { list: string }): void;
  destroy(): void;
}

export interface YoutubePlayerOptions {
  videoId?: string;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (event: YoutubePlayerEvent) => void;
    onStateChange?: (event: YoutubePlayerEvent) => void;
  };
}

export interface YoutubeIframeApi {
  Player: new (element: HTMLElement, options: YoutubePlayerOptions) => YoutubePlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YoutubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YoutubeIframeApi> | null = null;

export function loadYoutubeIframeApi(): Promise<YoutubeIframeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT as YoutubeIframeApi);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}
