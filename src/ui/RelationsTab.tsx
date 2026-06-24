import React, { useState } from 'react';
import { getRelations, addRelation, deactivateRelation, reactivateRelation, RelationRow } from '../services/relation-service';
import { getRelationTypeDefinition, getAllRelationTypes } from '../data/relation-type-registry';
import { getEffectiveEntity } from '../services/entity-service';
import { EntityPicker } from './EntityPicker';

interface Props {
  entityId: string;
  database?: unknown;
}

const DB_SENTINEL = {};

function getLabel(relation: RelationRow, entityId: string): string {
  const isSource = relation.source_id === entityId;
  const def = getRelationTypeDefinition(relation.relation_type);
  if (!def) return isSource ? relation.relation_type : relation.inverse_type;
  return isSource ? def.label : def.inverse_label;
}

function getOtherEntityId(relation: RelationRow, entityId: string): string {
  return relation.source_id === entityId ? relation.target_id : relation.source_id;
}

function getEntityTitle(entityId: string, database: unknown): string {
  const result = getEffectiveEntity({ database: database as never, entityId });
  return result.entity?.title ?? entityId;
}

export function RelationsTab({ entityId, database = DB_SENTINEL }: Props) {
  const db = database ?? DB_SENTINEL;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState('');
  const [, forceUpdate] = useState(0);

  const allRelations = getRelations(db as never, entityId, { includeInactive: true });
  const active = allRelations.filter((r) => r.active === 1);
  const inactive = allRelations.filter((r) => r.active === 0);
  const allTypes = getAllRelationTypes();

  function handleDeactivate(relationId: string) {
    deactivateRelation(db as never, relationId);
    forceUpdate((n) => n + 1);
  }

  function handleReactivate(relationId: string) {
    reactivateRelation(db as never, relationId);
    forceUpdate((n) => n + 1);
  }

  function handleAddSelect(targetId: string) {
    if (!newRelationType) return;
    addRelation(db as never, {
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
          const title = getEntityTitle(otherId, db);
          return (
            <div key={rel.id}>
              {label} → {title}
              {visibility === 'gm_only' && ' [GM only]'}
              {rel.notes && ` (${rel.notes})`}
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
            const title = getEntityTitle(otherId, db);
            return (
              <div key={rel.id} style={{ opacity: 0.5 }}>
                {label} → {title}
                {rel.notes && ` (${rel.notes})`}
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
