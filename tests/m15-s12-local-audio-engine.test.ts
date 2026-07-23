// @vitest-environment node
// M15-S12: Local audio engine — channel strip (gain->balance->3-band EQ->master)
// See: https://github.com/Djimon/WorldBrain/issues/283
//
// Web Audio is mocked — no real playback in CI (per AC). The mock instruments
// every node factory on the context so tests can assert graph wiring and gain
// ramp calls without a real audio backend.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAudioEngine } from '../src/services/local-audio-engine';
import type { ChannelMixerConfig, ClipConfig } from '../src/services/local-audio-engine';

class MockAudioParam {
  value = 0;
  events: Array<{ type: string; value: number; time: number }> = [];
  setValueAtTime(value: number, time: number) { this.value = value; this.events.push({ type: 'setValueAtTime', value, time }); return this; }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.events.push({ type: 'linearRampToValueAtTime', value, time }); return this; }
  cancelScheduledValues(time: number) { this.events.push({ type: 'cancelScheduledValues', value: 0, time }); return this; }
}

class MockAudioNode {
  connections: MockAudioNode[] = [];
  connect(dest: MockAudioNode) { this.connections.push(dest); return dest; }
  disconnect() { this.connections = []; }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
  constructor() { super(); this.gain.value = 1; }
}

class MockStereoPannerNode extends MockAudioNode {
  pan = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = '';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  gain = new MockAudioParam();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  stopTime: number | null = null;
  start() { this.started = true; }
  stop(time?: number) { this.stopped = true; this.stopTime = time ?? 0; }
}

class MockAudioContext {
  currentTime = 0;
  destination = new MockAudioNode();
  gainNodes: MockGainNode[] = [];
  pannerNodes: MockStereoPannerNode[] = [];
  biquadNodes: MockBiquadFilterNode[] = [];
  bufferSources: MockAudioBufferSourceNode[] = [];

  createGain() { const n = new MockGainNode(); this.gainNodes.push(n); return n; }
  createStereoPanner() { const n = new MockStereoPannerNode(); this.pannerNodes.push(n); return n; }
  createBiquadFilter() { const n = new MockBiquadFilterNode(); this.biquadNodes.push(n); return n; }
  createBufferSource() { const n = new MockAudioBufferSourceNode(); this.bufferSources.push(n); return n; }
  decodeAudioData(): Promise<unknown> { return Promise.resolve({}); }
}

function makeEngine() {
  const context = new MockAudioContext();
  const engine = new LocalAudioEngine(context as unknown as AudioContext);
  return { context, engine };
}

function mixer(overrides: Partial<ChannelMixerConfig> = {}): ChannelMixerConfig {
  return {
    volume: 1, balance: 0, eqLow: 0, eqMid: 0, eqHigh: 0, muted: false,
    mode: 'replace', transitionType: 'cut', transitionSeconds: 2,
    ...overrides,
  };
}

function clip(overrides: Partial<ClipConfig> = {}): ClipConfig {
  return { id: 'clip_a', sourceUrl: 'asset://rain.mp3', baseVolume: 0.8, loop: false, ...overrides };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })));
});

describe('M15-S12 local audio engine', () => {
  it('wires master gain to the AudioContext destination on construction', () => {
    const { context } = makeEngine();
    const master = context.gainNodes[0];
    expect(master.connections).toContain(context.destination);
  });

  it('builds a channel strip: channelGain -> panner -> 3 biquads (lowshelf/peaking/highshelf) -> master', () => {
    const { context, engine } = makeEngine();
    engine.updateChannel('chan_1', mixer());

    const master = context.gainNodes[0];
    const channelGain = context.gainNodes[1];
    const panner = context.pannerNodes[0];
    const [eqLow, eqMid, eqHigh] = context.biquadNodes;

    expect(channelGain.connections).toContain(panner);
    expect(panner.connections).toContain(eqLow);
    expect(eqLow.connections).toContain(eqMid);
    expect(eqMid.connections).toContain(eqHigh);
    expect(eqHigh.connections).toContain(master);

    expect(eqLow.type).toBe('lowshelf');
    expect(eqMid.type).toBe('peaking');
    expect(eqHigh.type).toBe('highshelf');
  });

  it('applies base_volume on the clip gain and channel volume on the channel gain (both apply)', async () => {
    const { context, engine } = makeEngine();
    engine.updateChannel('chan_1', mixer({ volume: 0.5 }));
    await engine.triggerClip('chan_1', clip({ baseVolume: 0.8 }), mixer({ volume: 0.5, transitionType: 'cut' }));

    const channelGain = context.gainNodes[1];
    const clipGain = context.gainNodes[2];
    expect(channelGain.gain.value).toBe(0.5);
    expect(clipGain.gain.value).toBe(0.8);
  });

  it('mute silences the channel strip regardless of volume', () => {
    const { context, engine } = makeEngine();
    engine.updateChannel('chan_1', mixer({ volume: 0.9, muted: true }));
    expect(context.gainNodes[1].gain.value).toBe(0);
  });

  it('eq and balance live updates apply to the running strip', () => {
    const { context, engine } = makeEngine();
    engine.updateChannel('chan_1', mixer({ balance: -0.5, eqLow: 3, eqMid: -2, eqHigh: 6 }));
    expect(context.pannerNodes[0].pan.value).toBe(-0.5);
    expect(context.biquadNodes[0].gain.value).toBe(3);
    expect(context.biquadNodes[1].gain.value).toBe(-2);
    expect(context.biquadNodes[2].gain.value).toBe(6);

    engine.updateChannel('chan_1', mixer({ balance: 0.9, eqLow: -12, eqMid: 0, eqHigh: -6 }));
    expect(context.pannerNodes[0].pan.value).toBe(0.9);
    expect(context.biquadNodes[0].gain.value).toBe(-12);
    expect(context.biquadNodes[2].gain.value).toBe(-6);
  });

  it('loop=true on the clip sets the buffer source to loop natively', async () => {
    const { context, engine } = makeEngine();
    await engine.triggerClip('chan_1', clip({ loop: true }), mixer());
    expect(context.bufferSources[0].loop).toBe(true);
  });

  describe('replace mode', () => {
    it('starting a new clip stops the previous one on the same channel', async () => {
      const { context, engine } = makeEngine();
      const m = mixer({ mode: 'replace', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b' }), m);

      expect(context.bufferSources[0].stopped).toBe(true);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(engine.isPlaying('chan_1', 'b')).toBe(true);
    });

    it('fade transition ramps the outgoing clip to 0 and the incoming clip up to base_volume', async () => {
      const { context, engine } = makeEngine();
      const m = mixer({ mode: 'replace', transitionType: 'fade', transitionSeconds: 3 });
      await engine.triggerClip('chan_1', clip({ id: 'a', baseVolume: 0.7 }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b', baseVolume: 0.6 }), m);

      const outgoingGain = context.gainNodes[2]; // clip a's clipGain
      const incomingGain = context.gainNodes[3]; // clip b's clipGain

      const outgoingRamps = outgoingGain.gain.events.filter((e) => e.type === 'linearRampToValueAtTime');
      expect(outgoingRamps.at(-1)?.value).toBe(0);

      const incomingRamp = incomingGain.gain.events.find((e) => e.type === 'linearRampToValueAtTime');
      expect(incomingRamp?.value).toBe(0.6);
    });

    it('at most one clip is audible (isPlaying) per replace-channel', async () => {
      const { engine } = makeEngine();
      const m = mixer({ mode: 'replace', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'c' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(engine.isPlaying('chan_1', 'b')).toBe(false);
      expect(engine.isPlaying('chan_1', 'c')).toBe(true);
    });

    it('clicking the already-playing clip again stops it instead of restarting it', async () => {
      const { context, engine } = makeEngine();
      const m = mixer({ mode: 'replace', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(context.bufferSources).toHaveLength(1); // no second source created
    });
  });

  describe('add mode', () => {
    it('layers multiple clips simultaneously', async () => {
      const { engine } = makeEngine();
      const m = mixer({ mode: 'add', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      expect(engine.isPlaying('chan_1', 'b')).toBe(true);
    });

    it('triggering an already-playing clip toggles it off', async () => {
      const { context, engine } = makeEngine();
      const m = mixer({ mode: 'add', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(true);
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(context.bufferSources[0].stopped).toBe(true);
    });
  });

  describe('stopChannel', () => {
    it('stops every clip currently playing on a channel', async () => {
      const { engine } = makeEngine();
      const m = mixer({ mode: 'add', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b' }), m);
      engine.stopChannel('chan_1', m);
      expect(engine.isPlaying('chan_1', 'a')).toBe(false);
      expect(engine.isPlaying('chan_1', 'b')).toBe(false);
    });
  });

  describe('subscribe / getPlayingClipIds (board UI highlight state)', () => {
    it('getPlayingClipIds reflects the currently playing set', async () => {
      const { engine } = makeEngine();
      const m = mixer({ mode: 'add', transitionType: 'cut' });
      await engine.triggerClip('chan_1', clip({ id: 'a' }), m);
      await engine.triggerClip('chan_1', clip({ id: 'b' }), m);
      expect(engine.getPlayingClipIds('chan_1').sort()).toEqual(['a', 'b']);
    });

    it('notifies subscribers when a channel starts or stops a clip', async () => {
      const { engine } = makeEngine();
      const notified: string[] = [];
      const unsubscribe = engine.subscribe((channelId) => notified.push(channelId));
      await engine.triggerClip('chan_1', clip({ id: 'a' }), mixer({ mode: 'add', transitionType: 'cut' }));
      expect(notified).toContain('chan_1');
      unsubscribe();
    });
  });
});
