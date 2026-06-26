// M7-S06: ZIP Import
// See: https://github.com/Djimon/WorldBrain/issues/139

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/zip-import-service', () => ({
  validateProjectZip: vi.fn(() => ({ valid: true, projectJson: { id: 'proj-imported', title: 'Imported World' } })),
  importProjectZip: vi.fn(() => ({ id: 'proj-imported', path: '/projects/imported-world' })),
}));

vi.mock('../src/services/app-config-service', () => ({
  registerProject: vi.fn(),
  readAppConfig: vi.fn(() => ({ last_opened_project_id: null, projects: [] })),
}));

import { ZipImportDialog } from '../src/ui/ZipImportDialog';
import { validateProjectZip, importProjectZip } from '../src/services/zip-import-service';

const mockValidate = validateProjectZip as ReturnType<typeof vi.fn>;
const mockImport = importProjectZip as ReturnType<typeof vi.fn>;

describe('M7-S06 ZIP import', () => {
  describe('UI elements', () => {
    it('renders file picker / import button', () => {
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} />);
      expect(
        screen.getByRole('button', { name: /zip.*wählen|datei.*wählen|choose.*zip|select.*file|importieren|import/i })
      ).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when ZIP does not contain project.json', () => {
      mockValidate.mockReturnValue({ valid: false, error: 'No project.json found' });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/bad.zip" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('conflict resolution', () => {
    it('shows conflict dialog when project id already exists', () => {
      mockValidate.mockReturnValue({ valid: true, projectJson: { id: 'proj-existing', title: 'Existing World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-existing']} />);
      expect(screen.getByText(/überschreiben|overwrite/i)).toBeInTheDocument();
      expect(screen.getByText(/beide behalten|keep both/i)).toBeInTheDocument();
    });

    it('"Beide behalten" option is present in conflict dialog', () => {
      mockValidate.mockReturnValue({ valid: true, projectJson: { id: 'proj-conflict', title: 'My World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-conflict']} />);
      expect(screen.getByRole('button', { name: /beide behalten|keep both/i })).toBeInTheDocument();
    });

    it('"Überschreiben" option is present in conflict dialog', () => {
      mockValidate.mockReturnValue({ valid: true, projectJson: { id: 'proj-conflict', title: 'My World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-conflict']} />);
      expect(screen.getByRole('button', { name: /überschreiben|overwrite/i })).toBeInTheDocument();
    });
  });

  describe('successful import', () => {
    it('calls onImported with imported project id on success', () => {
      mockValidate.mockReturnValue({ valid: true, projectJson: { id: 'proj-new', title: 'New World' } });
      mockImport.mockReturnValue({ id: 'proj-new', path: '/projects/new-world' });
      const onImported = vi.fn();
      render(<ZipImportDialog onImported={onImported} onCancel={vi.fn()} zipPath="/fake/new.zip" existingProjectIds={[]} />);
      fireEvent.click(screen.getByRole('button', { name: /importieren|import/i }));
      expect(onImported).toHaveBeenCalledWith('proj-new');
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('does not use window.prompt, window.alert or window.confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/ZipImportDialog.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
