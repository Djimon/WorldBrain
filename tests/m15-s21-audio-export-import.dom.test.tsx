// M15-S21: Audio-Soundboard Export/Import — UI (#311)
// See: https://github.com/Djimon/WorldBrain/issues/311
//
// Design entschieden (Interview 2026-07-22):
// Export-Button (rot) im Soundboard-Header, auf Höhe von "+ Neue Szene" ->
// Auswahl-Dialog (Szenenliste, Checkboxen, "Alle auswählen"/"Alle abwählen")
// -> Tauri Datei-speichern-Dialog. Import-Button daneben -> Tauri
// Datei-öffnen-Dialog -> Fehlermeldung als gerenderte UI bei ungültigem JSON
// (AP-003: kein alert()/prompt()).
//
// AP-005: ESM import only, no require(). AP-008 (RTL): Szenen-Checkboxen
// sind vielfach — within(dialog)/anankern, kein bare getBy*.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneSwitcher } from '../src/ui/SceneSwitcher';
import type { DatabaseLike } from '../src/services/entity-service';

const { serviceMocks, exportImportMocks, dialogMocks, fsMocks } = vi.hoisted(() => ({
  serviceMocks: {
    listScenes: vi.fn(),
    createScene: vi.fn(),
    renameScene: vi.fn(),
    duplicateScene: vi.fn(),
    deleteScene: vi.fn(),
    reorderScenes: vi.fn(),
  },
  exportImportMocks: {
    AUDIO_EXPORT_SCHEMA_VERSION: 1,
    exportScenesToJson: vi.fn(),
    importAudioBoardFromJson: vi.fn(),
  },
  dialogMocks: { open: vi.fn(), save: vi.fn() },
  fsMocks: { readTextFile: vi.fn(), writeTextFile: vi.fn() },
}));

vi.mock('../src/services/audio-service', () => serviceMocks);
vi.mock('../src/services/audio-export-import-service', () => exportImportMocks);
vi.mock('@tauri-apps/plugin-dialog', () => dialogMocks);
vi.mock('@tauri-apps/plugin-fs', () => fsMocks);

const fakeDb = { execute: vi.fn(), select: vi.fn() } as unknown as DatabaseLike;

const SCENES = [
  { id: 'scene_1', name: 'Tavern', order_index: 0, created_at: '' },
  { id: 'scene_2', name: 'Dungeon', order_index: 1, created_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.listScenes.mockResolvedValue(SCENES);
});

function renderSwitcher() {
  return render(<SceneSwitcher database={fakeDb} activeSceneId={null} onSelectScene={vi.fn()} />);
}

describe('#311 SceneSwitcher: Export-Button im Header, auf Höhe von "+ Neue Szene"', () => {
  it('renders a red export button alongside "+ Neue Szene"', async () => {
    renderSwitcher();
    const createBtn = await screen.findByRole('button', { name: /\+ neue szene/i });
    const exportBtn = screen.getByRole('button', { name: /export/i });
    expect(createBtn.parentElement).toBe(exportBtn.parentElement);
  });

  it('renders an import button next to the export button', async () => {
    renderSwitcher();
    await screen.findByRole('button', { name: /\+ neue szene/i });
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });
});

describe('#311 Export: Auswahl-Dialog mit Szenenliste (AC 1)', () => {
  it('clicking export opens a dialog listing every scene with a checkbox each', async () => {
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^export/i }));
    const dialog = screen.getByRole('dialog', { name: /export/i });
    expect(within(dialog).getByRole('checkbox', { name: /^tavern$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /^dungeon$/i })).toBeInTheDocument();
  });

  it('"Alle auswählen" checks every scene checkbox', async () => {
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^export/i }));
    const dialog = screen.getByRole('dialog', { name: /export/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /alle auswählen/i }));
    for (const cb of within(dialog).getAllByRole('checkbox')) expect(cb).toBeChecked();
  });

  it('"Alle abwählen" unchecks every scene checkbox', async () => {
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^export/i }));
    const dialog = screen.getByRole('dialog', { name: /export/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /alle auswählen/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /alle abwählen/i }));
    for (const cb of within(dialog).getAllByRole('checkbox')) expect(cb).not.toBeChecked();
  });

  it('exporting the selected scenes calls exportScenesToJson and writes via the Tauri save dialog (AC 2)', async () => {
    exportImportMocks.exportScenesToJson.mockResolvedValue({ schema_version: 1, scenes: [] });
    dialogMocks.save.mockResolvedValue('C:/exports/board.json');
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^export/i }));
    const dialog = screen.getByRole('dialog', { name: /export/i });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /^tavern$/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^export$/i }));

    await waitFor(() => expect(exportImportMocks.exportScenesToJson).toHaveBeenCalledWith(fakeDb, ['scene_1']));
    await waitFor(() => expect(dialogMocks.save).toHaveBeenCalled());
    await waitFor(() => expect(fsMocks.writeTextFile).toHaveBeenCalledWith(
      'C:/exports/board.json', expect.stringContaining('"schema_version"'),
    ));
  });

  it('cancelling the save dialog (no path chosen) does not write a file', async () => {
    exportImportMocks.exportScenesToJson.mockResolvedValue({ schema_version: 1, scenes: [] });
    dialogMocks.save.mockResolvedValue(null);
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^export/i }));
    const dialog = screen.getByRole('dialog', { name: /export/i });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /^tavern$/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(dialogMocks.save).toHaveBeenCalled());
    expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
  });
});

describe('#311 Import: liest JSON, persistiert additiv (AC 3)', () => {
  it('clicking import opens the Tauri file-open dialog filtered to JSON', async () => {
    dialogMocks.open.mockResolvedValue(null);
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^import/i }));
    await waitFor(() => expect(dialogMocks.open).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.arrayContaining([expect.objectContaining({ extensions: expect.arrayContaining(['json']) })]) }),
    ));
  });

  it('a chosen file is read and handed to importAudioBoardFromJson', async () => {
    dialogMocks.open.mockResolvedValue('C:/exports/board.json');
    fsMocks.readTextFile.mockResolvedValue('{"schema_version":1,"scenes":[]}');
    exportImportMocks.importAudioBoardFromJson.mockResolvedValue({ importedSceneIds: [], unlinkedFiles: [] });
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^import/i }));
    await waitFor(() => expect(fsMocks.readTextFile).toHaveBeenCalledWith('C:/exports/board.json'));
    await waitFor(() => expect(exportImportMocks.importAudioBoardFromJson).toHaveBeenCalledWith(
      fakeDb, { schema_version: 1, scenes: [] },
    ));
  });

  it('a successful import reloads the scene list', async () => {
    dialogMocks.open.mockResolvedValue('C:/exports/board.json');
    fsMocks.readTextFile.mockResolvedValue('{"schema_version":1,"scenes":[]}');
    exportImportMocks.importAudioBoardFromJson.mockResolvedValue({ importedSceneIds: ['scene_new'], unlinkedFiles: [] });
    serviceMocks.listScenes.mockResolvedValueOnce(SCENES).mockResolvedValueOnce([
      ...SCENES, { id: 'scene_new', name: 'Tavern (2)', order_index: 2, created_at: '' },
    ]);
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^import/i }));
    await waitFor(() => expect(serviceMocks.listScenes).toHaveBeenCalledTimes(2));
  });
});

describe('#311 Import: ungültiges/fremdes JSON zeigt eine gerenderte Fehlermeldung, kein alert() (AC 4/7)', () => {
  it('a broken JSON file (parse failure) renders an error message', async () => {
    dialogMocks.open.mockResolvedValue('C:/exports/broken.json');
    fsMocks.readTextFile.mockResolvedValue('{not valid json');
    const alertSpy = vi.spyOn(window, 'alert');
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^import/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a well-formed but foreign/invalid JSON (service rejects) renders an error message', async () => {
    dialogMocks.open.mockResolvedValue('C:/exports/foreign.json');
    fsMocks.readTextFile.mockResolvedValue('{"totally":"unrelated"}');
    exportImportMocks.importAudioBoardFromJson.mockRejectedValue(new Error('Invalid audio export: missing schema_version'));
    const alertSpy = vi.spyOn(window, 'alert');
    renderSwitcher();
    fireEvent.click(await screen.findByRole('button', { name: /^import/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('no prompt()/alert()/confirm() (AP-003)', () => {
  // Note: SceneSwitcher.tsx isn't source-scanned here — its header comment
  // legitimately documents "never window.confirm()", which the naive
  // regex would flag as a false positive. The actual behavioral guard is
  // the "renders a rendered error, kein alert()" spy assertions above.
  it('audio-export-import-service.ts does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/services/audio-export-import-service.ts', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
});
