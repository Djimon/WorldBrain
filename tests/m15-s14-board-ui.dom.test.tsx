// M15-S14: Board-UI (Streamdeck) — Kanäle, Clip-Buttons, Mixer-Controls
// See: https://github.com/Djimon/WorldBrain/issues/285
// Concept art: _design/soundboard concept.png

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChannelRow } from '../src/ui/ChannelRow';
import type { ChannelWithPresets } from '../src/ui/ChannelRow';
import type { AudioPresetRow } from '../src/services/audio-service';

function makeChannel(overrides: Partial<ChannelWithPresets> = {}): ChannelWithPresets {
  return {
    id: 'chan_1', scene_id: 'scene_1', name: 'Music', order_index: 0,
    mode: 'replace', volume: 1, balance: 0, eq_low: 0, eq_mid: 0, eq_high: 0,
    transition_type: 'fade', transition_seconds: 2, muted: 0,
    presets: [],
    ...overrides,
  };
}

function makePreset(overrides: Partial<AudioPresetRow> = {}): AudioPresetRow {
  return {
    id: 'clip_1', channel_id: 'chan_1', order_index: 0, source_type: 'file', source_ref: 'a.mp3',
    base_volume: 1, label: 'Clip', icon: '🎵', color: '#3355ff', loop: 0, created_at: '',
    ...overrides,
  };
}

describe('M15-S14 ChannelRow', () => {
  it('renders the channel name', () => {
    render(<ChannelRow channel={makeChannel({ name: 'Ambience' })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    expect(screen.getByText('Ambience')).toBeInTheDocument();
  });

  it('renders exactly 8 clip slots — existing presets plus empty add-slots', () => {
    const presets = [makePreset({ id: 'a', label: 'Rain' }), makePreset({ id: 'b', label: 'Thunder' })];
    render(<ChannelRow channel={makeChannel({ presets })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Rain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thunder' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clip hinzufügen' })).toHaveLength(6);
  });

  it('clip icon/label/color render on the clip button', () => {
    const presets = [makePreset({ id: 'a', label: 'Rain', icon: '🌧️', color: '#204060' })];
    render(<ChannelRow channel={makeChannel({ presets })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Rain' });
    expect(button.textContent).toContain('🌧️');
    expect(button.style.backgroundColor).toBe('rgb(32, 64, 96)');
  });

  it('clicking a clip button calls onTriggerClip with that preset', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    const onTriggerClip = vi.fn();
    render(<ChannelRow channel={makeChannel({ presets: [preset] })} activeClipIds={new Set()} onTriggerClip={onTriggerClip} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    expect(onTriggerClip).toHaveBeenCalledWith(preset);
  });

  it('clicking an empty slot calls onEditClip with a null presetId', () => {
    const onEditClip = vi.fn();
    render(<ChannelRow channel={makeChannel()} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={onEditClip} onMixerChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Clip hinzufügen' })[0]);
    expect(onEditClip).toHaveBeenCalledWith('chan_1', null);
  });

  it('clicking a clip\'s edit affordance calls onEditClip without triggering playback', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    const onTriggerClip = vi.fn();
    const onEditClip = vi.fn();
    render(<ChannelRow channel={makeChannel({ presets: [preset] })} activeClipIds={new Set()} onTriggerClip={onTriggerClip} onEditClip={onEditClip} onMixerChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clip bearbeiten' }));
    expect(onEditClip).toHaveBeenCalledWith('chan_1', 'a');
    expect(onTriggerClip).not.toHaveBeenCalled();
  });

  it('active clip is highlighted (aria-pressed)', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    render(<ChannelRow channel={makeChannel({ presets: [preset] })} activeClipIds={new Set(['a'])} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Rain', pressed: true })).toBeInTheDocument();
  });

  it('renders a volume slider with a dB readout', () => {
    render(<ChannelRow channel={makeChannel({ volume: 0.5 })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
    expect(screen.getByLabelText(/Lautstärke/)).toBeInTheDocument();
    expect(screen.getByText(/dB/)).toBeInTheDocument();
  });

  it('changing the volume slider calls onMixerChange', () => {
    const onMixerChange = vi.fn();
    render(<ChannelRow channel={makeChannel()} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={onMixerChange} />);
    fireEvent.change(screen.getByLabelText(/Lautstärke/), { target: { value: '0.3' } });
    expect(onMixerChange).toHaveBeenCalledWith({ volume: 0.3 });
  });

  it('renders a mute button that toggles muted', () => {
    const onMixerChange = vi.fn();
    render(<ChannelRow channel={makeChannel({ muted: 0 })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={onMixerChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stumm' }));
    expect(onMixerChange).toHaveBeenCalledWith({ muted: true });
  });

  describe('mode + transition config popover', () => {
    it('opens on the settings button and shows mode + transition controls', () => {
      render(<ChannelRow channel={makeChannel({ mode: 'add', transition_type: 'cut', transition_seconds: 1 })} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Kanaleinstellungen' }));
      const dialog = screen.getByRole('dialog', { name: 'Kanaleinstellungen' });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByLabelText(/Modus/)).toHaveValue('add');
      expect(screen.getByLabelText(/Übergang/)).toHaveValue('cut');
      expect(screen.getByLabelText(/Sekunden/)).toHaveValue(1);
    });

    it('changing mode calls onMixerChange', () => {
      const onMixerChange = vi.fn();
      render(<ChannelRow channel={makeChannel()} activeClipIds={new Set()} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={onMixerChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'Kanaleinstellungen' }));
      fireEvent.change(screen.getByLabelText(/Modus/), { target: { value: 'add' } });
      expect(onMixerChange).toHaveBeenCalledWith({ mode: 'add' });
    });
  });

  describe('balance + 3-band EQ', () => {
    it('are enabled when no active clip on the channel is a link', () => {
      const preset = makePreset({ id: 'a', source_type: 'file' });
      render(<ChannelRow channel={makeChannel({ presets: [preset] })} activeClipIds={new Set(['a'])} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
      expect(screen.getByLabelText(/Balance/)).not.toBeDisabled();
      expect(screen.getByLabelText(/Bass/)).not.toBeDisabled();
    });

    it('are disabled when the active clip is a YouTube link clip', () => {
      const preset = makePreset({ id: 'yt1', source_type: 'link', source_ref: 'https://youtu.be/x' });
      render(<ChannelRow channel={makeChannel({ presets: [preset] })} activeClipIds={new Set(['yt1'])} onTriggerClip={vi.fn()} onEditClip={vi.fn()} onMixerChange={vi.fn()} />);
      expect(screen.getByLabelText(/Balance/)).toBeDisabled();
      expect(screen.getByLabelText(/Bass/)).toBeDisabled();
      expect(screen.getByLabelText(/Mitten/)).toBeDisabled();
      expect(screen.getByLabelText(/Höhen/)).toBeDisabled();
    });
  });
});
