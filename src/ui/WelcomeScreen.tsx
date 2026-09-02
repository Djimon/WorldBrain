import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readAppConfig } from '../services/app-config-service';
import type { ProjectEntry } from '../services/app-config-service';
import { scanProjects } from '../services/project-discovery';
import { Button } from './primitives';

interface WelcomeScreenProps {
  configPath?: string;
  onCreateProject: () => void;
  onImportZip: () => void;
  onOpenProject: (projectId: string) => void;
}

export function WelcomeScreen({ configPath = 'app-config.json', onCreateProject, onImportZip, onOpenProject }: WelcomeScreenProps) {
  const { t } = useTranslation('nav');
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  useEffect(() => {
    // Discovery is filesystem-driven: the list comes from scanning <data_dir>\projects
    // (drop a folder in → it shows up); only last_opened_project_id comes from the config.
    Promise.all([readAppConfig(configPath), scanProjects()])
      .then(([cfg, found]) => { setLastOpened(cfg.last_opened_project_id); setProjects(found); })
      .catch(() => { setLastOpened(null); setProjects([]); });
  }, [configPath]);

  const isStale = lastOpened != null && !projects.some((p) => p.id === lastOpened);

  return (
    <div className="welcome-screen">
      <h1>{t('brand.platform', { ns: 'common', defaultValue: 'Worlds and Beyond' })}</h1>

      {isStale && (
        <p role="status" className="welcome-screen__status">
          {t('staleProject')}
        </p>
      )}

      <div className="welcome-screen__actions">
        <Button tone="accent" onClick={onCreateProject}>{t('createNewProject')}</Button>
        <Button onClick={onImportZip}>{t('importZip')}</Button>
      </div>

      {projects.length > 0 && (
        <div className="welcome-screen__projects">
          <h2>{t('recentlyOpened')}</h2>
          {projects.map((p: ProjectEntry) => (
            <button
              key={p.id}
              className="welcome-screen__project-btn"
              onClick={() => onOpenProject(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
