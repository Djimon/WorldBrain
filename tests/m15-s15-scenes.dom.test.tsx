// M15-S15: Scenes — ganzer Board-Snapshot speichern/laden/umschalten
// See: https://github.com/Djimon/WorldBrain/issues/286

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import { SceneSwitcher } from '../src/ui/SceneSwitcher';
import { stopSceneAudio } from '../src/services/stop-scene-audio';
import type { SceneWithChannels } from '../src/services/audio-service';
import type { LocalAudioEngine } from '../src/services/local-audio-engine';
import type { YoutubeTierEngine } from '../src/services/youtube-tier-engine';
import type { SpotifyTierEngine } from '../src/services/spotify-tier-engine';

const { serviceMocks } = vi.hoisted(() => ({
  serviceMocks: {
    listScenes: vi.fn(),
    createScene: vi.fn(),
    renameScene: vi.fn(),
    duplicateScene: vi.fn(),
    deleteScene: vi.fn(),
    reorderScenes: vi.fn(),
  },
}));

vi.mock('../src/services/audio-service', () => serviceMocks);

const fakeDb = { execute: vi.fn(), select: vi.fn() } as unknown as import('../src/services/entity-service').DatabaseLike;

const SCENES = [
  { id: 'scene_1', name: 'Tavern', order_index: 0, created_at: '' },
  { id: 'scene_2', name: 'Dungeon', order_index: 1, created_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listScenes.mockResolvedValue(SCENES);
});

describe('M15-S15 SceneSwitcher', () => {
  it('renders all scenes, ordered', async () => {
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
    const items = await screen.findAllByRole('button', { name: /^(Tavern|Dungeon)$/ });
    expect(items.map((el) => el.textContent)).toEqual(['Tavern', 'Dungeon']);
  });

  it('selecting a scene calls onSelectScene with its id', async () => {
    const onSelectScene = vi.fn();
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={onSelectScene} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tavern' }));
    expect(onSelectScene).toHaveBeenCalledWith('scene_1');
  });

  it('the active scene is highlighted', async () => {
    render(<SceneSwitcher database={fakeDb} activeSceneId="scene_2" onSelectScene={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Dungeon', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tavern', pressed: false })).toBeInTheDocument();
  });

  it('creates a new scene and selects it', async () => {
    serviceMocks.createScene.mockResolvedValue({ id: 'scene_new' });
    const onSelectScene = vi.fn();
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={onSelectScene} />);
    fireEvent.click(await screen.findByRole('button', { name: '+ Neue Szene' }));
    await waitFor(() => expect(serviceMocks.createScene).toHaveBeenCalledWith(fakeDb, { name: 'Neue Szene' }));
    expect(onSelectScene).toHaveBeenCalledWith('scene_new');
  });

  it('renames a scene via the rendered inline editor', async () => {
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Umbenennen' }))[0]);
    const input = screen.getByLabelText('Szenenname');
    fireEvent.change(input, { target: { value: 'Tavern (Renamed)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(serviceMocks.renameScene).toHaveBeenCalledWith(fakeDb, 'scene_1', 'Tavern (Renamed)'));
  });

  it('duplicates a scene and selects the copy', async () => {
    serviceMocks.duplicateScene.mockResolvedValue({ id: 'scene_copy' });
    const onSelectScene = vi.fn();
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={onSelectScene} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Duplizieren' }))[0]);
    await waitFor(() => expect(serviceMocks.duplicateScene).toHaveBeenCalledWith(fakeDb, 'scene_1', 'Tavern (Kopie)'));
    expect(onSelectScene).toHaveBeenCalledWith('scene_copy');
  });

  describe('delete: rendered confirm dialog, no window.confirm()', () => {
    it('shows a rendered confirm dialog instead of calling deleteScene immediately', async () => {
      render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Löschen' }))[0]);
      expect(screen.getByRole('dialog', { name: 'Szene löschen?' })).toBeInTheDocument();
      expect(serviceMocks.deleteScene).not.toHaveBeenCalled();
    });

    it('confirming deletes the scene', async () => {
      render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Löschen' }))[0]);
      const dialog = screen.getByRole('dialog', { name: 'Szene löschen?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
      await waitFor(() => expect(serviceMocks.deleteScene).toHaveBeenCalledWith(fakeDb, 'scene_1'));
    });

    it('cancelling does not delete', async () => {
      render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Löschen' }))[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
      expect(serviceMocks.deleteScene).not.toHaveBeenCalled();
      expect(await screen.findByRole('button', { name: 'Tavern' })).toBeInTheDocument();
    });
  });

  it('reordering moves a scene and persists via reorderScenes', async () => {
    render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nach unten' }))[0]);
    await waitFor(() => expect(serviceMocks.reorderScenes).toHaveBeenCalledWith(fakeDb, ['scene_2', 'scene_1']));
  });
});

describe('M15-S15 stopSceneAudio: switching scenes stops the previous one\'s audio', () => {
  function makeScene(): SceneWithChannels {
    return {
      id: 'scene_1', name: 'Tavern', order_index: 0, created_at: '',
      channels: [
        { id: 'chan_1', scene_id: 'scene_1', name: 'Music', order_index: 0, mode: 'replace', volume: 1, balance: 0, eq_low: 0, eq_mid: 0, eq_high: 0, transition_type: 'fade', transition_seconds: 3, muted: 0, presets: [] },
        { id: 'chan_2', scene_id: 'scene_1', name: 'Ambience', order_index: 1, mode: 'add', volume: 1, balance: 0, eq_low: 0, eq_mid: 0, eq_high: 0, transition_type: 'cut', transition_seconds: 0, muted: 0, presets: [] },
      ],
    };
  }

  it('stops every channel on all three engines, respecting each channel\'s own transition', () => {
    const localEngine = { stopChannel: vi.fn() } as unknown as LocalAudioEngine;
    const youtubeEngine = { stopChannel: vi.fn() } as unknown as YoutubeTierEngine;
    const spotifyEngine = { stopChannel: vi.fn() } as unknown as SpotifyTierEngine;

    stopSceneAudio(makeScene(), localEngine, youtubeEngine, spotifyEngine);

    expect(localEngine.stopChannel).toHaveBeenCalledWith('chan_1', { transitionType: 'fade', transitionSeconds: 3 });
    expect(localEngine.stopChannel).toHaveBeenCalledWith('chan_2', { transitionType: 'cut', transitionSeconds: 0 });
    expect(youtubeEngine.stopChannel).toHaveBeenCalledWith('chan_1', { transitionType: 'fade', transitionSeconds: 3 });
    expect(youtubeEngine.stopChannel).toHaveBeenCalledWith('chan_2', { transitionType: 'cut', transitionSeconds: 0 });
    expect(spotifyEngine.stopChannel).toHaveBeenCalledWith('chan_1');
    expect(spotifyEngine.stopChannel).toHaveBeenCalledWith('chan_2');
  });
});
