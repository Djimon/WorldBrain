// M15-S16: Clip-Editor — Quelle, Basis-Lautstärke, Icon/Farbe/Label, Loop
// See: https://github.com/Djimon/WorldBrain/issues/287

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipEditor } from '../src/ui/ClipEditor';
import type { DatabaseLike } from '../src/services/entity-service';

const { serviceMocks, dialogMocks, assetMocks } = vi.hoisted(() => ({
  serviceMocks: {
    listPresets: vi.fn(),
    createPreset: vi.fn(),
    updatePreset: vi.fn(),
    deletePreset: vi.fn(),
  },
  dialogMocks: { open: vi.fn() },
  assetMocks: { copyAudioAsset: vi.fn() },
}));

vi.mock('../src/services/audio-service', async () => {
  const actual = await vi.importActual<typeof import('../src/services/audio-service')>('../src/services/audio-service');
  return { ...actual, ...serviceMocks };
});
vi.mock('@tauri-apps/plugin-dialog', () => dialogMocks);
vi.mock('../src/services/audio-asset', () => assetMocks);

const fakeDb = { execute: vi.fn(), select: vi.fn() } as unknown as DatabaseLike;

const EXISTING_PRESET = {
  id: 'clip_1', channel_id: 'chan_1', order_index: 0, source_type: 'file' as const, source_ref: '/proj/assets/audio/rain.mp3',
  base_volume: 0.8, label: 'Rain', icon: '🌧️', color: '#1d5f7b', loop: 1, created_at: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listPresets.mockResolvedValue([EXISTING_PRESET]);
});

describe('M15-S16 ClipEditor', () => {
  it('creating a new clip: sets source (file via Tauri dialog), label, base volume, icon, color, loop, then saves', async () => {
    dialogMocks.open.mockResolvedValue('C:/music/thunder.mp3');
    assetMocks.copyAudioAsset.mockResolvedValue('/proj/assets/audio/thunder_abcd1234.mp3');
    serviceMocks.createPreset.mockResolvedValue({ id: 'clip_new' });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId={null} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Datei wählen…' }));
    await waitFor(() => expect(assetMocks.copyAudioAsset).toHaveBeenCalledWith('C:/music/thunder.mp3', '/proj', expect.stringMatching(/^thunder_/)));
    await screen.findByText('/proj/assets/audio/thunder_abcd1234.mp3');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thunder' } });
    fireEvent.change(screen.getByLabelText(/Basis-Lautstärke/), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Icon wählen' }));
    fireEvent.click(screen.getByRole('button', { name: /^fire$/i }));
    fireEvent.click(screen.getByRole('button', { name: '#7b1d1d' }));
    fireEvent.click(screen.getByLabelText(/Endlos wiederholen/));

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(serviceMocks.createPreset).toHaveBeenCalledWith(fakeDb, {
      channel_id: 'chan_1',
      source_type: 'file',
      source_ref: '/proj/assets/audio/thunder_abcd1234.mp3',
      base_volume: 0.5,
      label: 'Thunder',
      icon: '🔥',
      color: '#7b1d1d',
      loop: true,
    }));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('a link source accepts a URL directly, including a playlist URL — saved as exactly one clip', async () => {
    serviceMocks.createPreset.mockResolvedValue({ id: 'clip_new' });
    render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Quelle'), { target: { value: 'link' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://www.youtube.com/watch?v=abc&list=PLxyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(serviceMocks.createPreset).toHaveBeenCalledTimes(1));
    expect(serviceMocks.createPreset).toHaveBeenCalledWith(fakeDb, expect.objectContaining({
      source_type: 'link',
      source_ref: 'https://www.youtube.com/watch?v=abc&list=PLxyz',
    }));
  });

  it('editing an existing clip loads its current values', async () => {
    render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId="clip_1" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByDisplayValue('Rain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Icon wählen' }).textContent).toBe('🌧️');
    expect(screen.getByRole('button', { name: '#1d5f7b', pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText(/Endlos wiederholen/)).toBeChecked();
  });

  it('saving an edited clip calls updatePreset, not createPreset', async () => {
    serviceMocks.updatePreset.mockResolvedValue(undefined);
    render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId="clip_1" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByDisplayValue('Rain');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Heavy Rain' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(serviceMocks.updatePreset).toHaveBeenCalledWith(fakeDb, 'clip_1', expect.objectContaining({ label: 'Heavy Rain' })));
    expect(serviceMocks.createPreset).not.toHaveBeenCalled();
  });

  describe('delete: rendered confirm dialog, no window.confirm()', () => {
    it('shows a rendered confirm dialog instead of deleting immediately', async () => {
      render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId="clip_1" onClose={vi.fn()} onSaved={vi.fn()} />);
      await screen.findByDisplayValue('Rain');
      fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
      expect(screen.getByRole('dialog', { name: 'Clip löschen?' })).toBeInTheDocument();
      expect(serviceMocks.deletePreset).not.toHaveBeenCalled();
    });

    it('confirming deletes the clip', async () => {
      render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId="clip_1" onClose={vi.fn()} onSaved={vi.fn()} />);
      await screen.findByDisplayValue('Rain');
      fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
      fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
      await waitFor(() => expect(serviceMocks.deletePreset).toHaveBeenCalledWith(fakeDb, 'clip_1'));
    });

    it('a brand new (unsaved) clip has no delete button', () => {
      render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId={null} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    });
  });

  it('file picking never uses window.prompt/alert/confirm', async () => {
    dialogMocks.open.mockResolvedValue('C:/music/a.mp3');
    assetMocks.copyAudioAsset.mockResolvedValue('/proj/assets/audio/a_1.mp3');
    const promptSpy = vi.spyOn(window, 'prompt');
    render(<ClipEditor database={fakeDb} projectDir="/proj" channelId="chan_1" presetId={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Datei wählen…' }));
    await waitFor(() => expect(dialogMocks.open).toHaveBeenCalled());
    expect(promptSpy).not.toHaveBeenCalled();
  });
});
