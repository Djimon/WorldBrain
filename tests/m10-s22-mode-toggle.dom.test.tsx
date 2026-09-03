// @vitest-environment jsdom
// M10-S22: App-Mode-Shell — Top-Bar-Toggle + Mode/Rolle/Session-Kontext + Menü-Reduktion (D25)
// See: https://github.com/Djimon/WorldBrain/issues/342

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Mocks — WorkspaceShell has ~30 imports; every one must be stubbed
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string | Record<string, unknown>) => {
      if (d === undefined) return k;
      if (typeof d === 'string') return d;
      if (typeof d === 'object' && 'defaultValue' in d) return String(d.defaultValue);
      return k;
    },
    i18n: { language: 'de', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../src/services/DatabaseContext', () => ({
  useDatabase: () => ({
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
  }),
  DatabaseContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../src/services/plugin-entity-service', () => ({
  listEntityTypes: vi.fn().mockReturnValue([]),
  registerPluginEntityType: vi.fn(),
  getEntityType: vi.fn(),
  registerPluginRelationType: vi.fn(),
  getRelationTypeDefinition: vi.fn(),
  listPluginRelationTypes: vi.fn().mockReturnValue([]),
  flagOutdatedSchema: vi.fn(),
}));

vi.mock('../src/services/map-service', () => ({
  listMaps: vi.fn().mockResolvedValue([]),
  importMapImage: vi.fn(),
}));

vi.mock('../src/services/saved-views-service', () => ({
  listViews: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/services/rule-import-service', () => ({
  importRules: vi.fn(),
}));

vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn().mockResolvedValue([]),
  analyzeRoleCoverage: vi.fn().mockResolvedValue([]),
  detectQuestBlockers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn().mockResolvedValue([]),
  setActiveCalendar: vi.fn(),
  deleteCalendar: vi.fn(),
}));

vi.mock('../../core_data/calendar-schema', () => ({
  formatCalendarDate: vi.fn().mockReturnValue(''),
}));

vi.mock('../src/services/event-entity-service', () => ({
  createEventEntity: vi.fn(),
}));

vi.mock('../src/services/map-layer-service', () => ({
  importImageLayer: vi.fn(),
  createFogLayer: vi.fn(),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({
    once: vi.fn(),
    listen: vi.fn(),
  }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  return { WebviewWindow };
});

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn().mockResolvedValue(''),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockResolvedValue(''),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

// Stub all UI component imports
const stubComponent = (name: string) =>
  (props: Record<string, unknown>) => React.createElement('div', { 'data-testid': `stub-${name}`, ...props });

vi.mock('../src/ui/EntityMasterDetail', () => ({ EntityMasterDetail: stubComponent('EntityMasterDetail') }));
vi.mock('../src/ui/EntityDetailView', () => ({ EntityDetailView: stubComponent('EntityDetailView') }));
vi.mock('../src/ui/GlobalSearch', () => ({ GlobalSearch: stubComponent('GlobalSearch') }));
vi.mock('../src/ui/ChronicleView', () => ({ ChronicleView: stubComponent('ChronicleView') }));
vi.mock('../src/ui/CalendarWizard', () => ({ CalendarWizard: stubComponent('CalendarWizard') }));
vi.mock('../src/ui/CalendarMonthView', () => ({ CalendarMonthView: stubComponent('CalendarMonthView') }));
vi.mock('../src/ui/CalendarLinkPanel', () => ({ CalendarLinkPanel: stubComponent('CalendarLinkPanel') }));
vi.mock('../src/ui/CardList', () => ({ CardList: stubComponent('CardList') }));
vi.mock('../src/ui/CardCreationFlow', () => ({ CardCreationFlow: stubComponent('CardCreationFlow') }));
vi.mock('../src/ui/PrintSheetComposer', () => ({ PrintSheetComposer: stubComponent('PrintSheetComposer') }));
vi.mock('../src/ui/PluginManager', () => ({ PluginManager: stubComponent('PluginManager') }));
vi.mock('../src/ui/DmScreen', () => ({ DmScreen: stubComponent('DmScreen'), DmScreenSelector: stubComponent('DmScreenSelector') }));
vi.mock('../src/ui/SnapshotManager', () => ({ SnapshotManager: stubComponent('SnapshotManager') }));
vi.mock('../src/ui/UpdateNotification', () => ({ UpdateNotification: stubComponent('UpdateNotification') }));
vi.mock('../src/ui/MapViewer', () => ({ MapViewer: stubComponent('MapViewer') }));
vi.mock('../src/ui/GlobalGraphView', () => ({ GlobalGraphView: stubComponent('GlobalGraphView') }));
vi.mock('../src/ui/LayerPanel', () => ({ LayerPanel: stubComponent('LayerPanel') }));
vi.mock('../src/ui/MapsSidebarTabs', () => ({ MapsSidebarTabs: stubComponent('MapsSidebarTabs') }));
vi.mock('../src/ui/MapFolderTree', () => ({ MapFolderTree: stubComponent('MapFolderTree') }));
vi.mock('../src/ui/LanguageSwitcher', () => ({ LanguageSwitcher: stubComponent('LanguageSwitcher') }));
vi.mock('../src/ui/ThemeToggle', () => ({ ThemeToggle: stubComponent('ThemeToggle') }));
vi.mock('../src/ui/primitives', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('button', props),
  Panel: (props: Record<string, unknown>) => React.createElement('div', props),
  Field: (props: Record<string, unknown>) => React.createElement('input', props),
  StatusChip: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('span', props, children),
  // Realistischer Mock: role="group" + aria-label + einzelne Buttons pro
  // Segment (Text = label, aria-pressed spiegelt value). Genau das Kontrakt-
  // Verhalten von Segmented, das die Tests via getByRole finden.
  Segmented: ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly { id: string; label: React.ReactNode }[];
    onChange: (id: string) => void;
  }) => React.createElement(
    'div',
    { role: 'group', 'aria-label': label },
    options.map((opt) => React.createElement(
      'button',
      {
        key: opt.id,
        'aria-pressed': opt.id === value,
        onClick: () => onChange(opt.id),
      },
      opt.label,
    )),
  ),
}));

// #420 (S1): the cockpit (PlayModeView) is dissolved into play-sidebar views. Stub the
// play children; the DM lobby view (stub-LobbyPanel) is the "in DM play mode" marker.
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeControl', () => ({ SessionTimeControl: stubComponent('SessionTimeControl') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Source guards
// ---------------------------------------------------------------------------

describe('M10-S22 Source guards', () => {
  it('WorkspaceShell mounts a Segmented mode toggle from primitives', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    // Der Toggle wird aus dem primitives-Segmented gerendert — Test findet
    // ihn zur Laufzeit über role="group" + aria-label (RTL-Idiom, siehe
    // Integrationstests). Source-Guard nur, dass Segmented importiert und
    // mit Modus-Label gemountet wird.
    expect(source).toMatch(/import.*Segmented.*from.*primitives/);
    expect(source).toMatch(/label=\{t\(['"]modeToggleLabel['"]/);
  });

  it('WorkspaceShell has mode state (edit|play)', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/useState.*['"]edit['"]/);
  });

  it('AppModeContext exists and is exported', () => {
    const source = readFileSync('src/ui/AppModeContext.tsx', 'utf-8');
    expect(source).toMatch(/export.*AppModeContext/);
  });
});

// ---------------------------------------------------------------------------
// Integration tests through real WorkspaceShell mount
// ---------------------------------------------------------------------------

describe('M10-S22 Mode toggle integration', () => {
  async function getWorkspaceShell() {
    const mod = await import('../src/ui/WorkspaceShell');
    return mod.WorkspaceShell;
  }
  // Segmented rendert als role="group" mit aria-label; die einzelnen
  // Segmente sind Buttons ('Bearbeiten' / 'Spielen'). RTL-Idiom: über
  // Rolle + Accessible-Name suchen, kein data-testid.
  const modeToggle = () => screen.getByRole('group', { name: 'Modus' });
  const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
  const editSeg = () => screen.getByRole('button', { name: 'Bearbeiten' });
  const asDm = () => screen.getByRole('button', { name: /Als DM/i });
  const asPlayer = () => screen.getByRole('button', { name: /Als Player/i });

  it('mode-toggle is rendered in WorkspaceShell', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    expect(modeToggle()).toBeTruthy();
  });

  it('default mode is edit — full AREAS menu visible', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    await waitFor(() => {
      expect(modeToggle()).toBeTruthy();
    });
    const sidebar = document.querySelector('[class*="sidebar"], nav, [role="navigation"]');
    expect(sidebar?.textContent).toMatch(/🌌/);
    expect(sidebar?.textContent).toMatch(/🎧/);
  });

  it('#397: edit mode has NO campaigns area (🎭) in the sidebar', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    await waitFor(() => {
      expect(modeToggle()).toBeTruthy();
    });
    const sidebar = document.querySelector('[class*="sidebar"], nav, [role="navigation"]');
    // Campaign-Bereich per Entscheidung entfernt (Lobby im Play-Modus ersetzt ihn,
    // eine Campaign = eine Gruppe). Weder Bereichs-Knopf noch das 🎭-Emoji.
    expect(sidebar?.querySelector('[data-area="campaigns"]')).toBeNull();
    expect(sidebar?.textContent).not.toMatch(/🎭/);
  });

  it('clicking play → role selection → dm → play mode with reduced menu', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    fireEvent.click(playSeg());
    await waitFor(() => {
      expect(asDm()).toBeTruthy();
    });
    fireEvent.click(asDm());
    await waitFor(() => {
      expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy();
    });
    const sidebar = document.querySelector('[class*="sidebar"], nav, [role="navigation"]');
    expect(sidebar?.textContent).not.toMatch(/🌌/);
    expect(sidebar?.textContent).not.toMatch(/🎧/);
    // #390: der Edit-Einstellungsbereich (project ⚙) bleibt im Play-Modus verborgen;
    // stattdessen erscheint der Play-scoped Einstellungsbereich (play-settings ⚙).
    // Beide nutzen ⚙ → präzise über data-area statt über das Emoji prüfen.
    expect(sidebar?.querySelector('[data-area="project"]')).toBeNull();
    expect(sidebar?.querySelector('[data-area="play-settings"]')).toBeTruthy();
  });

  it('switching back to edit restores full menu', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    fireEvent.click(playSeg());
    await waitFor(() => asDm());
    fireEvent.click(asDm());
    await waitFor(() => screen.getByTestId('stub-LobbyPanel'));
    fireEvent.click(editSeg());
    await waitFor(() => {
      const sidebar = document.querySelector('[class*="sidebar"], nav, [role="navigation"]');
      expect(sidebar?.textContent).toMatch(/🌌/);
    });
  });

  it('play mode as player sets sessionRole=player (no dm-cockpit)', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    fireEvent.click(playSeg());
    await waitFor(() => asPlayer());
    fireEvent.click(asPlayer());
    await waitFor(() => {
      expect(screen.queryByTestId('stub-LobbyPanel')).toBeNull();
    });
  });

  it('mode-toggle is visible in both modes (aria-pressed tracks state)', async () => {
    const Shell = await getWorkspaceShell();
    render(React.createElement(Shell));
    expect(modeToggle()).toBeTruthy();
    fireEvent.click(playSeg());
    await waitFor(() => asDm());
    fireEvent.click(asDm());
    await waitFor(() => screen.getByTestId('stub-LobbyPanel'));
    expect(modeToggle()).toBeTruthy();
    // aria-pressed spiegelt den aktiven Modus wider.
    expect(playSeg().getAttribute('aria-pressed')).toBe('true');
    expect(editSeg().getAttribute('aria-pressed')).toBe('false');
  });
});
