// Crude Spotify tier orchestrator — no volume/fade/mix at all (the public
// embed exposes no setVolume), so unlike LocalAudioEngine/YoutubeTierEngine
// this only tracks which clips are on/off per channel. Same triggerClip
// toggle shape as the other two tiers so the board UI can drive all three
// uniformly, but stop calls take no transition config — there is nothing to
// ramp.
export interface SpotifyClipInput {
  id: string;
  uri: string;
}

export interface SpotifyChannelMixer {
  mode: 'replace' | 'add';
}

export interface SpotifySlot {
  clipId: string;
  uri: string;
}

type Listener = (channelId: string, slots: SpotifySlot[]) => void;

export class SpotifyTierEngine {
  private channels = new Map<string, Map<string, SpotifySlot>>();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(channelId: string): void {
    const slots = this.getSlots(channelId);
    for (const listener of this.listeners) listener(channelId, slots);
  }

  private getChannelSlots(channelId: string): Map<string, SpotifySlot> {
    let slots = this.channels.get(channelId);
    if (!slots) { slots = new Map(); this.channels.set(channelId, slots); }
    return slots;
  }

  getSlots(channelId: string): SpotifySlot[] {
    return Array.from(this.channels.get(channelId)?.values() ?? []);
  }

  isPlaying(channelId: string, clipId: string): boolean {
    return this.channels.get(channelId)?.has(clipId) ?? false;
  }

  triggerClip(channelId: string, clip: SpotifyClipInput, mixer: SpotifyChannelMixer): void {
    const slots = this.getChannelSlots(channelId);

    if (slots.has(clip.id)) {
      slots.delete(clip.id);
      this.notify(channelId);
      return;
    }

    if (mixer.mode === 'replace') slots.clear();
    slots.set(clip.id, { clipId: clip.id, uri: clip.uri });
    this.notify(channelId);
  }

  stopClip(channelId: string, clipId: string): void {
    const slots = this.channels.get(channelId);
    if (!slots?.has(clipId)) return;
    slots.delete(clipId);
    this.notify(channelId);
  }

  stopChannel(channelId: string): void {
    const slots = this.channels.get(channelId);
    if (!slots || slots.size === 0) return;
    slots.clear();
    this.notify(channelId);
  }

  dispose(): void {
    this.channels.clear();
  }
}
