import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProject } from '../services/project-service';

interface NewProjectDialogProps {
  onCreated: (projectId: string) => void;
  onCancel: () => void;
  baseDir?: string;
}

export function NewProjectDialog({ onCreated, onCancel, baseDir }: NewProjectDialogProps) {
  const { t } = useTranslation('nav');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!name.trim()) {
      setError(t('newProject'));
      return;
    }
    createProject({ title: name.trim(), description: description.trim() || undefined, baseDir })
      .then((result) => onCreated(result.id))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)));
  }

  return (
    <div className="new-project">
      <div className="new-project__card">
        <h2>{t('createNewProject')}</h2>

        {error && <div className="new-project__error" role="alert">{error}</div>}

        <label className="new-project__field">
          <span>{t('newProject')}</span>
          <input
            type="text"
            aria-label={t('newProject')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="new-project__field">
          <span>{tc('description')}</span>
          <input
            type="text"
            aria-label={tc('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="new-project__actions">
          <button className="btn" onClick={onCancel}>{tc('cancel')}</button>
          <button className="btn btn--primary" onClick={handleSubmit}>{tc('create')}</button>
        </div>
      </div>
    </div>
  );
}
