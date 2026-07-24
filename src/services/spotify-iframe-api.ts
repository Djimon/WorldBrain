// Loads Spotify's public embed IFrame API once, globally. Spike-verified
// (audio-spotify-tauri-spike.md): loads and plays in Tauri's WebView2, but
// controller.setVolume is undefined — this tier is hard on/off only, no
// fade/mix/balance/EQ (confirmed dead end for real signal access without
// the OAuth+Premium Web Playback SDK, deliberately out of scope).
export interface SpotifyController {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seek(seconds: number): void;
  loadUri(uri: string): void;
  addListener(event: string, callback: (event: unknown) => void): void;
}

export interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string; height?: string },
    callback: (controller: SpotifyController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIframeApi) => void;
  }
}

let apiPromise: Promise<SpotifyIframeApi> | null = null;

export function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      console.debug('[spotify-iframe-api] IFrame API ready');
      resolve(IFrameAPI);
    };
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    // Previously silent: if this script never loads (blocked by network,
    // an ad-blocker, or WebView2 tracking prevention — seen live as
    // "Tracking Prevention blocked access to storage" for a Spotify URL),
    // the promise hung forever with zero signal. Reject explicitly instead.
    script.onerror = () => {
      console.error('[spotify-iframe-api] failed to load the Spotify IFrame API script (network blocked, or WebView2 tracking prevention)');
      reject(new Error('Failed to load Spotify IFrame API script'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}
