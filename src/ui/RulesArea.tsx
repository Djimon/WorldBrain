// pre-release S2 (#404): the `rules` feature extracted into its own module so a release
// build with features.json "rules": false tree-shakes it — rule-import-service,
// rule-evaluations, ModuleLibrary and the DM-Screen — out of dist/. Reached only via
// WorkspaceShell's lazy, feature('rules')-gated 'rules' area (dynamic import()).
// Behavior is preserved verbatim from the previous inline rules case (#189, M13-S07 #242).
import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { importRules } from '../services/rule-import-service';
import { detectMysteryBreakers, analyzeRoleCoverage, detectQuestBlockers } from '../services/rule-evaluations';
import { ModuleLibrary } from './ModuleLibrary';
import { DmScreen, DmScreenSelector } from './DmScreen';
import type { DatabaseLike } from '../services/entity-service';

export interface RulesAreaProps {
  database: DatabaseLike;
}

export function RulesArea({ database }: RulesAreaProps) {
  const { t } = useTranslation('nav');
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);

  function runEvaluation(kind: 'mystery' | 'role' | 'quest') {
    try {
      if (kind === 'mystery') {
        const result = detectMysteryBreakers({ quest: { id: '' }, party: [] });
        setEvalResult(JSON.stringify(result, null, 2));
      } else if (kind === 'role') {
        const result = analyzeRoleCoverage({ party: [] });
        setEvalResult(JSON.stringify(result, null, 2));
      } else {
        const result = detectQuestBlockers({ questId: '', graph: { quest: { id: '' }, clues: [], npcs: [] } });
        setEvalResult(JSON.stringify(result, null, 2));
      }
    } catch (err) {
      setEvalResult(err instanceof Error ? err.message : 'Fehler');
    }
  }

  function handleRuleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const params = JSON.parse(ev.target?.result as string) as Parameters<typeof importRules>[1];
        void importRules(database, params);
      } catch { /* ignore parse errors */ }
    };
    reader.readAsText(file);
  }

  return (
    <>
      {/* #189: rule import */}
      <div className="workspace-area__toolbar">
        <label>
          {t('ruleImport')}
          <input type="file" accept=".json" onChange={handleRuleImport} />
        </label>
      </div>
      {/* #189: rule evaluations */}
      <div>
        <button onClick={() => runEvaluation('mystery')}>{t('ruleEvalMystery')}</button>
        <button onClick={() => runEvaluation('role')}>{t('ruleEvalRole')}</button>
        <button onClick={() => runEvaluation('quest')}>{t('ruleEvalQuest')}</button>
        {evalResult && <pre>{evalResult}</pre>}
      </div>
      <hr />
      {/* M13-S07 (#242): house-rule overlay library + per-session toggle. */}
      <ModuleLibrary database={database} />
      <hr />
      {selectedScreenId ? (
        <>
          <button onClick={() => setSelectedScreenId(null)}>{t('dmScreensBack')}</button>
          <DmScreen screenId={selectedScreenId} database={database} />
        </>
      ) : (
        <DmScreenSelector database={database} onSelectScreen={setSelectedScreenId} />
      )}
    </>
  );
}
