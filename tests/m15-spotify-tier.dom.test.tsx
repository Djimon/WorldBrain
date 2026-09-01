// Crude Spotify tier — user-requested add-on to EPIC-024's audio soundboard.
// Epic + spike (audio-spotify-tauri-spike.md) explicitly deferred a real
// Spotify tier ("not V1") because the public embed has no setVolume at
// all — this is a hard on/off tier only, no fade/mix/balance/EQ.

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpotifyClipPlayer } from '../src/ui/SpotifyClipPlayer';
import { SpotifyChannelPlayers } from '../src/ui/SpotifyChannelPlayers';
import { SpotifyTierEngine } from '../src/services/spotify-tier-engine';
import { parseSpotifyUri } from '../src/services/spotify-uri';

const { FakeController } = vi.hoisted(() => {
  class FakeController {
    static instances: FakeController[] = [];
    calls = { play: 0, pause: 0 };
    constructor() { FakeController.instances.push(this); }
    play() { this.calls.play += 1; }
    pause() { this.calls.pause += 1; }
    togglePlay() {}
    seek() {}
    loadUri() {}
    addListener() {}
  }
  return { FakeController };
});

vi.mock('../src/services/spotify-iframe-api', () => ({
  loadSpotifyIframeApi: () => Promise.resolve({
    // Real Spotify replaces the given element with a loading="lazy" iframe
    // (confirmed against Spotify's own docs and a live devtools capture) —
    // mirror that here, since a mock that just invokes the callback without
    // touching the DOM can't catch a regression in how we handle that iframe.
    createController: (el: HTMLElement, _opts: unknown, callback: (c: InstanceType<typeof FakeController>) => void) => {
      const iframe = document.createElement('iframe');
      iframe.loading = 'lazy';
      el.replaceWith(iframe);
      callback(new FakeController());
    },
  }),
}));

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  FakeController.instances = [];
});

describe('parseSpotifyUri', () => {
  it('passes through an already-canonical URI', () => {
    expect(parseSpotifyUri('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
  });

  it('normalizes an open.spotify.com track URL to a URI', () => {
    expect(parseSpotifyUri('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
  });

  it('normalizes a locale-prefixed URL (/intl-de/track/ID) — reported bug', () => {
    expect(parseSpotifyUri('https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC')).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
  });

  it('normalizes a playlist URL', () => {
    expect(parseSpotifyUri('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
  });

  it('returns null for an unrelated URL', () => {
    expect(parseSpotifyUri('https://example.com/track/x')).toBeNull();
  });
});

describe('SpotifyClipPlayer', () => {
  it('mounts a hidden embed controller and calls play', async () => {
    const { container } = render(<SpotifyClipPlayer uri="spotify:track:abc" paused={false} />);
    await flush();
    // Hiding moved from an inline style to the u-hidden utility class (.u-hidden { display: none }).
    expect((container.firstChild as HTMLElement).classList.contains('u-hidden')).toBe(true);
    expect(FakeController.instances[0].calls.play).toBe(1);
  });

  it('forces the replaced iframe to load eagerly — regression: nested inside a permanently display:none container, a loading="lazy" iframe never intersects the viewport, so it never navigates past about:blank and controller.play() silently does nothing', async () => {
    const { container } = render(<SpotifyClipPlayer uri="spotify:track:abc" paused={false} />);
    await flush();
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe!.loading).toBe('eager');
  });

  describe('paused prop (real pause/resume, keeps the controller mounted)', () => {
    it('calls pause() when paused flips to true, play() when it flips back', async () => {
      const { rerender } = render(<SpotifyClipPlayer uri="spotify:track:abc" paused={false} />);
      await flush();
      const controller = FakeController.instances.at(-1)!;
      expect(controller.calls.play).toBe(1);

      rerender(<SpotifyClipPlayer uri="spotify:track:abc" paused={true} />);
      expect(controller.calls.pause).toBe(1);

      rerender(<SpotifyClipPlayer uri="spotify:track:abc" paused={false} />);
      expect(controller.calls.play).toBe(2);
    });

    it('does not call play() once the controller is ready if the channel is already paused', async () => {
      render(<SpotifyClipPlayer uri="spotify:track:abc" paused={true} />);
      await flush();
      const controller = FakeController.instances.at(-1)!;
      expect(controller.calls.play).toBe(0);
    });
  });
});

describe('loadSpotifyIframeApi (real implementation — script load failure)', () => {
  it('rejects instead of hanging forever if the API script fails to load', async () => {
    // Previously silent: no onerror handler at all meant a blocked script
    // (network, ad-blocker, or WebView2 tracking prevention — seen live as
    // "Tracking Prevention blocked access to storage" for a Spotify URL)
    // left the promise pending forever, with zero signal anywhere.
    const { loadSpotifyIframeApi } = await vi.importActual<typeof import('../src/services/spotify-iframe-api')>('../src/services/spotify-iframe-api');
    const promise = loadSpotifyIframeApi();
    const script = document.head.querySelector('script[src*="spotify"]') as HTMLScriptElement | null;
    expect(script).toBeTruthy();
    script?.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toThrow();
  });
});

describe('SpotifyTierEngine', () => {
  it('add mode: layers multiple clips simultaneously', () => {
    const engine = new SpotifyTierEngine();
    const mixer = { mode: 'add' as const };
    engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, mixer);
    engine.triggerClip('chan_1', { id: 'b', uri: 'spotify:track:b' }, mixer);
    expect(engine.isPlaying('chan_1', 'a')).toBe(true);
    expect(engine.isPlaying('chan_1', 'b')).toBe(true);
  });

  it('replace mode: starting a new clip stops the previous one', () => {
    const engine = new SpotifyTierEngine();
    const mixer = { mode: 'replace' as const };
    engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, mixer);
    engine.triggerClip('chan_1', { id: 'b', uri: 'spotify:track:b' }, mixer);
    expect(engine.isPlaying('chan_1', 'a')).toBe(false);
    expect(engine.isPlaying('chan_1', 'b')).toBe(true);
  });

  it('clicking the already-playing clip again stops it (hard on/off toggle)', () => {
    const engine = new SpotifyTierEngine();
    const mixer = { mode: 'replace' as const };
    const clip = { id: 'a', uri: 'spotify:track:a' };
    engine.triggerClip('chan_1', clip, mixer);
    expect(engine.isPlaying('chan_1', 'a')).toBe(true);
    engine.triggerClip('chan_1', clip, mixer);
    expect(engine.isPlaying('chan_1', 'a')).toBe(false);
  });

  it('stopChannel clears every clip on a channel', () => {
    const engine = new SpotifyTierEngine();
    engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, { mode: 'add' });
    engine.triggerClip('chan_1', { id: 'b', uri: 'spotify:track:b' }, { mode: 'add' });
    engine.stopChannel('chan_1');
    expect(engine.getSlots('chan_1')).toEqual([]);
  });

  it('SpotifyChannelPlayers renders one hidden player per active slot, no volume controls', async () => {
    const engine = new SpotifyTierEngine();
    engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, { mode: 'add' });
    const { container } = render(<SpotifyChannelPlayers channelId="chan_1" engine={engine} />);
    await flush();
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('.u-hidden')).toHaveLength(1);
  });

  describe('pauseChannel/resumeChannel (real pause — unlike stopChannel, the slot stays)', () => {
    it('pauseChannel marks every slot paused; isPlaying becomes false but the slot is still there', () => {
      const engine = new SpotifyTierEngine();
      engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, { mode: 'add' });

      engine.pauseChannel('chan_1');
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(engine.getSlots('chan_1')).toHaveLength(1);
      expect(engine.getSlots('chan_1')[0].paused).toBe(true);
    });

    it('resumeChannel un-pauses every slot', () => {
      const engine = new SpotifyTierEngine();
      engine.triggerClip('chan_1', { id: 'a', uri: 'spotify:track:a' }, { mode: 'add' });
      engine.pauseChannel('chan_1');

      engine.resumeChannel('chan_1');
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      expect(engine.getSlots('chan_1')[0].paused).toBe(false);
    });
  });
});
