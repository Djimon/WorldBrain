// M15-S12 (#283): local Web Audio channel-strip engine — the full mixer for
// local-file clips. Driven by the AudioContext created in the soundboard
// window (S10). YouTube/link clips are a separate tier (S13) with no Web
// Audio node access (cross-origin IFrame).
export interface ClipConfig {
  id: string;
  sourceUrl: string;
  baseVolume: number;
  loop: boolean;
}

export interface ChannelMixerConfig {
  volume: number;
  balance: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  muted: boolean;
  mode: 'replace' | 'add';
  transitionType: 'cut' | 'fade';
  transitionSeconds: number;
}

interface PlayingClip {
  source: AudioBufferSourceNode;
  clipGain: GainNode;
}

interface ChannelStrip {
  channelGain: GainNode;
  panner: StereoPannerNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  playing: Map<string, PlayingClip>;
}

type Listener = (channelId: string) => void;

export class LocalAudioEngine {
  private context: AudioContext;
  master: GainNode;
  private channels = new Map<string, ChannelStrip>();
  private bufferCache = new Map<string, AudioBuffer>();
  private listeners = new Set<Listener>();

  constructor(context: AudioContext) {
    this.context = context;
    this.master = context.createGain();
    this.master.connect(context.destination);
  }

  /** Notified whenever a channel's set of currently-playing clips changes (board UI highlight state). */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(channelId: string): void {
    for (const listener of this.listeners) listener(channelId);
  }

  getPlayingClipIds(channelId: string): string[] {
    return Array.from(this.channels.get(channelId)?.playing.keys() ?? []);
  }

  private getOrCreateChannel(channelId: string): ChannelStrip {
    const existing = this.channels.get(channelId);
    if (existing) return existing;

    const channelGain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    const eqLow = this.context.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    const eqMid = this.context.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.7;
    const eqHigh = this.context.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;

    channelGain.connect(panner);
    panner.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(this.master);

    const strip: ChannelStrip = { channelGain, panner, eqLow, eqMid, eqHigh, playing: new Map() };
    this.channels.set(channelId, strip);
    return strip;
  }

  /** Live mixer update — applies immediately to the running strip. */
  updateChannel(channelId: string, mixer: ChannelMixerConfig): void {
    const strip = this.getOrCreateChannel(channelId);
    strip.channelGain.gain.value = mixer.muted ? 0 : mixer.volume;
    strip.panner.pan.value = mixer.balance;
    strip.eqLow.gain.value = mixer.eqLow;
    strip.eqMid.gain.value = mixer.eqMid;
    strip.eqHigh.gain.value = mixer.eqHigh;
  }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.context.decodeAudioData(arrayBuffer);
    this.bufferCache.set(url, buffer);
    return buffer;
  }

  /** Click handler entry point for a clip button — behavior depends on the channel's mode. */
  async triggerClip(channelId: string, clip: ClipConfig, mixer: ChannelMixerConfig): Promise<void> {
    const strip = this.getOrCreateChannel(channelId);

    // Clicking the clip that's already playing always toggles it off — in
    // 'add' mode that's per-clip; in 'replace' mode it's the sole audible
    // clip, so a second click on the same button must stop it rather than
    // restart it (only a DIFFERENT clip should trigger the exclusive swap).
    if (strip.playing.has(clip.id)) {
      this.stopClip(channelId, clip.id, mixer);
      return;
    }

    if (mixer.mode === 'replace') {
      for (const existingId of Array.from(strip.playing.keys())) {
        this.stopClip(channelId, existingId, mixer);
      }
    }

    const buffer = await this.loadBuffer(clip.sourceUrl);
    const clipGain = this.context.createGain();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = clip.loop;
    source.connect(clipGain);
    clipGain.connect(strip.channelGain);

    const now = this.context.currentTime;
    if (mixer.transitionType === 'fade') {
      clipGain.gain.setValueAtTime(0, now);
      clipGain.gain.linearRampToValueAtTime(clip.baseVolume, now + mixer.transitionSeconds);
    } else {
      clipGain.gain.setValueAtTime(clip.baseVolume, now);
    }

    source.start(now);
    strip.playing.set(clip.id, { source, clipGain });
    source.onended = () => { strip.playing.delete(clip.id); this.notify(channelId); };
    this.notify(channelId);
  }

  /** Stops one clip on a channel, respecting the channel's transition. */
  stopClip(channelId: string, clipId: string, mixer: Pick<ChannelMixerConfig, 'transitionType' | 'transitionSeconds'>): void {
    const strip = this.channels.get(channelId);
    const playing = strip?.playing.get(clipId);
    if (!strip || !playing) return;

    const now = this.context.currentTime;
    if (mixer.transitionType === 'fade') {
      playing.clipGain.gain.cancelScheduledValues(now);
      playing.clipGain.gain.setValueAtTime(playing.clipGain.gain.value, now);
      playing.clipGain.gain.linearRampToValueAtTime(0, now + mixer.transitionSeconds);
      playing.source.stop(now + mixer.transitionSeconds);
    } else {
      playing.source.stop(now);
    }
    strip.playing.delete(clipId);
    this.notify(channelId);
  }

  /** Stops every clip currently playing on a channel (e.g. scene switch). */
  stopChannel(channelId: string, mixer: Pick<ChannelMixerConfig, 'transitionType' | 'transitionSeconds'>): void {
    const strip = this.channels.get(channelId);
    if (!strip) return;
    for (const clipId of Array.from(strip.playing.keys())) {
      this.stopClip(channelId, clipId, mixer);
    }
  }

  isPlaying(channelId: string, clipId: string): boolean {
    return this.channels.get(channelId)?.playing.has(clipId) ?? false;
  }

  /** Snaps a currently-playing clip's own gain to a new base_volume — e.g. the clip editor was used to change it mid-playback. No-op if the clip isn't playing. */
  updateClipVolume(channelId: string, clipId: string, baseVolume: number): void {
    const playing = this.channels.get(channelId)?.playing.get(clipId);
    if (!playing) return;
    playing.clipGain.gain.value = baseVolume;
  }

  dispose(): void {
    for (const strip of this.channels.values()) {
      for (const clipId of Array.from(strip.playing.keys())) {
        strip.playing.get(clipId)?.source.stop();
      }
    }
    this.channels.clear();
    this.master.disconnect();
  }
}
