// M7-S03: Neues Projekt anlegen
// See: https://github.com/Djimon/WorldBrain/issues/136

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/project-service', () => ({
  createProject: vi.fn(() => ({ id: 'proj-new', path: '/projects/test-world' })),
}));

vi.mock('../src/services/app-config-service', () => ({
  registerProject: vi.fn(),
  readAppConfig: vi.fn(() => ({ last_opened_project_id: null, projects: [] })),
}));

import { NewProjectDialog } from '../src/ui/NewProjectDialog';
import { createProject } from '../src/services/project-service';

const mockCreateProject = createProject as ReturnType<typeof vi.fn>;

describe('M7-S03 new project dialog', () => {
  describe('form fields', () => {
    it('renders project name input (required)', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /projektname|project name/i })).toBeInTheDocument();
    });

    it('renders optional description field', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /beschreibung|description/i })).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole('button', { name: /erstellen|create/i })).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole('button', { name: /abbrechen|cancel/i })).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('submit with empty name does not call createProject', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /erstellen|create/i }));
      expect(mockCreateProject).not.toHaveBeenCalled();
    });

    it('shows error when name is empty and submit clicked', () => {
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /erstellen|create/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('successful creation', () => {
    it('calls createProject with project name', () => {
      mockCreateProject.mockReturnValue({ id: 'proj-new', path: '/projects/test-world' });
      const onCreated = vi.fn();
      render(<NewProjectDialog onCreated={onCreated} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByRole('textbox', { name: /projektname|project name/i }), {
        target: { value: 'Test World' },
      });
      fireEvent.click(screen.getByRole('button', { name: /erstellen|create/i }));
      expect(mockCreateProject).toHaveBeenCalledWith(expect.objectContaining({ title: 'Test World' }));
    });

    it('calls onCreated with new project id after creation', () => {
      mockCreateProject.mockReturnValue({ id: 'proj-new', path: '/projects/test-world' });
      const onCreated = vi.fn();
      render(<NewProjectDialog onCreated={onCreated} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByRole('textbox', { name: /projektname|project name/i }), {
        target: { value: 'Test World' },
      });
      fireEvent.click(screen.getByRole('button', { name: /erstellen|create/i }));
      expect(onCreated).toHaveBeenCalledWith('proj-new');
    });
  });

  describe('conflict handling', () => {
    it('shows error when createProject throws a conflict error', () => {
      mockCreateProject.mockImplementation(() => { throw new Error('Folder already exists'); });
      render(<NewProjectDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
      fireEvent.change(screen.getByRole('textbox', { name: /projektname|project name/i }), {
        target: { value: 'Existing World' },
      });
      fireEvent.click(screen.getByRole('button', { name: /erstellen|create/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('does not use window.prompt, window.alert or window.confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/NewProjectDialog.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
