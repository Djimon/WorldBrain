import { useState } from 'react';
import { Button, Panel, StatusChip, Tabs } from './ui/primitives';
import './style.css';

const shellViews = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Workspace overview',
    description: 'Placeholder view for the first operational surface.',
    detail: 'Reserved for dense project workbench controls.',
  },
  {
    id: 'library',
    label: 'Library',
    title: 'Library surface',
    description: 'Placeholder view for structured reference work.',
    detail: 'Reserved for list, table, and inspector surfaces.',
  },
  {
    id: 'review',
    label: 'Review',
    title: 'Review surface',
    description: 'Placeholder view for validation and export checks.',
    detail: 'Reserved for compact status panels.',
  },
] as const;

export function App() {
  const [activeView, setActiveView] = useState<(typeof shellViews)[number]['id']>('overview');
  const selectedView = shellViews.find((view) => view.id === activeView) ?? shellViews[0];

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <p className="app-shell__eyebrow">WorldBuilderX</p>
          <h1>Project workspace</h1>
        </div>
        <div aria-label="global controls" className="app-shell__controls">
          <StatusChip tone="success">M0 ready</StatusChip>
          <Button tone="accent">New project</Button>
        </div>
      </header>

      <aside aria-label="primary navigation" className="app-shell__nav">
        <Tabs
          activeId={activeView}
          label="primary workspace navigation"
          onSelect={(id) => setActiveView((shellViews.find((view) => view.id === id) ?? shellViews[0]).id)}
          options={shellViews}
        />
      </aside>

      <main className="app-shell__workspace">
        <div className="app-shell__content">
          <Panel>
            <article className="app-shell__view" aria-labelledby="active-view-title">
              <p className="app-shell__label">Placeholder</p>
              <h2 id="active-view-title">{selectedView.title}</h2>
              <p>{selectedView.description}</p>
              <p className="app-shell__note">{selectedView.detail}</p>
            </article>
          </Panel>
        </div>
      </main>

      <footer className="app-shell__status" role="status">
        <StatusChip>renderer</StatusChip>
        <span>React, Tauri, and M0 build surfaces are wired.</span>
      </footer>
    </div>
  );
}
