import { useState } from 'react';
import { getEffectiveEntity } from '../services/entity-service';

type TabDefinition = {
  id: string;
  label: string;
  render: () => React.ReactNode;
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
  database?: unknown;
};

export function EntityDetailView({ entityId, database }: EntityDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const result = getEffectiveEntity({ database: database as never, entityId });

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
    ...registeredTabs,
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
      <div role="tabpanel">{activeTabDef?.render()}</div>
    </div>
  );
}
