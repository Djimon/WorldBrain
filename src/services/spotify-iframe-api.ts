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

  apiPromise = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (IFrameAPI) => resolve(IFrameAPI);
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}
