import { useState, useEffect } from 'react';
import { listScreens, getScreen, saveScreen } from '../services/dm-screen-service';
import type { DmScreenRecord, DmPanel } from '../services/dm-screen-service';
import { listRuleEntities } from '../services/rule-import-service';
import { listEntitiesByType } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';

interface EntityListItem {
  id: string;
  type: string;
  title: string;
  summary: string;
}

interface DmScreenSelectorProps {
  database: DatabaseLike;
  onSelectScreen: (screenId: string) => void;
}

export function DmScreenSelector({ database, onSelectScreen }: DmScreenSelectorProps) {
  const [screens, setScreens] = useState<DmScreenRecord[]>([]);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    listScreens(database).then(setScreens).catch(console.error);
  }, [database]);

  async function handleCreate() {
    if (newTitle.trim()) {
      const result = await saveScreen(database, { title: newTitle.trim(), layout: { columns: 2 }, panels: [] });
      setShowNewInput(false);
      setNewTitle('');
      onSelectScreen(result.id);
    }
  }

  return (
    <div>
      <h2>DM Screens</h2>
      <ul>
        {screens.map((s) => (
          <li key={s.id}>
            <button onClick={() => onSelectScreen(s.id)}>{s.title}</button>
          </li>
        ))}
      </ul>
      {showNewInput ? (
        <div>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Screen name"
            aria-label="New screen name"
          />
          <button onClick={() => void handleCreate()}>Create</button>
          <button onClick={() => setShowNewInput(false)}>Cancel</button>
        </div>
      ) : (
        <button aria-label="New Screen" onClick={() => setShowNewInput(true)}>New Screen</button>
      )}
    </div>
  );
}

function PanelContent({ panel, database }: { panel: DmPanel; database: DatabaseLike }) {
  const [rules, setRules] = useState<Record<string, unknown>[]>([]);
  const [entities, setEntities] = useState<EntityListItem[]>([]);

  useEffect(() => {
    if (panel.source === 'rule_table') {
      listRuleEntities(database, { type: panel.config.tag as string }).then(setRules).catch(console.error);
    } else if (panel.source === 'entity_type') {
      listEntitiesByType({ database, type: panel.config.entity_type as string })
        .then(rows => setEntities(rows as EntityListItem[])).catch(console.error);
    }
  }, [panel, database]);

  if (panel.source === 'rule_table') {
    return (
      <ul>
        {rules.map((r) => <li key={String(r.id)}>{String(r.title)}: {String(r.reference_summary ?? '')}</li>)}
      </ul>
    );
  }
  if (panel.source === 'entity_type') {
    return (
      <ul>
        {entities.map((e) => <li key={e.id}>{e.title}</li>)}
      </ul>
    );
  }
  return <div>Panel content</div>;
}

interface DmScreenProps {
  screenId: string;
  database: DatabaseLike;
}

export function DmScreen({ screenId, database }: DmScreenProps) {
  const [screen, setScreen] = useState<DmScreenRecord | null>(null);
  const [panels, setPanels] = useState<DmPanel[]>([]);

  useEffect(() => {
    listScreens(database).then(async (screens) => {
      const found = screens.find((s) => s.id === screenId);
      if (found) {
        setScreen(found);
        setPanels(found.panels);
      } else {
        const s = await getScreen(database, screenId);
        setScreen(s);
        setPanels(s?.panels ?? []);
      }
    }).catch(console.error);
  }, [database, screenId]);

  function handleRemovePanel(id: string) {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }

  function handleAddPanel() {
    const id = `panel-${Date.now()}`;
    setPanels((prev) => [...prev, { id, title: 'New Panel', source: 'rule_table', config: {}, display: 'list' }]);
  }

  return (
    <div>
      <h2>{screen?.title ?? 'DM Screen'}</h2>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {panels.map((panel) => (
          <div key={panel.id} data-panel={panel.id}>
            <h3>{panel.title}</h3>
            <PanelContent panel={panel} database={database} />
            <button aria-label="Remove Panel" onClick={() => handleRemovePanel(panel.id)}>×</button>
          </div>
        ))}
      </div>
      <button aria-label="Add Panel" onClick={handleAddPanel}>Add Panel</button>
    </div>
  );
}
