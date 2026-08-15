// @vitest-environment jsdom
// M10-S22: Globaler Create↔Play-Toggle in der Top-Bar (D25)
// See: https://github.com/Djimon/WorldBrain/issues/342
//
// RED: WorkspaceShell hat keinen data-testid="mode-toggle";
//      mode-State fehlt; PlayModeView nicht als Hauptbereich verdrahtet.

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from '../src/services/entity-service';

// ── Mocks: react-i18next ──────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string | Record<string, unknown>) => {
      if (d === undefined) return k;
      if (typeof d === 'string') return d;
      if (typeof d === 'object' && 'defaultValue' in d) return String(d.defaultValue);
      return k;
    },
    i18n: { language: 'de', changeLanguage: vi.fn().mockResolvedValue(undefined) },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty' as const, init: () => {} },
}));

// ── Mocks: Tauri APIs ─────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(null) }));
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn().mockResolvedValue('/tmp/test') }));
vi.mock('@tauri-apps/api/webviewWindow', () => {
  const WebviewWindow = vi.fn().mockImplementation(() => ({ once: vi.fn(), listen: vi.fn() }));
  (WebviewWindow as unknown as Record<string, unknown>).getByLabel = vi.fn().mockResolvedValue(null);
  return { WebviewWindow };
});
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(false),
  readTextFile: vi.fn().mockResolvedValue('[]'),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockResolvedValue(null) }));

// ── Mocks: Services ───────────────────────────────────────────────────────────

vi.mock('../src/services/plugin-entity-service', () => ({
  listEntityTypes: vi.fn().mockReturnValue([]),
}));
vi.mock('../src/services/map-service', () => ({
  listMaps: vi.fn().mockResolvedValue([]),
  importMapImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/saved-views-service', () => ({
  listViews: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/services/rule-import-service', () => ({
  importRules: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/rule-evaluations', () => ({
  detectMysteryBreakers: vi.fn().mockResolvedValue([]),
  analyzeRoleCoverage: vi.fn().mockResolvedValue({ missing: [] }),
  detectQuestBlockers: vi.fn().mockResolvedValue([]),
}));
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn().mockResolvedValue([]),
  setActiveCalendar: vi.fn().mockResolvedValue(undefined),
  deleteCalendar: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/event-entity-service', () => ({
  createEventEntity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../src/services/map-layer-service', () => ({
  importImageLayer: vi.fn().mockResolvedValue(undefined),
  createFogLayer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../core_data/calendar-schema', () => ({
  formatCalendarDate: vi.fn().mockReturnValue(''),
}));

// ── Mocks: Heavy UI components ────────────────────────────────────────────────
// PlayModeView renders data-testid="dm-cockpit" so toggle tests can detect it.

vi.mock('../src/ui/PlayModeView', () => ({
  PlayModeView: ({ role }: { role?: string }) => (
    <div data-testid="dm-cockpit" data-role={role}>PlayModeView-Stub</div>
  ),
}));

vi.mock('../src/ui/EntityMasterDetail', () => ({
  EntityMasterDetail: () => <div data-testid="entity-master-detail">EntityMasterDetail-Stub</div>,
}));
vi.mock('../src/ui/EntityDetailView', () => ({
  EntityDetailView: () => <div>EntityDetailView-Stub</div>,
}));
vi.mock('../src/ui/GlobalSearch', () => ({
  GlobalSearch: () => <div>GlobalSearch-Stub</div>,
}));
vi.mock('../src/ui/ChronicleView', () => ({
  ChronicleView: () => <div>ChronicleView-Stub</div>,
}));
vi.mock('../src/ui/CalendarWizard', () => ({
  CalendarWizard: () => <div>CalendarWizard-Stub</div>,
}));
vi.mock('../src/ui/CalendarMonthView', () => ({
  CalendarMonthView: () => <div>CalendarMonthView-Stub</div>,
}));
vi.mock('../src/ui/CalendarLinkPanel', () => ({
  CalendarLinkPanel: () => <div>CalendarLinkPanel-Stub</div>,
}));
vi.mock('../src/ui/CardList', () => ({
  CardList: () => <div>CardList-Stub</div>,
}));
vi.mock('../src/ui/CardCreationFlow', () => ({
  CardCreationFlow: () => <div>CardCreationFlow-Stub</div>,
}));
vi.mock('../src/ui/PrintSheetComposer', () => ({
  PrintSheetComposer: () => <div>PrintSheetComposer-Stub</div>,
}));
vi.mock('../src/ui/PluginManager', () => ({
  PluginManager: () => <div>PluginManager-Stub</div>,
}));
vi.mock('../src/ui/DmScreen', () => ({
  DmScreen: () => <div>DmScreen-Stub</div>,
  DmScreenSelector: () => <div>DmScreenSelector-Stub</div>,
}));
vi.mock('../src/ui/SnapshotManager', () => ({
  SnapshotManager: () => <div>SnapshotManager-Stub</div>,
}));
vi.mock('../src/ui/UpdateNotification', () => ({
  UpdateNotification: () => <div>UpdateNotification-Stub</div>,
}));
vi.mock('../src/ui/MapViewer', () => ({
  MapViewer: () => <div>MapViewer-Stub</div>,
}));
vi.mock('../src/ui/GlobalGraphView', () => ({
  GlobalGraphView: () => <div>GlobalGraphView-Stub</div>,
}));
vi.mock('../src/ui/LayerPanel', () => ({
  LayerPanel: () => <div>LayerPanel-Stub</div>,
}));
vi.mock('../src/ui/MapsSidebarTabs', () => ({
  MapsSidebarTabs: () => <div>MapsSidebarTabs-Stub</div>,
}));
vi.mock('../src/ui/MapFolderTree', () => ({
  MapFolderTree: () => <div>MapFolderTree-Stub</div>,
}));
vi.mock('../src/ui/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div>LanguageSwitcher-Stub</div>,
}));
vi.mock('../src/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div>ThemeToggle-Stub</div>,
}));

// ── DB helpers ────────────────────────────────────────────────────────────────

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  raw.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s1','Test Session',datetime('now'))`).run();
  return makeAsyncDb(raw);
}

async function renderShell() {
  const db = createDb();
  const { DatabaseProvider } = await import('../src/services/DatabaseContext');
  const { WorkspaceShell } = await import('../src/ui/WorkspaceShell');
  render(
    <DatabaseProvider value={db}>
      <WorkspaceShell />
    </DatabaseProvider>,
  );
  return { db };
}

// ── Source-Guards ─────────────────────────────────────────────────────────────

describe('#342 S22 Source-Guard: mode-toggle in WorkspaceShell', () => {
  it('WorkspaceShell.tsx contains a data-testid="mode-toggle" element', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(src).toMatch(/data-testid\s*=\s*["']mode-toggle['"]/);
  });

  it('WorkspaceShell.tsx declares a mode state with edit and play values', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(src).toMatch(/['"]edit['"]/);
    expect(src).toMatch(/['"]play['"]/);
    // Must have useState usage for mode
    expect(src).toMatch(/useState\s*[<(].*['"]edit['"]/);
  });

  it('PlayModeView is imported and rendered by WorkspaceShell', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayModeView.*from/);
    expect(src).toMatch(/<PlayModeView/);
  });
});

// ── Integration-Tests ─────────────────────────────────────────────────────────
// Pflicht per AC/AGENTS.md:80 — muss WorkspaceShell (nicht PlayModeView) rendern.
// RED: mode-toggle existiert nicht → Tests schlagen fehl.

describe('#342 S22 Integration: mode-toggle Klick schaltet Hauptbereich', () => {
  it('WorkspaceShell renders data-testid="mode-toggle" in the top-bar', async () => {
    await renderShell();
    await waitFor(() =>
      expect(screen.getByTestId('mode-toggle')).toBeInTheDocument(),
    );
  });

  it('default mode is Bearbeiten (edit button aria-pressed=true)', async () => {
    await renderShell();
    await waitFor(() => screen.getByTestId('mode-toggle'));
    const editBtn = screen.getByRole('button', { name: /bearbeiten/i });
    expect(editBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking Spielen button renders PlayModeView content (dm-cockpit)', async () => {
    await renderShell();
    await waitFor(() => screen.getByTestId('mode-toggle'));

    fireEvent.click(screen.getByRole('button', { name: /spielen/i }));

    await waitFor(() =>
      expect(screen.getByTestId('dm-cockpit')).toBeInTheDocument(),
    );
  });

  it('clicking Spielen then Bearbeiten hides PlayModeView', async () => {
    await renderShell();
    await waitFor(() => screen.getByTestId('mode-toggle'));

    fireEvent.click(screen.getByRole('button', { name: /spielen/i }));
    await waitFor(() => screen.getByTestId('dm-cockpit'));

    fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('dm-cockpit')).toBeNull(),
    );
  });

  it('active mode has aria-pressed=true, inactive aria-pressed=false', async () => {
    await renderShell();
    await waitFor(() => screen.getByTestId('mode-toggle'));

    expect(screen.getByRole('button', { name: /bearbeiten/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /spielen/i })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: /spielen/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /spielen/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /bearbeiten/i })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('mode-toggle remains visible in play mode (always in top-bar)', async () => {
    await renderShell();
    await waitFor(() => screen.getByTestId('mode-toggle'));

    fireEvent.click(screen.getByRole('button', { name: /spielen/i }));
    await waitFor(() => screen.getByTestId('dm-cockpit'));

    expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
  });
});
