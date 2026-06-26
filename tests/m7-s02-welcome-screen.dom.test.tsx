// M7-S02: Welcome Screen & Projekt-Launcher
// See: https://github.com/Djimon/WorldBrain/issues/135

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/app-config-service', () => ({
  readAppConfig: vi.fn(),
}));

import { WelcomeScreen } from '../src/ui/WelcomeScreen';
import { readAppConfig } from '../src/services/app-config-service';

const mockReadAppConfig = readAppConfig as ReturnType<typeof vi.fn>;

describe('M7-S02 welcome screen & project launcher', () => {
  describe('empty state (no projects)', () => {
    it('renders "Neues Projekt erstellen" button', () => {
      mockReadAppConfig.mockReturnValue({ last_opened_project_id: null, projects: [] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByRole('button', { name: /neues projekt erstellen/i })).toBeInTheDocument();
    });

    it('renders "Bestehendes ZIP importieren" button', () => {
      mockReadAppConfig.mockReturnValue({ last_opened_project_id: null, projects: [] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByRole('button', { name: /zip importieren/i })).toBeInTheDocument();
    });

    it('does not show project list when projects is empty', () => {
      mockReadAppConfig.mockReturnValue({ last_opened_project_id: null, projects: [] });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('existing projects', () => {
    it('shows list of recent projects when projects exist', () => {
      mockReadAppConfig.mockReturnValue({
        last_opened_project_id: null,
        projects: [
          { id: 'p1', title: 'Forgotten Realms', path: '/projects/fr' },
          { id: 'p2', title: 'Middle Earth', path: '/projects/me' },
        ],
      });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByText(/Forgotten Realms/i)).toBeInTheDocument();
      expect(screen.getByText(/Middle Earth/i)).toBeInTheDocument();
    });

    it('clicking a project calls onOpenProject with project id', () => {
      const onOpen = vi.fn();
      mockReadAppConfig.mockReturnValue({
        last_opened_project_id: null,
        projects: [{ id: 'p1', title: 'Forgotten Realms', path: '/projects/fr' }],
      });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={onOpen} />);
      fireEvent.click(screen.getByText(/Forgotten Realms/i));
      expect(onOpen).toHaveBeenCalledWith('p1');
    });
  });

  describe('stale last_opened_project_id', () => {
    it('shows hint when last_opened_project_id points to nonexistent project', () => {
      mockReadAppConfig.mockReturnValue({
        last_opened_project_id: 'ghost-project',
        projects: [],
      });
      render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(screen.getByText(/nicht mehr vorhanden|not found|missing/i)).toBeInTheDocument();
    });
  });

  describe('issue #150: readAppConfig called only once on mount (not on every re-render)', () => {
    it('readAppConfig is called at most once after initial render', () => {
      mockReadAppConfig.mockReturnValue({ last_opened_project_id: null, projects: [] });
      mockReadAppConfig.mockClear();
      const { rerender } = render(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      rerender(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      rerender(<WelcomeScreen onCreateProject={vi.fn()} onImportZip={vi.fn()} onOpenProject={vi.fn()} />);
      expect(mockReadAppConfig).toHaveBeenCalledTimes(1);
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
