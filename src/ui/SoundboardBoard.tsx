// M15-S14 (#285): the Streamdeck-style board — loads the active Scene
// (S11's listScene) and renders one ChannelRow per channel, wiring clip
// clicks to the correct engine (local S12 for file clips, YouTube S13 for
// link clips) and mixer changes to both persistence and the live engines.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DatabaseLike } from '../services/entity-service';
import { createChannel, listScene, renameChannel, updateChannelMixer } from '../services/audio-service';
import type { AudioChannelRow, AudioPresetRow, ChannelMixerPatch, SceneWithChannels } from '../services/audio-service';
import type { ChannelMixerConfig, LocalAudioEngine } from '../services/local-audio-engine';
import type { YoutubeTierEngine } from '../services/youtube-tier-engine';
import type { SpotifyTierEngine } from '../services/spotify-tier-engine';
import { ChannelRow } from './ChannelRow';
import { YoutubeChannelPlayers } from './YoutubeChannelPlayers';
import { SpotifyChannelPlayers } from './SpotifyChannelPlayers';

export interface SoundboardBoardProps {
  database: DatabaseLike;
  sceneId: string;
  localEngine: LocalAudioEngine;
  youtubeEngine: YoutubeTierEngine;
  spotifyEngine: SpotifyTierEngine;
  onEditClip: (channelId: string, presetId: string | null) => void;
  /** Bump to force a reload — e.g. after the clip editor (S16) saves/deletes a preset. */
  refreshToken?: number;
}

function mixerConfigFor(channel: AudioChannelRow): ChannelMixerConfig {
  return {
    volume: channel.volume,
    balance: channel.balance,
    eqLow: channel.eq_low,
    eqMid: channel.eq_mid,
    eqHigh: channel.eq_high,
    muted: !!channel.muted,
    mode: channel.mode,
    transitionType: channel.transition_type,
    transitionSeconds: channel.transition_seconds,
  };
}

export function SoundboardBoard({ database, sceneId, localEngine, youtubeEngine, spotifyEngine, onEditClip, refreshToken }: SoundboardBoardProps) {
  const { t } = useTranslation('nav');
  const [scene, setScene] = useState<SceneWithChannels | null>(null);
  const [activeByChannel, setActiveByChannel] = useState<Map<string, Set<string>>>(new Map());
  // Whether a channel currently has any paused-in-place clips (real pause,
  // not stopped) — distinguishes "resume where it left off" from "nothing
  // to resume, replay from scratch" in the channel play/pause button.
  const [pausedByChannel, setPausedByChannel] = useState<Map<string, boolean>>(new Map());
  // Remembers each channel's last non-empty active-clip set so the channel
  // play/pause button has something to replay from scratch when there's
  // nothing playing AND nothing paused (e.g. right after a full stop).
  const [lastActiveByChannel, setLastActiveByChannel] = useState<Map<string, string[]>>(new Map());
  // Surfaced visibly (not just console.error) so a failed local-file fetch
  // or decode is actually diagnosable without opening devtools.
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Re-applies each channel's current base_volume/mixer to whatever is
  // already playing — otherwise editing a clip's volume while it's active
  // (clip editor -> save) only takes effect the next time it's triggered.
  const syncLiveVolumes = useCallback((freshScene: SceneWithChannels) => {
    for (const channel of freshScene.channels) {
      const mixer = mixerConfigFor(channel);
      for (const preset of channel.presets) {
        if (preset.source_type === 'file') {
          localEngine.updateClipVolume(channel.id, preset.id, preset.base_volume);
        }
      }
      const baseVolumeByClipId = new Map(channel.presets.map((preset) => [preset.id, preset.base_volume]));
      youtubeEngine.updateChannelVolume(channel.id, mixer, baseVolumeByClipId);
    }
  }, [localEngine, youtubeEngine]);

  const reload = useCallback(() => {
    listScene(database, sceneId).then((freshScene) => {
      setScene(freshScene);
      if (freshScene) syncLiveVolumes(freshScene);
    }).catch(console.error);
  }, [database, sceneId, syncLiveVolumes]);

  useEffect(() => { reload(); }, [reload, refreshToken]);

  useEffect(() => {
    function recompute() {
      setScene((current) => {
        if (!current) return current;
        const next = new Map<string, Set<string>>();
        const nextPaused = new Map<string, boolean>();
        for (const channel of current.channels) {
          const local = localEngine.getPlayingClipIds(channel.id);
          const youtubeSlots = youtubeEngine.getSlots(channel.id);
          const spotifySlots = spotifyEngine.getSlots(channel.id);
          const link = youtubeSlots.filter((slot) => !slot.paused).map((slot) => slot.clipId);
          const spotify = spotifySlots.filter((slot) => !slot.paused).map((slot) => slot.clipId);
          next.set(channel.id, new Set([...local, ...link, ...spotify]));
          nextPaused.set(channel.id,
            localEngine.getPausedClipIds(channel.id).length > 0
            || youtubeSlots.some((slot) => slot.paused)
            || spotifySlots.some((slot) => slot.paused));
        }
        setActiveByChannel(next);
        setPausedByChannel(nextPaused);
        setLastActiveByChannel((prevLast) => {
          const nextLast = new Map(prevLast);
          for (const [channelId, active] of next) {
            if (active.size > 0) nextLast.set(channelId, Array.from(active));
          }
          return nextLast;
        });
        return current;
      });
    }
    recompute();
    const unsubscribeLocal = localEngine.subscribe(recompute);
    const unsubscribeYoutube = youtubeEngine.subscribe(recompute);
    const unsubscribeSpotify = spotifyEngine.subscribe(recompute);
    return () => { unsubscribeLocal(); unsubscribeYoutube(); unsubscribeSpotify(); };
  }, [scene, localEngine, youtubeEngine, spotifyEngine]);

  function handleTriggerClip(channel: AudioChannelRow, preset: AudioPresetRow) {
    const mixer = mixerConfigFor(channel);
    if (preset.source_type === 'file') {
      setPlaybackError(null);
      void localEngine.triggerClip(
        channel.id,
        { id: preset.id, sourceUrl: convertFileSrc(preset.source_ref), baseVolume: preset.base_volume, loop: !!preset.loop },
        mixer,
      ).catch((error: unknown) => {
        console.error(error);
        setPlaybackError(`${preset.label ?? preset.id}: ${error instanceof Error ? error.message : String(error)}`);
      });
    } else if (preset.source_type === 'link') {
      youtubeEngine.triggerClip(
        channel.id,
        { id: preset.id, videoUrl: preset.source_ref, baseVolume: preset.base_volume, loop: !!preset.loop },
        mixer,
      );
    } else {
      spotifyEngine.triggerClip(channel.id, { id: preset.id, uri: preset.source_ref }, { mode: channel.mode });
    }
  }

  async function handleMixerChange(channel: AudioChannelRow & { presets: AudioPresetRow[] }, patch: ChannelMixerPatch) {
    await updateChannelMixer(database, channel.id, patch);
    const patchedChannel: AudioChannelRow = {
      ...channel,
      ...patch,
      muted: patch.muted !== undefined ? (patch.muted ? 1 : 0) : channel.muted,
    };
    const mixer = mixerConfigFor(patchedChannel);
    localEngine.updateChannel(channel.id, mixer);
    const baseVolumeByClipId = new Map(channel.presets.map((preset) => [preset.id, preset.base_volume]));
    youtubeEngine.updateChannelVolume(channel.id, mixer, baseVolumeByClipId);
    reload();
  }

  function handleTogglePlayback(channel: AudioChannelRow & { presets: AudioPresetRow[] }) {
    const active = activeByChannel.get(channel.id) ?? new Set<string>();
    if (active.size > 0) {
      // Real pause, not stop — keeps each clip's position so resuming
      // continues from where it left off instead of restarting.
      localEngine.pauseChannel(channel.id);
      youtubeEngine.pauseChannel(channel.id);
      spotifyEngine.pauseChannel(channel.id);
      return;
    }
    if (pausedByChannel.get(channel.id)) {
      localEngine.resumeChannel(channel.id);
      youtubeEngine.resumeChannel(channel.id);
      spotifyEngine.resumeChannel(channel.id);
      return;
    }
    // Nothing playing, nothing paused (e.g. right after a full stop) —
    // nothing to resume, so replay whatever was last active from scratch.
    const toResume = lastActiveByChannel.get(channel.id) ?? [];
    for (const presetId of toResume) {
      const preset = channel.presets.find((p) => p.id === presetId);
      if (preset) handleTriggerClip(channel, preset);
    }
  }

  async function handleRenameChannel(channelId: string, name: string) {
    await renameChannel(database, channelId, name);
    reload();
  }

  async function handleAddChannel() {
    await createChannel(database, { scene_id: sceneId, name: t('audioChannelUnnamed', 'Kanal') });
    reload();
  }

  if (!scene) {
    return <div className="soundboard-board">{t('audioSoundboardLoading', 'Lade…')}</div>;
  }

  return (
    <div className="soundboard-board">
      {playbackError && (
        <div className="soundboard-board__error" role="alert">
          <span>{t('audioPlaybackError', 'Wiedergabe fehlgeschlagen')}: {playbackError}</span>
          <button type="button" className="soundboard-board__error-dismiss" aria-label={t('audioSceneCancel', 'Abbrechen')} onClick={() => setPlaybackError(null)}>✕</button>
        </div>
      )}
      {scene.channels.map((channel) => (
        <div className="soundboard-board__channel" key={channel.id}>
          <ChannelRow
            channel={channel}
            activeClipIds={activeByChannel.get(channel.id) ?? new Set()}
            onTriggerClip={(preset) => handleTriggerClip(channel, preset)}
            onEditClip={onEditClip}
            onMixerChange={(patch) => void handleMixerChange(channel, patch)}
            onTogglePlayback={() => handleTogglePlayback(channel)}
            onRenameChannel={(name) => void handleRenameChannel(channel.id, name)}
          />
          <YoutubeChannelPlayers channelId={channel.id} engine={youtubeEngine} />
          <SpotifyChannelPlayers channelId={channel.id} engine={spotifyEngine} />
        </div>
      ))}
      <button type="button" className="btn soundboard-board__add-channel" onClick={() => void handleAddChannel()}>
        {t('audioAddChannel', '+ Kanal hinzufügen')}
      </button>
    </div>
  );
}
