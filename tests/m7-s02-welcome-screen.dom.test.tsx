// M7-S02: Welcome Screen & Projekt-Launcher
// See: https://github.com/Djimon/WorldBrain/issues/135
// Discovery ist Ordner-basiert: die Liste kommt aus scanProjects() (Scan von
// <data_dir>\projects), nur last_opened_project_id kommt aus readAppConfig().

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/app-config-service', () => ({
  readAppConfig: vi.fn(),
}));
vi.mock('../src/services/project-discovery', () => ({
  scanProjects: vi.fn(),
}));

import { WelcomeScreen } from '../src/ui/WelcomeScreen';
import { readAppConfig } from '../src/services/app-config-service';
import { scanProjects } from '../src/services/project-discovery';

const mockReadAppConfig = readAppConfig as ReturnType<typeof vi.fn>;
const mockScanProjects = scanProjects as ReturnType<typeof vi.fn>;

function setup(opts: { lastOpened?: string | null; projects?: { id: string; title: string; path: string }[] } = {}) {
  mockReadAppConfig.mockResolvedValue({ last_opened_project_id: opts.lastOpened ?? null, data_dir: null });
  mockScanProjects.mockResolvedValue(opts.projects ?? []);
}

describe('M7-S02 welcome screen & project launcher', () => {
  describe('empty state (no projects)', () => {
    it('renders "Neues Projekt erstellen" button', () => {
      setup();
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByRole('button', { name: /neues projekt erstellen|createNewProject/i })).toBeInTheDocument();
    });

    it('renders "Bestehendes ZIP importieren" button', () => {
      setup();
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByRole('button', { name: /zip importieren|importZip/i })).toBeInTheDocument();
    });

    it('does not show project list when no projects on disk', () => {
      setup();
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('existing projects (from folder scan)', () => {
    it('shows the scanned projects', async () => {
      setup({ projects: [
        { id: 'p1', title: 'Forgotten Realms', path: '/projects/fr' },
        { id: 'p2', title: 'Middle Earth', path: '/projects/me' },
      ] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(await screen.findByText(/Forgotten Realms/i)).toBeInTheDocument();
      expect(screen.getByText(/Middle Earth/i)).toBeInTheDocument();
    });

    it('clicking a project calls onOpenProject with project id', async () => {
      const onOpen = vi.fn();
      setup({ projects: [{ id: 'p1', title: 'Forgotten Realms', path: '/projects/fr' }] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={onOpen} />);
      fireEvent.click(await screen.findByText(/Forgotten Realms/i));
      expect(onOpen).toHaveBeenCalledWith('p1');
    });
  });

  describe('stale last_opened_project_id', () => {
    it('shows hint when last_opened points to a project no longer on disk', async () => {
      setup({ lastOpened: 'ghost-project', projects: [] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(await screen.findByText(/nicht mehr vorhanden|not found|missing|staleProject/i)).toBeInTheDocument();
    });

    it('does NOT show the hint when last_opened is still present in the scan', async () => {
      setup({ lastOpened: 'p1', projects: [{ id: 'p1', title: 'Forgotten Realms', path: '/projects/fr' }] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      await screen.findByText(/Forgotten Realms/i);
      expect(screen.queryByText(/nicht mehr vorhanden|not found|missing|staleProject/i)).not.toBeInTheDocument();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('does not use window.prompt, window.alert or window.confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/WelcomeScreen.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
