import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity } from '../services/entity-service';

type EffectiveResult = Awaited<ReturnType<typeof getEffectiveEntity>>;

type TabDefinition = {
  id: string;
  label: string;
  render: (props: { entityId: string; database?: DatabaseLike }) => React.ReactNode;
};

const registeredTabs: TabDefinition[] = [];

export function registerEntityTab(tab: TabDefinition) {
  registeredTabs.push(tab);
}

export function clearEntityTabs() {
  registeredTabs.splice(0);
}

type EntityDetailViewProps = {
  entityId: string;
  database?: DatabaseLike;
};

export function EntityDetailView({ entityId, database }: EntityDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  // Snapshot at mount time — each instance gets its own independent copy.
  // Post-mount calls to registerEntityTab/clearEntityTabs do not retroactively
  // affect already-mounted instances, satisfying the isolation contract.
  const [extraTabs] = useState<TabDefinition[]>(() => [...registeredTabs]);
  const [result, setResult] = useState<EffectiveResult | null>(null);

  useEffect(() => {
    getEffectiveEntity({ database: database as DatabaseLike, entityId }).then(setResult).catch(console.error);
  }, [database, entityId]);

  if (!result) {
    return null;
  }

  if (!result.found) {
    return <div role="alert">Entity not found: {entityId}</div>;
  }

  const { entity } = result;
  const tabs: TabDefinition[] = [
    {
      id: 'overview',
      label: 'Overview',
      render: () => (
        <div>
          <h2>{entity.title}</h2>
          <p>{entity.summary}</p>
        </div>
      ),
    },
    ...extraTabs,
  ];

  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div>
      <div role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{activeTabDef?.render({ entityId, database })}</div>
    </div>
  );
}
