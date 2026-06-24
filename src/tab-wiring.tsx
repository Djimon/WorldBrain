import React from 'react';
import { registerEntityTab } from './ui/EntityDetailView';
import { RelationsTab } from './ui/RelationsTab';
import type { DatabaseLike } from './services/entity-service';

registerEntityTab({
  id: 'relations',
  label: 'Relations',
  render: ({ entityId, database }: { entityId: string; database: unknown }) =>
    <RelationsTab entityId={entityId} database={database as DatabaseLike} />,
});
