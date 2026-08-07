import React from 'react';
import { registerEntityTab } from './ui/EntityDetailView';
import { RelationsTab } from './ui/RelationsTab';
import { BacklinksTab } from './ui/BacklinksTab';
import { GlobalGraphView } from './ui/GlobalGraphView';
import type { DatabaseLike } from './services/entity-service';

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
registerEntityTab({
  id: 'graph',
  label: 'Graph',
  render: ({ entityId, database, onNavigate }: { entityId: string; database?: DatabaseLike; onNavigate?: (id: string) => void }) =>
    database ? <GlobalGraphView database={database} onNavigate={onNavigate ?? (() => {})} egoFocusId={entityId} /> : null,
});
