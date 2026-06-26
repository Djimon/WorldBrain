import { useEffect, useState } from 'react';
import { validateProjectZip, importProjectZip } from '../services/zip-import-service';
import type { ZipValidationResult } from '../services/zip-import-service';

interface ZipImportDialogProps {
  onImported: (projectId: string) => void;
  onCancel: () => void;
  zipPath?: string;
  existingProjectIds?: string[];
}

export function ZipImportDialog({ onImported, onCancel, zipPath, existingProjectIds = [] }: ZipImportDialogProps) {
  const [validation, setValidation] = useState<ZipValidationResult | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'keep-both' | null>(null);

  useEffect(() => {
    if (!zipPath) { setValidation(null); return; }
    validateProjectZip(zipPath).then(setValidation).catch(() => setValidation({ valid: false, error: 'Ungültige ZIP-Datei.' }));
  }, [zipPath]);

  const importedId = validation?.projectJson?.id as string | undefined;
  const hasConflict = importedId != null && existingProjectIds.includes(importedId);

  function handleImport(strategy?: 'overwrite' | 'keep-both') {
    if (!zipPath || !validation?.valid) return;
    importProjectZip({ zipPath, conflictStrategy: strategy })
      .then((result) => onImported(result.id))
      .catch(() => { /* stay on dialog */ });
  }

  if (!zipPath) {
    return (
      <div>
        <button onClick={onCancel}>Importieren</button>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div>
        <div role="alert">{validation?.error ?? 'Ungültige ZIP-Datei.'}</div>
        <button onClick={onCancel}>Abbrechen</button>
      </div>
    );
  }

  if (hasConflict && conflictStrategy === null) {
    return (
      <div>
        <p>Ein Projekt mit dieser ID existiert bereits.</p>
        <button onClick={() => { setConflictStrategy('overwrite'); handleImport('overwrite'); }}>Überschreiben</button>
        <button onClick={() => { setConflictStrategy('keep-both'); handleImport('keep-both'); }}>Beide behalten</button>
        <button onClick={onCancel}>Abbrechen</button>
      </div>
    );
  }

  return (
    <div>
      <p>Projekt: {String(validation.projectJson?.title ?? '')}</p>
      <button onClick={() => handleImport()}>Importieren</button>
      <button onClick={onCancel}>Abbrechen</button>
    </div>
  );
}
