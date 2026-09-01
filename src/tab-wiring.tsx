import React, { Suspense, lazy } from 'react';
import { registerEntityTab } from './ui/EntityDetailView';
import { RelationsTab } from './ui/RelationsTab';
import { BacklinksTab } from './ui/BacklinksTab';
import type { DatabaseLike } from './services/entity-service';

// pre-release S2 (#404): the ego-graph tab is the SAME GlobalGraphView as the graph
// area — gated by the same 'graph' flag. Lazy + directly-inlined constant so a release
// build with "graph": false tree-shakes GlobalGraphView (sigma/pixi/graphology) out of
// dist/ AND drops this tab from the entity view. See src/config/features.ts.
const GlobalGraphView = import.meta.env.DEV || __FEATURE_GRAPH__
  ? lazy(() => import('./ui/GlobalGraphView').then((m) => ({ default: m.GlobalGraphView })))
  : null;

registerEntityTab({
  id: 'relations',
  label: 'Relations',
  render: ({ entityId, database }: { entityId: string; database?: DatabaseLike }) =>
    database ? <RelationsTab entityId={entityId} database={database} /> : null,
});

registerEntityTab({
  id: 'backlinks',
  label: 'Verlinkungen',
  render: ({ entityId, database, onNavigate }: { entityId: string; database?: DatabaseLike; onNavigate?: (id: string) => void }) =>
    database ? <BacklinksTab entityId={entityId} database={database} onNavigate={onNavigate} /> : null,
});

// Ego-Graph = the SAME GlobalGraphView + user settings, only filtered to the
// focus entity's neighborhood (egoFocusId). No ego-specific renderer code.
// Registered only when the 'graph' feature is on (GlobalGraphView is null otherwise).
if (GlobalGraphView) {
  registerEntityTab({
    id: 'graph',
    label: 'Graph',
    render: ({ entityId, database, onNavigate }: { entityId: string; database?: DatabaseLike; onNavigate?: (id: string) => void }) =>
      database ? (
        <Suspense fallback={null}>
          <GlobalGraphView database={database} onNavigate={onNavigate ?? (() => {})} egoFocusId={entityId} />
        </Suspense>
      ) : null,
  });
}
