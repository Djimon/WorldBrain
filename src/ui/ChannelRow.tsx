// M15-S14 (#285): one channel row — play/pause+level indicator, name, up to
// 8 clip buttons, volume slider+dB readout, mute, mode/transition popover,
// balance+3-band EQ (disabled for link clips, D2). Concept art: _design/soundboard concept.png.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipButton } from './ClipButton';
import type { AudioChannelRow, AudioPresetRow, ChannelMixerPatch } from '../services/audio-service';

const MAX_CLIP_SLOTS = 8;

function dbFromLinear(volume: number): string {
  if (volume <= 0) return '-∞ dB';
  const db = 20 * Math.log10(volume);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

export interface ChannelWithPresets extends AudioChannelRow {
  presets: AudioPresetRow[];
}

export interface ChannelRowProps {
  channel: ChannelWithPresets;
  activeClipIds: Set<string>;
  onTriggerClip: (preset: AudioPresetRow) => void;
  onEditClip: (channelId: string, presetId: string | null) => void;
  onMixerChange: (patch: ChannelMixerPatch) => void;
}

export function ChannelRow({ channel, activeClipIds, onTriggerClip, onEditClip, onMixerChange }: ChannelRowProps) {
  const { t } = useTranslation('nav');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hasActiveLinkClip = channel.presets.some((p) => activeClipIds.has(p.id) && p.source_type === 'link');
  const isPlayingAny = channel.presets.some((p) => activeClipIds.has(p.id));

  const slots: (AudioPresetRow | null)[] = channel.presets.slice(0, MAX_CLIP_SLOTS);
  while (slots.length < MAX_CLIP_SLOTS) slots.push(null);

  const eqDisabledTitle = hasActiveLinkClip ? t('audioEqDisabledHint', 'Balance/EQ sind für YouTube-Clips nicht verfügbar') : undefined;

  return (
    <div className="channel-row">
      <div className="channel-row__status" aria-hidden="true">
        <span className="channel-row__status-icon">{isPlayingAny ? '▶' : '⏸'}</span>
        <span className="channel-row__waveform" />
      </div>

      <div className="channel-row__name">{channel.name || t('audioChannelUnnamed', 'Kanal')}</div>

      <div className="channel-row__clips">
        {slots.map((preset, i) => (
          <ClipButton
            key={preset?.id ?? `empty-${i}`}
            preset={preset}
            active={preset ? activeClipIds.has(preset.id) : false}
            onTrigger={() => { if (preset) onTriggerClip(preset); }}
            onEdit={() => onEditClip(channel.id, preset?.id ?? null)}
          />
        ))}
      </div>

      <div className="channel-row__mixer">
        <label className="channel-row__balance" title={eqDisabledTitle}>
          {t('audioBalance', 'Balance')}
          <input
            type="range" min={-1} max={1} step={0.01}
            value={channel.balance}
            disabled={hasActiveLinkClip}
            onChange={(e) => onMixerChange({ balance: Number(e.target.value) })}
          />
        </label>

        <div className="channel-row__eq" title={eqDisabledTitle}>
          <label>
            {t('audioEqLow', 'Bass')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_low} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_low: Number(e.target.value) })} />
          </label>
          <label>
            {t('audioEqMid', 'Mitten')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_mid} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_mid: Number(e.target.value) })} />
          </label>
          <label>
            {t('audioEqHigh', 'Höhen')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_high} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_high: Number(e.target.value) })} />
          </label>
        </div>

        <label className="channel-row__volume">
          {t('audioVolume', 'Lautstärke')}
          <input type="range" min={0} max={1} step={0.01} value={channel.volume}
            onChange={(e) => onMixerChange({ volume: Number(e.target.value) })} />
          <span className="channel-row__db">{dbFromLinear(channel.volume)}</span>
        </label>

        <button
          type="button"
          className="channel-row__mute"
          aria-pressed={!!channel.muted}
          aria-label={t('audioMute', 'Stumm')}
          title={t('audioMute', 'Stumm')}
          onClick={() => onMixerChange({ muted: !channel.muted })}
        >
          {channel.muted ? '🔇' : '🔊'}
        </button>

        <button
          type="button"
          className="channel-row__settings-btn"
          aria-label={t('audioChannelSettings', 'Kanaleinstellungen')}
          title={t('audioChannelSettings', 'Kanaleinstellungen')}
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((v) => !v)}
        >
          ⚙
        </button>
      </div>

      {settingsOpen && (
        <div className="channel-row__settings-popover" role="dialog" aria-label={t('audioChannelSettings', 'Kanaleinstellungen')}>
          <label>
            {t('audioMode', 'Modus')}
            <select value={channel.mode} onChange={(e) => onMixerChange({ mode: e.target.value as 'replace' | 'add' })}>
              <option value="replace">{t('audioModeReplace', 'Ersetzen')}</option>
              <option value="add">{t('audioModeAdd', 'Hinzufügen')}</option>
            </select>
          </label>
          <label>
            {t('audioTransitionType', 'Übergang')}
            <select value={channel.transition_type} onChange={(e) => onMixerChange({ transition_type: e.target.value as 'cut' | 'fade' })}>
              <option value="cut">{t('audioTransitionCut', 'Schnitt')}</option>
              <option value="fade">{t('audioTransitionFade', 'Überblenden')}</option>
            </select>
          </label>
          <label>
            {t('audioTransitionSeconds', 'Sekunden')}
            <input type="number" min={0} step={0.1} value={channel.transition_seconds}
              onChange={(e) => onMixerChange({ transition_seconds: Number(e.target.value) })} />
          </label>
          <button type="button" className="btn" onClick={() => setSettingsOpen(false)}>
            {t('audioSettingsClose', 'Schließen')}
          </button>
        </div>
      )}
    </div>
  );
}
