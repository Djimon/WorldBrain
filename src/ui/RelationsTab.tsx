import React, { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity } from '../services/entity-service';
import { getRelations, addRelation, deactivateRelation, reactivateRelation, RelationRow } from '../services/relation-service';
import { getRelationTypeDefinition, getAllRelationTypes } from '../data/relation-type-registry';
import { EntityPicker } from './EntityPicker';

interface Props {
  entityId: string;
  database: DatabaseLike;
}

const EMPTY_DB = {} as DatabaseLike;

function getLabel(relation: RelationRow, entityId: string): string {
  const isSource = relation.source_id === entityId;
  const def = getRelationTypeDefinition(relation.relation_type);
  if (!def) return isSource ? relation.relation_type : relation.inverse_type;
  return isSource ? def.label : def.inverse_label;
}

function getOtherEntityId(relation: RelationRow, entityId: string): string {
  return relation.source_id === entityId ? relation.target_id : relation.source_id;
}

function EntityTitle({ entityId, database }: { entityId: string; database: DatabaseLike }) {
  const [title, setTitle] = useState(entityId);
  useEffect(() => {
    getEffectiveEntity({ database, entityId }).then(r => {
      if (r.found) setTitle(r.entity.title);
    });
  }, [database, entityId]);
  return <>{title}</>;
}

export function RelationsTab({ entityId, database }: Props) {
  const db = database ?? EMPTY_DB;

  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState('');
  const [gmOnly, setGmOnly] = useState(false);

  useEffect(() => {
    getRelations(db, entityId, { includeInactive: true }).then(setRelations);
  }, [entityId, database]);

  const active = relations.filter((r) => r.active === 1);
  const inactive = relations.filter((r) => r.active === 0);
  const allTypes = getAllRelationTypes();

  function refresh() {
    getRelations(db, entityId, { includeInactive: true }).then(setRelations);
  }

  async function handleDeactivate(relationId: string) {
    await deactivateRelation(db, relationId);
    refresh();
  }

  async function handleReactivate(relationId: string) {
    await reactivateRelation(db, relationId);
    refresh();
  }

  async function handleAddSelect(targetId: string) {
    if (!newRelationType) return;
    await addRelation(db, {
      source_id: entityId,
      target_id: targetId,
      relation_type: newRelationType,
      visibility: gmOnly ? 'gm_only' : 'public',
    });
    setShowAddForm(false);
    setNewRelationType('');
    setGmOnly(false);
    refresh();
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
              {label} → <EntityTitle entityId={otherId} database={db} />
              {visibility === 'gm_only' && ' [GM only]'}
              {rel.notes && ` (${rel.notes})`}
              <button onClick={() => void handleDeactivate(rel.id)} aria-label="Deactivate">
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
                {label} → <EntityTitle entityId={otherId} database={db} />
                {rel.notes && ` (${rel.notes})`}
                <button onClick={() => void handleReactivate(rel.id)} aria-label="Reactivate">
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
            <label>
              <input
                type="checkbox"
                checked={gmOnly}
                onChange={(e) => setGmOnly(e.target.checked)}
                aria-label="GM only"
              />
              GM only
            </label>
            <EntityPicker onSelect={(id) => void handleAddSelect(id)} database={db} />
          </div>
        )}
      </div>
    </div>
  );
}
