// @vitest-environment jsdom
// M10 / #423 (S4): Spotlight "coming soon" stub view. Whiteboard is not built for 0.1;
// the spotlight sidebar view (mount from S1/#420) shows a clear coming-soon stub
// (warning chip + title + teaser), reached through the REAL WorkspaceShell mount.
// See: https://github.com/Djimon/WorldBrain/issues/423
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stable db singleton (vi.hoisted) — a fresh object per render would re-fire the host
// transport effect (dep: database) endlessly → OOM.
const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../src/services/webrtc-transport', () => ({
  WebRtcTransport: {
    host: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      attachSignaling: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(() => () => {}),
      send: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));
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
  useDatabase: () => db,
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
vi.mock('../src/services/map-service', () => ({ listMaps: vi.fn().mockResolvedValue([]), importMapImage: vi.fn() }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn().mockResolvedValue([]),
  analyzeRoleCoverage: vi.fn().mockResolvedValue([]),
  detectQuestBlockers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/services/calendar-service', () => ({ listCalendars: vi.fn().mockResolvedValue([]), setActiveCalendar: vi.fn(), deleteCalendar: vi.fn() }));
vi.mock('../../core_data/calendar-schema', () => ({ formatCalendarDate: vi.fn().mockReturnValue('') }));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(), createCampaignEventEntity: vi.fn() }));
vi.mock('../src/services/map-layer-service', () => ({ importImageLayer: vi.fn(), createFogLayer: vi.fn() }));
vi.mock('../src/services/campaign-service', () => ({
  listCampaigns: vi.fn().mockResolvedValue([]),
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-1', title: 'Default Campaign' }),
}));
vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({ once: vi.fn(), listen: vi.fn() }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  (WebviewWindow as unknown as Record<string, unknown>).getCurrent = vi.fn().mockReturnValue({ setTitle: vi.fn().mockResolvedValue(undefined) });
  return { WebviewWindow };
});
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn().mockResolvedValue('') }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: vi.fn().mockResolvedValue(''), writeTextFile: vi.fn().mockResolvedValue(undefined), exists: vi.fn().mockResolvedValue(false) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null) }));

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
vi.mock('../src/ui/LobbyPanel', () => ({ LobbyPanel: stubComponent('LobbyPanel') }));
vi.mock('../src/ui/SessionTimeBar', () => ({ SessionTimeBar: stubComponent('SessionTimeBar') }));
vi.mock('../src/ui/SessionTimeControls', () => ({ SessionTimeControls: stubComponent('SessionTimeControls') }));
vi.mock('../src/ui/PlayCockpitMap', () => ({ PlayCockpitMap: stubComponent('PlayCockpitMap') }));
vi.mock('../src/ui/PlayerJoinView', () => ({ PlayerJoinView: stubComponent('PlayerJoinView') }));
vi.mock('../src/ui/PlaySettingsPanel', () => ({ PlaySettingsPanel: stubComponent('PlaySettingsPanel') }));
vi.mock('../src/ui/SettingsPanel', () => ({ SettingsPanel: stubComponent('SettingsPanel') }));
vi.mock('../src/ui/primitives', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('button', props),
  Panel: (props: Record<string, unknown>) => React.createElement('div', props),
  Field: (props: Record<string, unknown>) => React.createElement('input', props),
  StatusChip: ({ children, tone, ...props }: { children?: React.ReactNode; tone?: string } & Record<string, unknown>) =>
    React.createElement('span', { 'data-tone': tone, ...props }, children),
  Segmented: ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: readonly { id: string; label: React.ReactNode }[];
    onChange: (id: string) => void;
  }) => React.createElement('div', { role: 'group', 'aria-label': label },
    options.map((opt) => React.createElement('button',
      { key: opt.id, 'aria-pressed': opt.id === value, onClick: () => onChange(opt.id) }, opt.label))),
}));

afterEach(cleanup);

async function getShell() {
  const mod = await import('../src/ui/WorkspaceShell');
  return mod.WorkspaceShell;
}

const playSeg = () => screen.getByRole('button', { name: 'Spielen' });
const asDm = () => screen.getByRole('button', { name: /Als DM/i });
const sidebar = () => document.querySelector('nav.workspace-shell__sidebar') as HTMLElement;

async function openSpotlight() {
  const Shell = await getShell();
  render(React.createElement(Shell));
  fireEvent.click(playSeg());
  await waitFor(() => expect(asDm()).toBeTruthy());
  fireEvent.click(asDm());
  await waitFor(() => expect(screen.getByTestId('stub-LobbyPanel')).toBeTruthy());
  fireEvent.click(sidebar().querySelector('[data-area="spotlight"]') as HTMLElement);
}

describe('#423 (S4) spotlight coming-soon stub', () => {
  it('shows a warning "soon" chip in the spotlight view', async () => {
    await openSpotlight();
    await waitFor(() => {
      const chip = screen.getByText('soon');
      expect(chip).toBeTruthy();
      expect(chip.getAttribute('data-tone')).toBe('warning');
    });
  });

  it('shows the spotlight title and a teaser (no dead/empty surface)', async () => {
    await openSpotlight();
    await waitFor(() => expect(screen.getByText('cockpit.spotlightTitle')).toBeTruthy());
    expect(screen.getByText('play.spotlightTeaser')).toBeTruthy();
  });

  it('the stub is not an interactive blind element (no buttons in the spotlight panel)', async () => {
    await openSpotlight();
    await waitFor(() => expect(screen.getByText('cockpit.spotlightTitle')).toBeTruthy());
    const panel = screen.getByText('cockpit.spotlightTitle').closest('.workspace-area');
    expect(panel?.querySelector('button')).toBeNull();
  });
});
