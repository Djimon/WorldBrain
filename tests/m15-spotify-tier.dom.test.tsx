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
    createController: (_el: HTMLElement, _opts: unknown, callback: (c: InstanceType<typeof FakeController>) => void) => {
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
    const { container } = render(<SpotifyClipPlayer uri="spotify:track:abc" />);
    await flush();
    expect((container.firstChild as HTMLElement).style.display).toBe('none');
    expect(FakeController.instances[0].calls.play).toBe(1);
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
    expect(container.querySelectorAll('[style]')).toHaveLength(1);
  });
});
