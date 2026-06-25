import { useState } from 'react';
import { createProject } from '../services/project-service';

interface NewProjectDialogProps {
  onCreated: (projectId: string) => void;
  onCancel: () => void;
  baseDir?: string;
}

export function NewProjectDialog({ onCreated, onCancel, baseDir }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name.trim()) {
      setError('Projektname ist erforderlich.');
      return;
    }
    try {
      const result = createProject({ title: name.trim(), description: description.trim() || undefined, baseDir });
      onCreated(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Anlegen des Projekts.');
    }
  }

  return (
    <div>
      <h2>Neues Projekt erstellen</h2>

      {error && <div role="alert">{error}</div>}

      <label>
        Projektname
        <input
          type="text"
          aria-label="Projektname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label>
        Beschreibung
        <input
          type="text"
          aria-label="Beschreibung"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <button onClick={handleSubmit}>Erstellen</button>
      <button onClick={onCancel}>Abbrechen</button>
    </div>
  );
}
