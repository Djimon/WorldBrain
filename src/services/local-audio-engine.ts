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
  buffer: AudioBuffer;
  loop: boolean;
  // Playback-position bookkeeping for real pause/resume — an
  // AudioBufferSourceNode has no native pause, only stop(), so resuming
  // means creating a NEW source and starting it at the right offset.
  startedAt: number;
  offsetAtStart: number;
}

// A paused clip keeps its clipGain (still connected into the channel strip)
// and buffer so resuming doesn't need to re-fetch/re-decode anything — only
// the (now stopped) source and position are gone, both rebuilt on resume.
interface PausedClip {
  clipGain: GainNode;
  buffer: AudioBuffer;
  loop: boolean;
  offset: number;
}

interface ChannelStrip {
  channelGain: GainNode;
  panner: StereoPannerNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  playing: Map<string, PlayingClip>;
  paused: Map<string, PausedClip>;
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

  getPausedClipIds(channelId: string): string[] {
    return Array.from(this.channels.get(channelId)?.paused.keys() ?? []);
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

    const strip: ChannelStrip = { channelGain, panner, eqLow, eqMid, eqHigh, playing: new Map(), paused: new Map() };
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
    // A direct clip-button click always starts fresh from the top, even if
    // the channel-level pause button had left this clip paused mid-track —
    // pause/resume is a channel-level concept, clip buttons stay as before.
    strip.paused.delete(clip.id);

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
    strip.playing.set(clip.id, { source, clipGain, buffer, loop: clip.loop, startedAt: now, offsetAtStart: 0 });
    source.onended = () => { strip.playing.delete(clip.id); this.notify(channelId); };
    this.notify(channelId);
  }

  /** Stops one clip on a channel, respecting the channel's transition. Discards playback position — use pauseClip to keep it. */
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
    strip.paused.delete(clipId);
    this.notify(channelId);
  }

  /** Stops every clip currently playing on a channel (e.g. scene switch) — discards any paused position too. */
  stopChannel(channelId: string, mixer: Pick<ChannelMixerConfig, 'transitionType' | 'transitionSeconds'>): void {
    const strip = this.channels.get(channelId);
    if (!strip) return;
    for (const clipId of Array.from(strip.playing.keys())) {
      this.stopClip(channelId, clipId, mixer);
    }
    strip.paused.clear();
  }

  /** Pauses one clip in place — unlike stopClip, the playback position is kept so resumeClip can continue from it. */
  pauseClip(channelId: string, clipId: string): void {
    const strip = this.channels.get(channelId);
    const playing = strip?.playing.get(clipId);
    if (!strip || !playing) return;

    const now = this.context.currentTime;
    const elapsed = now - playing.startedAt;
    const offset = playing.loop
      ? (playing.offsetAtStart + elapsed) % playing.buffer.duration
      : Math.min(playing.offsetAtStart + elapsed, playing.buffer.duration);
    playing.source.stop(now);
    strip.playing.delete(clipId);
    strip.paused.set(clipId, { clipGain: playing.clipGain, buffer: playing.buffer, loop: playing.loop, offset });
    this.notify(channelId);
  }

  /** Pauses every clip currently playing on a channel, keeping each one's position. */
  pauseChannel(channelId: string): void {
    const strip = this.channels.get(channelId);
    if (!strip) return;
    for (const clipId of Array.from(strip.playing.keys())) {
      this.pauseClip(channelId, clipId);
    }
  }

  /** Resumes one paused clip from where it left off. No-op if it isn't paused. */
  resumeClip(channelId: string, clipId: string): void {
    const strip = this.channels.get(channelId);
    const paused = strip?.paused.get(clipId);
    if (!strip || !paused) return;

    const source = this.context.createBufferSource();
    source.buffer = paused.buffer;
    source.loop = paused.loop;
    source.connect(paused.clipGain);

    const now = this.context.currentTime;
    source.start(now, paused.offset);
    strip.paused.delete(clipId);
    strip.playing.set(clipId, {
      source, clipGain: paused.clipGain, buffer: paused.buffer, loop: paused.loop,
      startedAt: now, offsetAtStart: paused.offset,
    });
    source.onended = () => { strip.playing.delete(clipId); this.notify(channelId); };
    this.notify(channelId);
  }

  /** Resumes every paused clip on a channel from where each left off. */
  resumeChannel(channelId: string): void {
    const strip = this.channels.get(channelId);
    if (!strip) return;
    for (const clipId of Array.from(strip.paused.keys())) {
      this.resumeClip(channelId, clipId);
    }
  }

  isPlaying(channelId: string, clipId: string): boolean {
    return this.channels.get(channelId)?.playing.has(clipId) ?? false;
  }

  /** Snaps a currently-playing (or paused) clip's own gain to a new base_volume — e.g. the clip editor was used to change it mid-playback. No-op if the clip is neither. */
  updateClipVolume(channelId: string, clipId: string, baseVolume: number): void {
    const strip = this.channels.get(channelId);
    const playing = strip?.playing.get(clipId);
    if (playing) { playing.clipGain.gain.value = baseVolume; return; }
    const paused = strip?.paused.get(clipId);
    if (paused) paused.clipGain.gain.value = baseVolume;
  }

  dispose(): void {
    for (const strip of this.channels.values()) {
      for (const clipId of Array.from(strip.playing.keys())) {
        strip.playing.get(clipId)?.source.stop();
      }
      strip.paused.clear();
    }
    this.channels.clear();
    this.master.disconnect();
  }
}
