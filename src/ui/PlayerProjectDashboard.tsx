import { invoke } from '@tauri-apps/api/core';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PlayerProject {
  id: string;
  label: string;
  hostUrl: string;
  inviteCode: string;
  token: string;
  displayName: string;
  sessionName: string;
  lastSeenAt: string | null;
}

interface Props {
  onJoinNew?: () => void;
  onOpenProject?: (project: PlayerProject) => void;
}

const PROJECTS_FILE = 'player-projects.json';

export async function saveProjects(projects: PlayerProject[]): Promise<void> {
  await writeTextFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

export function PlayerProjectDashboard({ onJoinNew, onOpenProject }: Props) {
  const { t } = useTranslation('nav');
  const [projects, setProjects] = useState<PlayerProject[]>([]);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      const fileExists = await exists(PROJECTS_FILE);
      if (!fileExists) return;
      const raw = await readTextFile(PROJECTS_FILE);
      const loaded = JSON.parse(raw) as PlayerProject[];
      if (!active) return;
      setProjects(loaded);
      for (const p of loaded) {
        invoke<{ online: boolean }>('host_online_check', { url: p.hostUrl })
          .then((r) => { if (active) setOnlineMap((prev) => ({ ...prev, [p.id]: r.online })); })
          .catch(() => { if (active) setOnlineMap((prev) => ({ ...prev, [p.id]: false })); });
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <button onClick={onJoinNew}>{t('playerJoinNew', 'Neu beitreten')}</button>
      <ul>
        {projects.length === 0 && (
          <li>{t('playerNoProjects', 'Noch keine gespeicherten Hosts.')}</li>
        )}
        {projects.map((p) => (
          <li key={p.id} onClick={() => onOpenProject?.(p)} style={{ cursor: 'pointer' }}>
            <span>{p.label}</span>
            <span> — {p.hostUrl}</span>
            <span data-testid="connection-status">
              {p.id in onlineMap
                ? (onlineMap[p.id] ? t('playerOnline', '●') : t('playerOffline', '○'))
                : '…'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
