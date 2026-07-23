// M15-S13 (#284): orchestrates which link clips are currently audible per
// channel and their target volume — mirrors LocalAudioEngine's shape
// (triggerClip/stopClip/stopChannel/isPlaying) so the board UI (S14) can
// drive both tiers uniformly. Unlike the local engine this has no Web Audio
// node graph (cross-origin IFrame exposes none — balance/EQ are inert here,
// D2) — it only decides target volumes and removal timing; the actual
// setVolume() ramp lives in YoutubeClipPlayer, tracked in a local JS
// variable per the spike's explicit warning never to read back getVolume()
// (it lags one tick behind setVolume()).
export interface YoutubeClipInput {
  id: string;
  videoUrl: string;
  baseVolume: number;
  loop: boolean;
}

export interface YoutubeChannelMixer {
  volume: number;
  muted: boolean;
  mode: 'replace' | 'add';
  transitionType: 'cut' | 'fade';
  transitionSeconds: number;
}

export interface YoutubeSlot {
  clipId: string;
  videoUrl: string;
  loop: boolean;
  targetVolume: number;
  rampSeconds: number;
}

type Listener = (channelId: string, slots: YoutubeSlot[]) => void;

export class YoutubeTierEngine {
  private channels = new Map<string, Map<string, YoutubeSlot>>();
  private removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(channelId: string): void {
    const slots = this.getSlots(channelId);
    for (const listener of this.listeners) listener(channelId, slots);
  }

  private getChannelSlots(channelId: string): Map<string, YoutubeSlot> {
    let slots = this.channels.get(channelId);
    if (!slots) { slots = new Map(); this.channels.set(channelId, slots); }
    return slots;
  }

  getSlots(channelId: string): YoutubeSlot[] {
    return Array.from(this.channels.get(channelId)?.values() ?? []);
  }

  isPlaying(channelId: string, clipId: string): boolean {
    return this.channels.get(channelId)?.has(clipId) ?? false;
  }

  triggerClip(channelId: string, clip: YoutubeClipInput, mixer: YoutubeChannelMixer): void {
    const slots = this.getChannelSlots(channelId);

    if (mixer.mode === 'add' && slots.has(clip.id)) {
      this.stopClip(channelId, clip.id, mixer);
      return;
    }

    if (mixer.mode === 'replace') {
      for (const existingId of Array.from(slots.keys())) {
        this.stopClip(channelId, existingId, mixer);
      }
    }

    const timer = this.removalTimers.get(clip.id);
    if (timer) { clearTimeout(timer); this.removalTimers.delete(clip.id); }

    slots.set(clip.id, {
      clipId: clip.id,
      videoUrl: clip.videoUrl,
      loop: clip.loop,
      targetVolume: this.effectiveVolume(clip.baseVolume, mixer),
      rampSeconds: mixer.transitionType === 'fade' ? mixer.transitionSeconds : 0,
    });
    this.notify(channelId);
  }

  private effectiveVolume(baseVolume: number, mixer: Pick<YoutubeChannelMixer, 'volume' | 'muted'>): number {
    return mixer.muted ? 0 : Math.round(baseVolume * mixer.volume * 100);
  }

  stopClip(channelId: string, clipId: string, mixer: Pick<YoutubeChannelMixer, 'transitionType' | 'transitionSeconds'>): void {
    const slots = this.channels.get(channelId);
    const slot = slots?.get(clipId);
    if (!slots || !slot) return;

    if (mixer.transitionType === 'cut') {
      slots.delete(clipId);
      this.notify(channelId);
      return;
    }

    slot.targetVolume = 0;
    slot.rampSeconds = mixer.transitionSeconds;
    this.notify(channelId);
    const timer = setTimeout(() => {
      slots.delete(clipId);
      this.removalTimers.delete(clipId);
      this.notify(channelId);
    }, mixer.transitionSeconds * 1000);
    this.removalTimers.set(clipId, timer);
  }

  stopChannel(channelId: string, mixer: Pick<YoutubeChannelMixer, 'transitionType' | 'transitionSeconds'>): void {
    const slots = this.channels.get(channelId);
    if (!slots) return;
    for (const clipId of Array.from(slots.keys())) this.stopClip(channelId, clipId, mixer);
  }

  /** Re-applies channel volume/mute to every currently-audible clip (e.g. fader moved while playing). */
  updateChannelVolume(channelId: string, mixer: Pick<YoutubeChannelMixer, 'volume' | 'muted'>, baseVolumeByClipId: Map<string, number>): void {
    const slots = this.channels.get(channelId);
    if (!slots) return;
    for (const [clipId, slot] of slots) {
      const base = baseVolumeByClipId.get(clipId) ?? 1;
      slot.targetVolume = this.effectiveVolume(base, mixer);
      slot.rampSeconds = 0;
    }
    this.notify(channelId);
  }

  dispose(): void {
    for (const timer of this.removalTimers.values()) clearTimeout(timer);
    this.removalTimers.clear();
    this.channels.clear();
  }
}
