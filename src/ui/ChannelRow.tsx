// M15-S14 (#285): one channel row — play/pause+level indicator, name, up to
// 8 clip buttons, volume slider+dB readout, mute, mode/transition popover,
// balance+3-band EQ (disabled for link clips, D2). Concept art: _design/soundboard concept.png.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipButton } from './ClipButton';
import type { AudioChannelRow, AudioPresetRow, ChannelMixerPatch } from '../services/audio-service';
import { Button } from './primitives';

const MAX_CLIP_SLOTS = 8;

function dbFromLinear(volume: number): string {
  if (volume <= 0) return '-∞ dB';
  const db = 20 * Math.log10(volume);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

// Abstract envelope shapes: cut = an instant vertical drop, fade = a gradual ramp.
function CutIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M2 3 L2 13 L8 13" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13 L8 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function FadeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M2 13 L14 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
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
  onTogglePlayback: () => void;
  onRenameChannel: (name: string) => void;
}

export function ChannelRow({ channel, activeClipIds, onTriggerClip, onEditClip, onMixerChange, onTogglePlayback, onRenameChannel }: ChannelRowProps) {
  const { t } = useTranslation('nav');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);
  // Buffered locally, committed on blur — an onChange-per-keystroke DB
  // round-trip risks out-of-order writes clobbering a later keystroke.
  const [nameDraft, setNameDraft] = useState(channel.name ?? '');

  useEffect(() => {
    if (settingsOpen) setNameDraft(channel.name ?? '');
  }, [settingsOpen, channel.name]);

  // Neither YouTube nor Spotify's embeds expose a Web Audio node (D2 for
  // YouTube; the crude Spotify tier has no signal access at all).
  const hasActiveLinkClip = channel.presets.some((p) => activeClipIds.has(p.id) && p.source_type !== 'file');
  const isPlayingAny = channel.presets.some((p) => activeClipIds.has(p.id));

  const slots: (AudioPresetRow | null)[] = channel.presets.slice(0, MAX_CLIP_SLOTS);
  while (slots.length < MAX_CLIP_SLOTS) slots.push(null);

  const eqDisabledTitle = hasActiveLinkClip ? t('audioEqDisabledHint', 'Balance/EQ sind für YouTube-/Spotify-Clips nicht verfügbar') : undefined;

  return (
    <div className="channel-row">
      <div className="channel-row__status">
        <button
          type="button"
          className="channel-row__status-icon"
          aria-pressed={isPlayingAny}
          aria-label={isPlayingAny ? t('audioChannelPause', 'Kanal pausieren') : t('audioChannelPlay', 'Kanal abspielen')}
          title={isPlayingAny ? t('audioChannelPause', 'Kanal pausieren') : t('audioChannelPlay', 'Kanal abspielen')}
          onClick={onTogglePlayback}
        >
          {isPlayingAny ? '⏸' : '▶'}
        </button>
        <div className={`channel-row__waveform${isPlayingAny ? ' is-active' : ''}`} aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="channel-row__bar" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      </div>

      <div className="channel-row__name-block">
        <div className="channel-row__name">{channel.name || t('audioChannelUnnamed', 'Kanal')}</div>
        <div className="channel-row__chips">
          <span className="channel-row__chip">
            {channel.mode === 'add' ? t('audioModeAdd', 'Hinzufügen') : t('audioModeReplace', 'Ersetzen')}
          </span>
          <span className="channel-row__chip">
            {channel.transition_type === 'fade' ? <FadeIcon /> : <CutIcon />}
            {channel.transition_type === 'fade' ? t('audioTransitionFade', 'Überblenden') : t('audioTransitionCut', 'Schnitt')}
          </span>
        </div>
      </div>

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
        <button
          type="button"
          className="channel-row__mixer-toggle"
          aria-expanded={mixerExpanded}
          aria-label={t('audioMixerToggle', 'Balance & EQ')}
          title={t('audioMixerToggle', 'Balance & EQ')}
          onClick={() => setMixerExpanded((v) => !v)}
        >
          🎚
        </button>

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

      {mixerExpanded && (
        <div className="channel-row__settings-popover" role="group" aria-label={t('audioMixerToggle', 'Balance & EQ')}>
          <label className="channel-row__balance" title={eqDisabledTitle}>
            {t('audioBalance', 'Balance')}
            <input
              type="range" min={-1} max={1} step={0.01}
              value={channel.balance}
              disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ balance: Number(e.target.value) })}
            />
          </label>
          <label title={eqDisabledTitle}>
            {t('audioEqLow', 'Bass')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_low} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_low: Number(e.target.value) })} />
          </label>
          <label title={eqDisabledTitle}>
            {t('audioEqMid', 'Mitten')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_mid} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_mid: Number(e.target.value) })} />
          </label>
          <label title={eqDisabledTitle}>
            {t('audioEqHigh', 'Höhen')}
            <input type="range" min={-12} max={12} step={0.5} value={channel.eq_high} disabled={hasActiveLinkClip}
              onChange={(e) => onMixerChange({ eq_high: Number(e.target.value) })} />
          </label>
          <Button onClick={() => setMixerExpanded(false)}>
            {t('audioSettingsClose', 'Schließen')}
          </Button>
        </div>
      )}

      {settingsOpen && (
        <div className="channel-row__settings-popover" role="dialog" aria-label={t('audioChannelSettings', 'Kanaleinstellungen')}>
          <label>
            {t('audioChannelName', 'Kanalname')}
            <input
              type="text" value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => { if (nameDraft !== channel.name) onRenameChannel(nameDraft); }}
            />
          </label>
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
          <Button onClick={() => setSettingsOpen(false)}>
            {t('audioSettingsClose', 'Schließen')}
          </Button>
        </div>
      )}
    </div>
  );
}
