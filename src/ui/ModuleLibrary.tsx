// M13-S07 (#242): Module library + per-session toggle UI.
// Shows all rule_modules, allows enabling/disabling + ordering
// per (in-place selected) session and renders conflict hints (S06),
// validation load errors (S06) and a diff preview per module.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  activateModule, deactivateModule, listActiveModules, reorderModules,
  type ActiveOverlay,
} from '../services/session-overlay-service';
import {
  detectConflicts, moduleDiff, validateModuleTargets,
  type Conflict, type ModuleSummary,
} from '../services/overlay-conflict-service';
import { Button, ListSurface, Panel, Segmented, StatusChip } from './primitives';

export interface ModuleLibraryProps {
  database: DatabaseLike;
  /** Optional: pins the session (e.g. play cockpit). Otherwise the UI shows
   *  its own session selector — ad-hoc toggle in edit mode. */
  sessionId?: string;
}

interface SessionRow { id: string; title: string }

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

export function ModuleLibrary({ database, sessionId: fixedSessionId }: ModuleLibraryProps) {
  const { t } = useTranslation('rules');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(fixedSessionId ?? '');
  const [modules, setModules] = useState<RuleModuleRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [active, setActive] = useState<ActiveOverlay[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load sessions once for the selector.
  useEffect(() => {
    if (fixedSessionId !== undefined) return;
    database.select<SessionRow>('SELECT id, title FROM sessions ORDER BY created_at').then((rows) => {
      setSessions(rows);
      if (selectedSessionId === '' && rows.length > 0) setSelectedSessionId(rows[0].id);
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [database, fixedSessionId]);

  async function reload() {
    try {
      const [mods, ents] = await Promise.all([
        database.select<RuleModuleRow>('SELECT id, name, base_system_id, description FROM rule_modules ORDER BY name'),
        database.select<EntryRow>('SELECT module_id, target, op FROM rule_module_entries'),
      ]);
      setModules(mods);
      setEntries(ents);
      if (selectedSessionId === '') { setActive([]); return; }
      const act = await listActiveModules(database, selectedSessionId);
      setActive(act);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { void reload(); }, [database, selectedSessionId]);

  async function toggle(moduleId: string) {
    if (selectedSessionId === '') return;
    setError(null);
    const isActive = active.some((a) => a.moduleId === moduleId);
    try {
      if (isActive) await deactivateModule(database, { sessionId: selectedSessionId, moduleId });
      else await activateModule(database, { sessionId: selectedSessionId, moduleId, order: active.length });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function moveActive(moduleId: string, delta: -1 | 1) {
    if (selectedSessionId === '') return;
    const ids = active.slice().sort((a, b) => a.order - b.order).map((a) => a.moduleId);
    const idx = ids.indexOf(moduleId);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= ids.length) return;
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    try {
      await reorderModules(database, { sessionId: selectedSessionId, moduleIds: ids });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Compute the conflict set from the active modules — moduleDiff per card, so
  // the library can show a diff preview.
  const activeSummaries: ModuleSummary[] = active.map((a) => ({
    id: a.moduleId,
    overrides: entries
      .filter((e) => e.module_id === a.moduleId)
      .map((e) => ({ target: e.target, op: e.op as 'patch' | 'replace' | 'remove', value: null })),
  }));
  const conflicts: Conflict[] = detectConflicts(activeSummaries);

  const activeIdsInOrder = active.slice().sort((a, b) => a.order - b.order).map((a) => a.moduleId);

  return (
    <Panel className="module-library u-stack u-gap-3" role="region"
      aria-label={t('modules.title', 'Regel-Module')}>
      <h2>{t('modules.title', 'Regel-Module')}</h2>

      {error !== null && <StatusChip tone="failure" role="alert">{error}</StatusChip>}

      {fixedSessionId === undefined && (
        sessions.length > 0 ? (
          <Segmented
            label={t('modules.selectSession', 'Session')}
            value={selectedSessionId}
            onChange={setSelectedSessionId}
            size="compact"
            options={sessions.map((s) => ({ id: s.id, label: s.title }))}
          />
        ) : (
          <StatusChip tone="warning">
            {t('modules.noSessions', 'Keine Sessions vorhanden — Module lassen sich erst aktivieren, sobald eine Session existiert.')}
          </StatusChip>
        )
      )}

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
          const overrides = modEntries.map((e) => ({
            target: e.target, op: e.op as 'patch' | 'replace' | 'remove', value: null,
          }));
          const diff = moduleDiff({ id: m.id, overrides });
          // Validation load errors (S06) — checked per module during render.
          const validationErrors = validateModuleTargets({
            id: m.id, overlays: m.base_system_id, overrides,
          });
          const activeIdx = activeIdsInOrder.indexOf(m.id);
          const canMoveUp = isActive && activeIdx > 0;
          const canMoveDown = isActive && activeIdx >= 0 && activeIdx < activeIdsInOrder.length - 1;
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
                  disabled={selectedSessionId === ''}
                >
                  {isActive
                    ? t('modules.deactivate', 'Deaktivieren')
                    : t('modules.activate', 'Aktivieren')}
                </Button>
                {isActive && (
                  <>
                    <Button size="compact" variant="outline" disabled={!canMoveUp}
                      title={t('modules.moveUp', 'Nach oben')}
                      onClick={() => void moveActive(m.id, -1)}>↑</Button>
                    <Button size="compact" variant="outline" disabled={!canMoveDown}
                      title={t('modules.moveDown', 'Nach unten')}
                      onClick={() => void moveActive(m.id, 1)}>↓</Button>
                  </>
                )}
              </div>
              {m.description !== null && m.description !== '' && (
                <p className="u-muted">{m.description}</p>
              )}
              {validationErrors.map((err, i) => (
                <StatusChip key={`err-${i}`} tone="failure" role="alert">{err}</StatusChip>
              ))}
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
