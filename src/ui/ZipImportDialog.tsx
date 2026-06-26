import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { validateProjectZip, importProjectZip } from '../services/zip-import-service';
import type { ZipValidationResult } from '../services/zip-import-service';

interface ZipImportDialogProps {
  onImported: (projectId: string) => void;
  onCancel: () => void;
  zipPath?: string;
  existingProjectIds?: string[];
}

export function ZipImportDialog({ onImported, onCancel, zipPath: initialZipPath, existingProjectIds = [] }: ZipImportDialogProps) {
  const [zipPath, setZipPath] = useState<string | undefined>(initialZipPath);
  const [validation, setValidation] = useState<ZipValidationResult | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'keep-both' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zipPath) { setValidation(null); return; }
    validateProjectZip(zipPath).then(setValidation).catch(() => setValidation({ valid: false, error: 'Ungültige ZIP-Datei.' }));
  }, [zipPath]);

  async function handlePickFile() {
    const selected = await open({ filters: [{ name: 'ZIP', extensions: ['zip'] }], multiple: false });
    if (typeof selected === 'string') setZipPath(selected);
  }

  const importedId = validation?.projectJson?.id as string | undefined;
  const hasConflict = importedId != null && existingProjectIds.includes(importedId);

  function handleImport(strategy?: 'overwrite' | 'keep-both') {
    if (!zipPath || !validation?.valid) return;
    importProjectZip({ zipPath, conflictStrategy: strategy })
      .then((result) => onImported(result.id))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : typeof e === 'string' ? e : 'Import fehlgeschlagen.'));
  }

  return (
    <div>
      <h2>ZIP importieren</h2>

      {error && <div role="alert">{error}</div>}

      {!zipPath && (
        <button onClick={() => void handlePickFile()}>ZIP-Datei auswählen…</button>
      )}

      {zipPath && !validation && (
        <div>Prüfe ZIP…</div>
      )}

      {zipPath && validation && !validation.valid && (
        <div role="alert">{validation.error ?? 'Ungültige ZIP-Datei.'}</div>
      )}

      {zipPath && validation?.valid && !hasConflict && (
        <div>
          <p>Projekt: {String(validation.projectJson?.title ?? '')}</p>
          <button onClick={() => handleImport()}>Importieren</button>
        </div>
      )}

      {zipPath && validation?.valid && hasConflict && conflictStrategy === null && (
        <div>
          <p>Ein Projekt mit dieser ID existiert bereits.</p>
          <button onClick={() => { setConflictStrategy('overwrite'); handleImport('overwrite'); }}>Überschreiben</button>
          <button onClick={() => { setConflictStrategy('keep-both'); handleImport('keep-both'); }}>Beide behalten</button>
        </div>
      )}

      <button onClick={onCancel}>Abbrechen</button>
    </div>
  );
}
