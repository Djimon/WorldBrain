import React, { useState } from 'react';
import { getRelations, addRelation, deactivateRelation, reactivateRelation, RelationRow } from '../services/relation-service';
import { getRelationTypeDefinition, getAllRelationTypes } from '../data/relation-type-registry';
import { getEffectiveEntity } from '../services/entity-service';
import { EntityPicker } from './EntityPicker';

interface Props {
  entityId: string;
  database?: unknown;
}

function getLabel(relation: RelationRow, entityId: string): string {
  const isSource = relation.source_id === entityId;
  const def = getRelationTypeDefinition(isSource ? relation.relation_type : relation.inverse_type);
  if (!def) return isSource ? relation.relation_type : relation.inverse_type;
  return isSource ? def.label : def.inverse_label;
}

function getOtherEntityId(relation: RelationRow, entityId: string): string {
  return relation.source_id === entityId ? relation.target_id : relation.source_id;
}

function EntityTitle({ entityId, database }: { entityId: string; database: unknown }) {
  const result = getEffectiveEntity({ database: database as never, entityId });
  return <span>{result.entity?.title ?? entityId}</span>;
}

export function RelationsTab({ entityId, database = null }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState('');
  const [, forceUpdate] = useState(0);

  const allRelations = getRelations(database as never, entityId, { includeInactive: true });
  const active = allRelations.filter((r) => r.active === 1);
  const inactive = allRelations.filter((r) => r.active === 0);
  const allTypes = getAllRelationTypes();

  function handleDeactivate(relationId: string) {
    deactivateRelation(database as never, relationId);
    forceUpdate((n) => n + 1);
  }

  function handleReactivate(relationId: string) {
    reactivateRelation(database as never, relationId);
    forceUpdate((n) => n + 1);
  }

  function handleAddSelect(targetId: string) {
    if (!newRelationType) return;
    addRelation(database as never, {
      source_id: entityId,
      target_id: targetId,
      relation_type: newRelationType,
      visibility: 'public',
    });
    setShowAddForm(false);
    setNewRelationType('');
    forceUpdate((n) => n + 1);
  }

  return (
    <div>
      <section>
        <h3>Active relations</h3>
        {active.map((rel) => {
          const label = getLabel(rel, entityId);
          const otherId = getOtherEntityId(rel, entityId);
          const visibility = JSON.parse(rel.visibility_json ?? '"public"');
          return (
            <div key={rel.id}>
              <span>{label}</span>
              {' → '}
              <EntityTitle entityId={otherId} database={database} />
              {visibility === 'gm_only' && <span> [GM only]</span>}
              {rel.notes && <span> ({rel.notes})</span>}
              <button onClick={() => handleDeactivate(rel.id)} aria-label="Deactivate">
                Deactivate
              </button>
            </div>
          );
        })}
      </section>

      {inactive.length > 0 && (
        <section>
          <h3>Inactive relations</h3>
          {inactive.map((rel) => {
            const label = getLabel(rel, entityId);
            const otherId = getOtherEntityId(rel, entityId);
            return (
              <div key={rel.id} style={{ opacity: 0.5 }}>
                <span>{label}</span>
                {' → '}
                <EntityTitle entityId={otherId} database={database} />
                {rel.notes && <span> ({rel.notes})</span>}
                <button onClick={() => handleReactivate(rel.id)} aria-label="Reactivate">
                  Reactivate
                </button>
              </div>
            );
          })}
        </section>
      )}

      <div>
        <button onClick={() => setShowAddForm((v) => !v)}>Add relation</button>
        {showAddForm && (
          <div>
            <select
              aria-label="Relation type"
              value={newRelationType}
              onChange={(e) => setNewRelationType(e.target.value)}
            >
              <option value="">Select type…</option>
              {allTypes.map((t) => (
                <option key={t.relation_type} value={t.relation_type}>
                  {t.label}
                </option>
              ))}
            </select>
            <EntityPicker onSelect={handleAddSelect} />
          </div>
        )}
      </div>
    </div>
  );
}
