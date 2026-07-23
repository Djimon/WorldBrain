// M15-S13: YouTube-Tier — IFrame-Player pro Kanal (Volume/Fade/Loop/Mix)
// See: https://github.com/Djimon/WorldBrain/issues/284
//
// IFrame player is mocked (window.YT is not available in jsdom). Spike
// (audio-youtube-tauri-spike.md) already verified the real API in Tauri's
// WebView2 — this test only covers our own orchestration logic.

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YoutubeClipPlayer } from '../src/ui/YoutubeClipPlayer';
import { YoutubeChannelPlayers } from '../src/ui/YoutubeChannelPlayers';
import { YoutubeTierEngine } from '../src/services/youtube-tier-engine';
import { parseYoutubeSource } from '../src/services/youtube-url';

const { FakePlayer, PLAYER_STATE } = vi.hoisted(() => {
  class FakePlayer {
    static instances: FakePlayer[] = [];
    calls = { setVolume: [] as number[], playVideo: 0, seekTo: [] as Array<[number, boolean | undefined]>, loadPlaylist: [] as Array<{ list: string }>, destroy: 0 };
    options: { events?: { onReady?: (e: unknown) => void; onStateChange?: (e: unknown) => void }; videoId?: string };

    constructor(_el: HTMLElement, options: typeof FakePlayer.prototype.options) {
      this.options = options;
      FakePlayer.instances.push(this);
    }
    setVolume(v: number) { this.calls.setVolume.push(v); }
    playVideo() { this.calls.playVideo += 1; }
    pauseVideo() {}
    stopVideo() {}
    seekTo(s: number, allow?: boolean) { this.calls.seekTo.push([s, allow]); }
    mute() {}
    unMute() {}
    loadPlaylist(p: { list: string }) { this.calls.loadPlaylist.push(p); }
    destroy() { this.calls.destroy += 1; }
    triggerReady() { this.options.events?.onReady?.({ target: this, data: 0 }); }
    triggerEnded() { this.options.events?.onStateChange?.({ target: this, data: PLAYER_STATE.ENDED }); }
  }
  return { FakePlayer, PLAYER_STATE: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } };
});

vi.mock('../src/services/youtube-iframe-api', () => ({
  loadYoutubeIframeApi: () => Promise.resolve({ Player: FakePlayer, PlayerState: PLAYER_STATE }),
}));

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe('M15-S13 YouTube tier', () => {
  beforeEach(() => {
    FakePlayer.instances = [];
  });


  describe('parseYoutubeSource', () => {
    it('extracts a video id from a watch URL', () => {
      expect(parseYoutubeSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ', playlistId: null });
    });

    it('extracts a video id from a youtu.be short URL', () => {
      expect(parseYoutubeSource('https://youtu.be/dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ', playlistId: null });
    });

    it('extracts a playlist id alongside a video id — one clip, not decomposed', () => {
      expect(parseYoutubeSource('https://www.youtube.com/watch?v=abc&list=PLxyz')).toEqual({ videoId: 'abc', playlistId: 'PLxyz' });
    });
  });

  describe('YoutubeClipPlayer', () => {
    it('mounts a hidden IFrame player (display:none)', () => {
      const { container } = render(
        <YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc123" targetVolume={80} rampSeconds={0} loop={false} />,
      );
      expect((container.firstChild as HTMLElement).style.display).toBe('none');
    });

    it('volume (channel x base, already computed by the caller) maps to setVolume on ready', async () => {
      render(<YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc123" targetVolume={64} rampSeconds={0} loop={false} />);
      await flush();
      const player = FakePlayer.instances.at(-1)!;
      player.triggerReady();
      expect(player.calls.setVolume.at(-1)).toBe(64);
    });

    it('a playlist URL loads via loadPlaylist on the single mounted player', async () => {
      render(<YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc&list=PLxyz" targetVolume={50} rampSeconds={0} loop={false} />);
      await flush();
      const player = FakePlayer.instances.at(-1)!;
      player.triggerReady();
      expect(player.calls.loadPlaylist).toEqual([{ list: 'PLxyz' }]);
      expect(FakePlayer.instances).toHaveLength(1);
    });

    it('loop restarts the clip from the start on ENDED', async () => {
      render(<YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc123" targetVolume={50} rampSeconds={0} loop={true} />);
      await flush();
      const player = FakePlayer.instances.at(-1)!;
      player.triggerReady();
      player.triggerEnded();
      expect(player.calls.seekTo).toEqual([[0, true]]);
      expect(player.calls.playVideo).toBeGreaterThanOrEqual(2);
    });

    it('fade ramps setVolume progressively toward the target over rampSeconds', async () => {
      vi.useFakeTimers();
      try {
        const { rerender } = render(
          <YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc123" targetVolume={0} rampSeconds={0} loop={false} />,
        );
        await vi.advanceTimersByTimeAsync(0);
        const player = FakePlayer.instances.at(-1)!;
        player.triggerReady();

        rerender(<YoutubeClipPlayer videoUrl="https://www.youtube.com/watch?v=abc123" targetVolume={100} rampSeconds={2} loop={false} />);
        await vi.advanceTimersByTimeAsync(1000);
        const midway = player.calls.setVolume.length;
        expect(midway).toBeGreaterThan(0);

        await vi.advanceTimersByTimeAsync(1100);
        expect(player.calls.setVolume.length).toBeGreaterThan(midway);
        expect(player.calls.setVolume.at(-1)).toBe(100);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('YoutubeChannelPlayers (engine-driven, no balance/EQ controls)', () => {
    it('renders only hidden player containers — no balance/EQ inputs for link clips', async () => {
      const engine = new YoutubeTierEngine();
      engine.triggerClip('chan_1', { id: 'a', videoUrl: 'https://www.youtube.com/watch?v=abc', baseVolume: 1, loop: false },
        { volume: 1, muted: false, mode: 'replace', transitionType: 'cut', transitionSeconds: 2 });
      const { container } = render(<YoutubeChannelPlayers channelId="chan_1" engine={engine} />);
      await flush();
      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(container.querySelectorAll('[style]')).toHaveLength(1);
    });
  });

  describe('YoutubeTierEngine', () => {
    it('add mode: layers multiple clips simultaneously', () => {
      const engine = new YoutubeTierEngine();
      const mixer = { volume: 1, muted: false, mode: 'add' as const, transitionType: 'cut' as const, transitionSeconds: 2 };
      engine.triggerClip('chan_1', { id: 'a', videoUrl: 'https://youtu.be/a', baseVolume: 1, loop: false }, mixer);
      engine.triggerClip('chan_1', { id: 'b', videoUrl: 'https://youtu.be/b', baseVolume: 1, loop: false }, mixer);
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      expect(engine.isPlaying('chan_1', 'b')).toBe(true);
    });

    it('replace mode: clicking the already-playing clip again stops it instead of restarting it', () => {
      const engine = new YoutubeTierEngine();
      const mixer = { volume: 1, muted: false, mode: 'replace' as const, transitionType: 'cut' as const, transitionSeconds: 2 };
      const clip = { id: 'a', videoUrl: 'https://youtu.be/a', baseVolume: 1, loop: false };
      engine.triggerClip('chan_1', clip, mixer);
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      engine.triggerClip('chan_1', clip, mixer);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
    });

    it('replace mode + fade: outgoing player ramps to 0 immediately, then is removed after transitionSeconds; incoming ramps up', async () => {
      vi.useFakeTimers();
      try {
        const engine = new YoutubeTierEngine();
        const mixer = { volume: 1, muted: false, mode: 'replace' as const, transitionType: 'fade' as const, transitionSeconds: 2 };
        engine.triggerClip('chan_1', { id: 'a', videoUrl: 'https://youtu.be/a', baseVolume: 0.7, loop: false }, mixer);
        engine.triggerClip('chan_1', { id: 'b', videoUrl: 'https://youtu.be/b', baseVolume: 0.6, loop: false }, mixer);

        const outgoing = engine.getSlots('chan_1').find((s) => s.clipId === 'a');
        const incoming = engine.getSlots('chan_1').find((s) => s.clipId === 'b');
        expect(outgoing?.targetVolume).toBe(0);
        expect(incoming?.targetVolume).toBe(60);
        expect(engine.isPlaying('chan_1', 'a')).toBe(true); // still mounted, fading out

        await vi.advanceTimersByTimeAsync(2000);
        expect(engine.isPlaying('chan_1', 'a')).toBe(false);
        expect(engine.isPlaying('chan_1', 'b')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('muted silences all link players of the channel', () => {
      const engine = new YoutubeTierEngine();
      const mixer = { volume: 1, muted: false, mode: 'add' as const, transitionType: 'cut' as const, transitionSeconds: 2 };
      engine.triggerClip('chan_1', { id: 'a', videoUrl: 'https://youtu.be/a', baseVolume: 1, loop: false }, mixer);
      engine.triggerClip('chan_1', { id: 'b', videoUrl: 'https://youtu.be/b', baseVolume: 0.5, loop: false }, mixer);

      engine.updateChannelVolume('chan_1', { volume: 1, muted: true }, new Map([['a', 1], ['b', 0.5]]));
      expect(engine.getSlots('chan_1').every((s) => s.targetVolume === 0)).toBe(true);
    });

    it('a playlist clip creates exactly one slot — never decomposed', () => {
      const engine = new YoutubeTierEngine();
      engine.triggerClip('chan_1', { id: 'a', videoUrl: 'https://www.youtube.com/watch?v=abc&list=PLxyz', baseVolume: 1, loop: false },
        { volume: 1, muted: false, mode: 'add', transitionType: 'cut', transitionSeconds: 2 });
      expect(engine.getSlots('chan_1')).toHaveLength(1);
    });
  });
});
