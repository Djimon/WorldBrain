import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readAppConfig } from '../services/app-config-service';
import type { AppConfig, ProjectEntry } from '../services/app-config-service';

interface WelcomeScreenProps {
  configPath?: string;
  onCreateProject: () => void;
  onImportZip: () => void;
  onOpenProject: (projectId: string) => void;
}

const EMPTY_CONFIG: AppConfig = { last_opened_project_id: null, projects: [] };

export function WelcomeScreen({ configPath = 'app-config.json', onCreateProject, onImportZip, onOpenProject }: WelcomeScreenProps) {
  const { t } = useTranslation('nav');
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);

  useEffect(() => {
    readAppConfig(configPath).then(setConfig).catch(() => setConfig(EMPTY_CONFIG));
  }, [configPath]);

  const { last_opened_project_id, projects } = config;
  const isStale = last_opened_project_id != null && !projects.some((p) => p.id === last_opened_project_id);

  return (
    <div className="welcome-screen">
      <h1>WorldBuilderX</h1>

      {isStale && (
        <p role="status" style={{ color: 'var(--color-status-warning)' }}>
          {t('staleProject')}
        </p>
      )}

      <div className="welcome-screen__actions">
        <button className="btn btn--primary" onClick={onCreateProject}>{t('createNewProject')}</button>
        <button className="btn" onClick={onImportZip}>{t('importZip')}</button>
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
