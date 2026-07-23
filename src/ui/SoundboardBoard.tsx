// M15-S14 (#285): the Streamdeck-style board — loads the active Scene
// (S11's listScene) and renders one ChannelRow per channel, wiring clip
// clicks to the correct engine (local S12 for file clips, YouTube S13 for
// link clips) and mixer changes to both persistence and the live engines.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { DatabaseLike } from '../services/entity-service';
import { createChannel, listScene, updateChannelMixer } from '../services/audio-service';
import type { AudioChannelRow, AudioPresetRow, ChannelMixerPatch, SceneWithChannels } from '../services/audio-service';
import type { ChannelMixerConfig, LocalAudioEngine } from '../services/local-audio-engine';
import type { YoutubeTierEngine } from '../services/youtube-tier-engine';
import { ChannelRow } from './ChannelRow';
import { YoutubeChannelPlayers } from './YoutubeChannelPlayers';

export interface SoundboardBoardProps {
  database: DatabaseLike;
  sceneId: string;
  localEngine: LocalAudioEngine;
  youtubeEngine: YoutubeTierEngine;
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

export function SoundboardBoard({ database, sceneId, localEngine, youtubeEngine, onEditClip, refreshToken }: SoundboardBoardProps) {
  const { t } = useTranslation('nav');
  const [scene, setScene] = useState<SceneWithChannels | null>(null);
  const [activeByChannel, setActiveByChannel] = useState<Map<string, Set<string>>>(new Map());

  const reload = useCallback(() => {
    listScene(database, sceneId).then(setScene).catch(console.error);
  }, [database, sceneId]);

  useEffect(() => { reload(); }, [reload, refreshToken]);

  useEffect(() => {
    function recompute() {
      setScene((current) => {
        if (!current) return current;
        const next = new Map<string, Set<string>>();
        for (const channel of current.channels) {
          const local = localEngine.getPlayingClipIds(channel.id);
          const link = youtubeEngine.getSlots(channel.id).map((slot) => slot.clipId);
          next.set(channel.id, new Set([...local, ...link]));
        }
        setActiveByChannel(next);
        return current;
      });
    }
    recompute();
    const unsubscribeLocal = localEngine.subscribe(recompute);
    const unsubscribeYoutube = youtubeEngine.subscribe(recompute);
    return () => { unsubscribeLocal(); unsubscribeYoutube(); };
  }, [scene, localEngine, youtubeEngine]);

  function handleTriggerClip(channel: AudioChannelRow, preset: AudioPresetRow) {
    const mixer = mixerConfigFor(channel);
    if (preset.source_type === 'file') {
      void localEngine.triggerClip(
        channel.id,
        { id: preset.id, sourceUrl: convertFileSrc(preset.source_ref), baseVolume: preset.base_volume, loop: !!preset.loop },
        mixer,
      );
    } else {
      youtubeEngine.triggerClip(
        channel.id,
        { id: preset.id, videoUrl: preset.source_ref, baseVolume: preset.base_volume, loop: !!preset.loop },
        mixer,
      );
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

  async function handleAddChannel() {
    await createChannel(database, { scene_id: sceneId, name: t('audioChannelUnnamed', 'Kanal') });
    reload();
  }

  if (!scene) {
    return <div className="soundboard-board">{t('audioSoundboardLoading', 'Lade…')}</div>;
  }

  return (
    <div className="soundboard-board">
      {scene.channels.map((channel) => (
        <div className="soundboard-board__channel" key={channel.id}>
          <ChannelRow
            channel={channel}
            activeClipIds={activeByChannel.get(channel.id) ?? new Set()}
            onTriggerClip={(preset) => handleTriggerClip(channel, preset)}
            onEditClip={onEditClip}
            onMixerChange={(patch) => void handleMixerChange(channel, patch)}
          />
          <YoutubeChannelPlayers channelId={channel.id} engine={youtubeEngine} />
        </div>
      ))}
      <button type="button" className="btn soundboard-board__add-channel" onClick={() => void handleAddChannel()}>
        {t('audioAddChannel', '+ Kanal hinzufügen')}
      </button>
    </div>
  );
}
