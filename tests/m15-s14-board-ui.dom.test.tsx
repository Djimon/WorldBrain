// M15-S14: Board-UI (Streamdeck) — Kanäle, Clip-Buttons, Mixer-Controls
// See: https://github.com/Djimon/WorldBrain/issues/285
// Concept art: _design/soundboard concept.png

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChannelRow } from '../src/ui/ChannelRow';
import type { ChannelRowProps, ChannelWithPresets } from '../src/ui/ChannelRow';
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

function renderRow(overrides: Partial<ChannelRowProps> = {}) {
  const props: ChannelRowProps = {
    channel: makeChannel(),
    activeClipIds: new Set(),
    onTriggerClip: vi.fn(),
    onEditClip: vi.fn(),
    onMixerChange: vi.fn(),
    onTogglePlayback: vi.fn(),
    onRenameChannel: vi.fn(),
    ...overrides,
  };
  return { ...render(<ChannelRow {...props} />), props };
}

function openMixer() {
  fireEvent.click(screen.getByRole('button', { name: 'Balance & EQ' }));
}

function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Kanaleinstellungen' }));
}

describe('M15-S14 ChannelRow', () => {
  it('renders the channel name', () => {
    renderRow({ channel: makeChannel({ name: 'Ambience' }) });
    expect(screen.getByText('Ambience')).toBeInTheDocument();
  });

  describe('mode + transition chips (below the name)', () => {
    it('shows a "Hinzufügen" chip for add mode', () => {
      renderRow({ channel: makeChannel({ mode: 'add' }) });
      expect(screen.getByText('Hinzufügen')).toBeInTheDocument();
    });

    it('shows an "Ersetzen" chip for replace mode', () => {
      renderRow({ channel: makeChannel({ mode: 'replace' }) });
      expect(screen.getByText('Ersetzen')).toBeInTheDocument();
    });

    it('shows a "Schnitt" chip with a cut icon for cut transitions', () => {
      const { container } = renderRow({ channel: makeChannel({ transition_type: 'cut' }) });
      expect(screen.getByText('Schnitt')).toBeInTheDocument();
      expect(container.querySelectorAll('svg')).toHaveLength(1);
    });

    it('shows an "Überblenden" chip with a fade icon for fade transitions', () => {
      const { container } = renderRow({ channel: makeChannel({ transition_type: 'fade' }) });
      expect(screen.getByText('Überblenden')).toBeInTheDocument();
      expect(container.querySelectorAll('svg')).toHaveLength(1);
    });
  });

  it('renders exactly 8 clip slots — existing presets plus empty add-slots', () => {
    const presets = [makePreset({ id: 'a', label: 'Rain' }), makePreset({ id: 'b', label: 'Thunder' })];
    renderRow({ channel: makeChannel({ presets }) });
    expect(screen.getByRole('button', { name: 'Rain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thunder' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clip hinzufügen' })).toHaveLength(6);
  });

  it('clip icon/label/color render on the clip button', () => {
    const presets = [makePreset({ id: 'a', label: 'Rain', icon: '🌧️', color: '#204060' })];
    renderRow({ channel: makeChannel({ presets }) });
    const button = screen.getByRole('button', { name: 'Rain' });
    expect(button.textContent).toContain('🌧️');
    expect(button.style.backgroundColor).toBe('rgb(32, 64, 96)');
  });

  it('clicking a clip button calls onTriggerClip with that preset', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    const onTriggerClip = vi.fn();
    renderRow({ channel: makeChannel({ presets: [preset] }), onTriggerClip });
    fireEvent.click(screen.getByRole('button', { name: 'Rain' }));
    expect(onTriggerClip).toHaveBeenCalledWith(preset);
  });

  it('clicking an empty slot calls onEditClip with a null presetId', () => {
    const onEditClip = vi.fn();
    renderRow({ onEditClip });
    fireEvent.click(screen.getAllByRole('button', { name: 'Clip hinzufügen' })[0]);
    expect(onEditClip).toHaveBeenCalledWith('chan_1', null);
  });

  it('clicking a clip\'s edit affordance calls onEditClip without triggering playback', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    const onTriggerClip = vi.fn();
    const onEditClip = vi.fn();
    renderRow({ channel: makeChannel({ presets: [preset] }), onTriggerClip, onEditClip });
    fireEvent.click(screen.getByRole('button', { name: 'Clip bearbeiten' }));
    expect(onEditClip).toHaveBeenCalledWith('chan_1', 'a');
    expect(onTriggerClip).not.toHaveBeenCalled();
  });

  it('active clip is highlighted (aria-pressed)', () => {
    const preset = makePreset({ id: 'a', label: 'Rain' });
    renderRow({ channel: makeChannel({ presets: [preset] }), activeClipIds: new Set(['a']) });
    expect(screen.getByRole('button', { name: 'Rain', pressed: true })).toBeInTheDocument();
  });

  it('renders a volume slider with a dB readout', () => {
    renderRow({ channel: makeChannel({ volume: 0.5 }) });
    expect(screen.getByLabelText(/Lautstärke/)).toBeInTheDocument();
    expect(screen.getByText(/dB/)).toBeInTheDocument();
  });

  it('changing the volume slider calls onMixerChange', () => {
    const onMixerChange = vi.fn();
    renderRow({ onMixerChange });
    fireEvent.change(screen.getByLabelText(/Lautstärke/), { target: { value: '0.3' } });
    expect(onMixerChange).toHaveBeenCalledWith({ volume: 0.3 });
  });

  it('renders a mute button that toggles muted', () => {
    const onMixerChange = vi.fn();
    renderRow({ channel: makeChannel({ muted: 0 }), onMixerChange });
    fireEvent.click(screen.getByRole('button', { name: 'Stumm' }));
    expect(onMixerChange).toHaveBeenCalledWith({ muted: true });
  });

  describe('channel play/pause', () => {
    it('shows pause when the channel has an active clip, play otherwise', () => {
      const preset = makePreset({ id: 'a' });
      renderRow({ channel: makeChannel({ presets: [preset] }), activeClipIds: new Set(['a']) });
      expect(screen.getByRole('button', { name: 'Kanal pausieren' })).toBeInTheDocument();
    });

    it('shows play when nothing on the channel is active', () => {
      renderRow({ activeClipIds: new Set() });
      expect(screen.getByRole('button', { name: 'Kanal abspielen' })).toBeInTheDocument();
    });

    it('clicking the status icon calls onTogglePlayback', () => {
      const onTogglePlayback = vi.fn();
      renderRow({ onTogglePlayback });
      fireEvent.click(screen.getByRole('button', { name: 'Kanal abspielen' }));
      expect(onTogglePlayback).toHaveBeenCalled();
    });
  });

  describe('mode + transition config popover', () => {
    it('opens on the settings button and shows mode + transition controls', () => {
      renderRow({ channel: makeChannel({ mode: 'add', transition_type: 'cut', transition_seconds: 1 }) });
      fireEvent.click(screen.getByRole('button', { name: 'Kanaleinstellungen' }));
      const dialog = screen.getByRole('dialog', { name: 'Kanaleinstellungen' });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByLabelText(/Modus/)).toHaveValue('add');
      expect(screen.getByLabelText(/Übergang/)).toHaveValue('cut');
      expect(screen.getByLabelText(/Sekunden/)).toHaveValue(1);
    });

    it('changing mode calls onMixerChange', () => {
      const onMixerChange = vi.fn();
      renderRow({ onMixerChange });
      fireEvent.click(screen.getByRole('button', { name: 'Kanaleinstellungen' }));
      fireEvent.change(screen.getByLabelText(/Modus/), { target: { value: 'add' } });
      expect(onMixerChange).toHaveBeenCalledWith({ mode: 'add' });
    });

    it('shows a channel-name input pre-filled with the current name', () => {
      renderRow({ channel: makeChannel({ name: 'Ambience' }) });
      openSettings();
      expect(screen.getByLabelText(/Kanalname/)).toHaveValue('Ambience');
    });

    it('renaming commits onRenameChannel on blur, not on every keystroke', () => {
      const onRenameChannel = vi.fn();
      renderRow({ channel: makeChannel({ name: 'Music' }), onRenameChannel });
      openSettings();
      const input = screen.getByLabelText(/Kanalname/);
      fireEvent.change(input, { target: { value: 'Ambience' } });
      expect(onRenameChannel).not.toHaveBeenCalled();
      fireEvent.blur(input);
      expect(onRenameChannel).toHaveBeenCalledWith('Ambience');
    });

    it('does not call onRenameChannel on blur if the name did not change', () => {
      const onRenameChannel = vi.fn();
      renderRow({ channel: makeChannel({ name: 'Music' }), onRenameChannel });
      openSettings();
      fireEvent.blur(screen.getByLabelText(/Kanalname/));
      expect(onRenameChannel).not.toHaveBeenCalled();
    });
  });

  describe('balance + 3-band EQ — collapsed behind a toggle button', () => {
    it('are hidden until the mixer-toggle button is clicked', () => {
      renderRow();
      expect(screen.queryByLabelText(/^Balance$/)).not.toBeInTheDocument();
      openMixer();
      expect(screen.getByLabelText(/^Balance$/)).toBeInTheDocument();
    });

    it('are enabled when no active clip on the channel is a link', () => {
      const preset = makePreset({ id: 'a', source_type: 'file' });
      renderRow({ channel: makeChannel({ presets: [preset] }), activeClipIds: new Set(['a']) });
      openMixer();
      expect(screen.getByLabelText(/^Balance$/)).not.toBeDisabled();
      expect(screen.getByLabelText(/Bass/)).not.toBeDisabled();
    });

    it('are disabled when the active clip is a YouTube link clip', () => {
      const preset = makePreset({ id: 'yt1', source_type: 'link', source_ref: 'https://youtu.be/x' });
      renderRow({ channel: makeChannel({ presets: [preset] }), activeClipIds: new Set(['yt1']) });
      openMixer();
      expect(screen.getByLabelText(/^Balance$/)).toBeDisabled();
      expect(screen.getByLabelText(/Bass/)).toBeDisabled();
      expect(screen.getByLabelText(/Mitten/)).toBeDisabled();
      expect(screen.getByLabelText(/Höhen/)).toBeDisabled();
    });
  });
});
