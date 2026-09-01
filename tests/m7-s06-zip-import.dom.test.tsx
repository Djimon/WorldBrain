// M7-S06: ZIP Import
// See: https://github.com/Djimon/WorldBrain/issues/139

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Services sind auf async migriert — validateProjectZip/importProjectZip liefern Promises (#400 Cluster B).
vi.mock('../src/services/zip-import-service', () => ({
  validateProjectZip: vi.fn().mockResolvedValue({ valid: true, projectJson: { id: 'proj-imported', title: 'Imported World' } }),
  importProjectZip: vi.fn().mockResolvedValue({ id: 'proj-imported', path: '/projects/imported-world' }),
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
    it('shows error when ZIP does not contain project.json', async () => {
      mockValidate.mockResolvedValue({ valid: false, error: 'No project.json found' });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/bad.zip" />);
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });

  describe('conflict resolution', () => {
    // Labels via t('zipImport.overwrite') / t('zipImport.keepBoth'); ohne i18n rendert der Key.
    it('shows conflict dialog when project id already exists', async () => {
      mockValidate.mockResolvedValue({ valid: true, projectJson: { id: 'proj-existing', title: 'Existing World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-existing']} />);
      expect(await screen.findByText(/überschreiben|overwrite/i)).toBeInTheDocument();
      expect(screen.getByText(/beide behalten|keep both|keepBoth/i)).toBeInTheDocument();
    });

    it('"Beide behalten" option is present in conflict dialog', async () => {
      mockValidate.mockResolvedValue({ valid: true, projectJson: { id: 'proj-conflict', title: 'My World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-conflict']} />);
      expect(await screen.findByRole('button', { name: /beide behalten|keep both|keepBoth/i })).toBeInTheDocument();
    });

    it('"Überschreiben" option is present in conflict dialog', async () => {
      mockValidate.mockResolvedValue({ valid: true, projectJson: { id: 'proj-conflict', title: 'My World' } });
      render(<ZipImportDialog onImported={vi.fn()} onCancel={vi.fn()} zipPath="/fake/project.zip" existingProjectIds={['proj-conflict']} />);
      expect(await screen.findByRole('button', { name: /überschreiben|overwrite/i })).toBeInTheDocument();
    });
  });

  describe('successful import', () => {
    it('calls onImported with imported project id on success', async () => {
      mockValidate.mockResolvedValue({ valid: true, projectJson: { id: 'proj-new', title: 'New World' } });
      mockImport.mockResolvedValue({ id: 'proj-new', path: '/projects/new-world' });
      const onImported = vi.fn();
      render(<ZipImportDialog onImported={onImported} onCancel={vi.fn()} zipPath="/fake/new.zip" existingProjectIds={[]} />);
      // Target the confirm-import button (t('zipImport.import')), not the file picker (t('importZip')).
      fireEvent.click(await screen.findByRole('button', { name: /importieren|zipImport\.import/i }));
      await waitFor(() => expect(onImported).toHaveBeenCalledWith('proj-new'));
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
