// M13-S07 (#242): Modul-Bibliothek + Per-Session-Toggle UI.
// Zeigt alle rule_modules, erlaubt Aktivieren/Deaktivieren pro aktiver
// Session und rendert Konflikt-Hinweise (S06) + Diff-Vorschau pro Modul.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  activateModule, deactivateModule, listActiveModules,
  type ActiveOverlay,
} from '../services/session-overlay-service';
import {
  detectConflicts, moduleDiff,
  type Conflict, type ModuleSummary,
} from '../services/overlay-conflict-service';
import { Button, ListSurface, Panel, StatusChip } from './primitives';

export interface ModuleLibraryProps {
  database: DatabaseLike;
  sessionId: string;
}

interface RuleModuleRow {
  id: string;
  name: string;
  base_system_id: string;
  description: string | null;
}
interface EntryRow {
  module_id: string;
  target: string;
  op: string;
}

export function ModuleLibrary({ database, sessionId }: ModuleLibraryProps) {
  const { t } = useTranslation('rules');
  const [modules, setModules] = useState<RuleModuleRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [active, setActive] = useState<ActiveOverlay[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [mods, ents, act] = await Promise.all([
        database.select<RuleModuleRow>('SELECT id, name, base_system_id, description FROM rule_modules ORDER BY name'),
        database.select<EntryRow>('SELECT module_id, target, op FROM rule_module_entries'),
        listActiveModules(database, sessionId),
      ]);
      setModules(mods);
      setEntries(ents);
      setActive(act);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { void reload(); }, [database, sessionId]);

  async function toggle(moduleId: string) {
    setError(null);
    const isActive = active.some((a) => a.moduleId === moduleId);
    try {
      if (isActive) await deactivateModule(database, { sessionId, moduleId });
      else await activateModule(database, { sessionId, moduleId, order: active.length });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Konflikt-Set aus aktivierten Modulen berechnen — moduleDiff pro Karte, damit
  // die Bibliothek eine Diff-Vorschau anzeigen kann.
  const activeSummaries: ModuleSummary[] = active.map((a) => ({
    id: a.moduleId,
    overrides: entries
      .filter((e) => e.module_id === a.moduleId)
      .map((e) => ({ target: e.target, op: e.op as 'patch' | 'replace' | 'remove', value: null })),
  }));
  const conflicts: Conflict[] = detectConflicts(activeSummaries);

  return (
    <Panel className="module-library u-stack u-gap-3" role="region"
      aria-label={t('modules.title', 'Regel-Module')}>
      <h2>{t('modules.title', 'Regel-Module')}</h2>

      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}

      {conflicts.length > 0 && (
        <div className="module-library__conflicts u-stack u-gap-1">
          <h3>{t('modules.conflictsTitle', 'Konflikte')}</h3>
          {conflicts.map((c, i) => (
            <StatusChip key={`${c.target}-${i}`} tone="failure">
              {t('modules.conflict',
                '{{target}}: {{winner}} überschreibt {{loser}}',
                { target: c.target, winner: c.winner, loser: c.loser })}
            </StatusChip>
          ))}
        </div>
      )}

      <ListSurface className="module-library__list">
        {modules.length === 0 && (
          <li className="module-library__empty">{t('modules.empty', 'Noch keine Module in der Bibliothek.')}</li>
        )}
        {modules.map((m) => {
          const isActive = active.some((a) => a.moduleId === m.id);
          const modEntries = entries.filter((e) => e.module_id === m.id);
          const diff = moduleDiff({
            id: m.id,
            overrides: modEntries.map((e) => ({
              target: e.target, op: e.op as 'patch' | 'replace' | 'remove', value: null,
            })),
          });
          return (
            <li key={m.id} className="module-library__row u-stack u-gap-1">
              <div className="u-row u-gap-2">
                <strong>{m.name}</strong>
                <span className="u-muted">— {m.base_system_id}</span>
                <StatusChip tone={isActive ? 'success' : 'muted'}>
                  {isActive
                    ? t('modules.enabled', 'aktiv')
                    : t('modules.disabled', 'inaktiv')}
                </StatusChip>
                <Button
                  size="compact"
                  tone={isActive ? 'danger' : 'accent'}
                  variant={isActive ? 'outline' : undefined}
                  onClick={() => void toggle(m.id)}
                >
                  {isActive
                    ? t('modules.deactivate', 'Deaktivieren')
                    : t('modules.activate', 'Aktivieren')}
                </Button>
              </div>
              {m.description !== null && m.description !== '' && (
                <p className="u-muted">{m.description}</p>
              )}
              {diff.length > 0 && (
                <div className="module-library__diff u-row u-gap-1">
                  {diff.map((d, i) => (
                    <StatusChip key={`${d.target}-${i}`} tone="muted">
                      {d.op} · {d.target}
                    </StatusChip>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ListSurface>
    </Panel>
  );
}

export default ModuleLibrary;
