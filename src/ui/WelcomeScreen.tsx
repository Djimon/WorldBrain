import { useState } from 'react';
import { readAppConfig } from '../services/app-config-service';
import type { ProjectEntry } from '../services/app-config-service';

interface WelcomeScreenProps {
  configPath?: string;
  onCreateProject: () => void;
  onImportZip: () => void;
  onOpenProject: (projectId: string) => void;
}

export function WelcomeScreen({ configPath = 'app-config.json', onCreateProject, onImportZip, onOpenProject }: WelcomeScreenProps) {
  const [config] = useState(() => readAppConfig(configPath));
  const { last_opened_project_id, projects } = config;

  const isStale = last_opened_project_id != null && !projects.some((p) => p.id === last_opened_project_id);

  return (
    <div>
      <h1>WorldBuilderX</h1>

      {isStale && (
        <p role="status">Das zuletzt geöffnete Projekt ist nicht mehr vorhanden.</p>
      )}

      <button onClick={onCreateProject}>Neues Projekt erstellen</button>
      <button onClick={onImportZip}>Bestehendes ZIP importieren</button>

      {projects.length > 0 && (
        <ul>
          {projects.map((p: ProjectEntry) => (
            <li key={p.id}>
              <button onClick={() => onOpenProject(p.id)}>{p.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
