import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity } from '../services/entity-service';
import {
  getRelations, addRelation, deactivateRelation, reactivateRelation,
  addCampaignRelation, deactivateCampaignRelation, reactivateCampaignRelation, promoteCampaignRelation,
  RelationRow,
} from '../services/relation-service';
import { getRelationTypeDefinition, getAllRelationTypes } from '../data/relation-type-registry';
import { EntityPicker } from './EntityPicker';
import { Button, Chip, ListRow, Panel, StatusChip } from './primitives';
import { useCampaignContext } from './useCampaignContext';

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
    }).catch(console.error);
  }, [database, entityId]);
  return <>{title}</>;
}

export function RelationsTab({ entityId, database }: Props) {
  const { t } = useTranslation('entity');
  const db = database ?? EMPTY_DB;

  // #418: in a DM-play campaign, new relations are campaign-local (own table, no world write)
  // and existing campaign-local ones are shown/marked; undefined = world relations only.
  const campaignId = useCampaignContext();
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRelationType, setNewRelationType] = useState('');
  const [gmOnly, setGmOnly] = useState(false);

  useEffect(() => {
    getRelations(db, entityId, { includeInactive: true }, campaignId).then(setRelations).catch(console.error);
  }, [entityId, database, campaignId]);

  const active = relations.filter((r) => r.active === 1);
  const inactive = relations.filter((r) => r.active === 0);
  const allTypes = getAllRelationTypes();

  function refresh() {
    getRelations(db, entityId, { includeInactive: true }, campaignId).then(setRelations).catch(console.error);
  }

  async function handleDeactivate(rel: RelationRow) {
    if (rel.campaignId) await deactivateCampaignRelation(db, rel.id);
    else await deactivateRelation(db, rel.id);
    refresh();
  }

  async function handleReactivate(rel: RelationRow) {
    if (rel.campaignId) await reactivateCampaignRelation(db, rel.id);
    else await reactivateRelation(db, rel.id);
    refresh();
  }

  async function handlePromote(rel: RelationRow) {
    if (!rel.campaignId) return;
    await promoteCampaignRelation(db, { campaignId: rel.campaignId, relationId: rel.id });
    refresh();
  }

  async function handleAddSelect(targetId: string) {
    if (!newRelationType) return;
    const params = {
      source_id: entityId,
      target_id: targetId,
      relation_type: newRelationType,
      visibility: gmOnly ? 'gm_only' : 'public',
    };
    if (campaignId) await addCampaignRelation(db, { ...params, campaignId });
    else await addRelation(db, params);
    setShowAddForm(false);
    setNewRelationType('');
    setGmOnly(false);
    refresh();
  }

  return (
    <div className="relations-tab">
      <section className="relations-tab__section">
        <h3>{t('relations.active')}</h3>
        {active.map((rel) => {
          const label = getLabel(rel, entityId);
          const otherId = getOtherEntityId(rel, entityId);
          const visibility = JSON.parse(rel.visibility_json ?? '"public"');
          return (
            <ListRow as="div" interactive={false} key={rel.id} className="relations-tab__row">
              <span>{label} → <EntityTitle entityId={otherId} database={db} /></span>
              {visibility === 'gm_only' && <Chip tone="accent" className="relations-tab__badge">GM only</Chip>}
              {rel.campaignId && <StatusChip tone="accent">{t('relations.campaignScoped', 'Kampagne')}</StatusChip>}
              {rel.notes && <span className="relations-tab__notes">({rel.notes})</span>}
              {rel.campaignId && (
                <Button variant="outline" size="compact" onClick={() => void handlePromote(rel)}>
                  {t('relations.promote', 'In die Welt übernehmen')}
                </Button>
              )}
              <Button onClick={() => void handleDeactivate(rel)} aria-label="Deactivate">
                Deactivate
              </Button>
            </ListRow>
          );
        })}
        {active.length === 0 && <span className="relations-tab__empty">{t('relations.none', 'Keine Relationen')}</span>}
      </section>

      {inactive.length > 0 && (
        <section className="relations-tab__section">
          <h3>{t('relations.inactive')}</h3>
          {inactive.map((rel) => {
            const label = getLabel(rel, entityId);
            const otherId = getOtherEntityId(rel, entityId);
            return (
              <ListRow as="div" interactive={false} key={rel.id} className="relations-tab__row relations-tab__row--inactive">
                <span>{label} → <EntityTitle entityId={otherId} database={db} /></span>
                {rel.notes && <span className="relations-tab__notes">({rel.notes})</span>}
                <Button onClick={() => void handleReactivate(rel)} aria-label="Reactivate">
                  Reactivate
                </Button>
              </ListRow>
            );
          })}
        </section>
      )}

      <div className="relations-tab__add">
        <Button onClick={() => setShowAddForm((v) => !v)}>Add relation</Button>
        {showAddForm && (
          <Panel className="relations-tab__add-form u-stack u-gap-2">
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
            <label className="relations-tab__gm-toggle">
              <input
                type="checkbox"
                checked={gmOnly}
                onChange={(e) => setGmOnly(e.target.checked)}
                aria-label="GM only"
              />
              GM only
            </label>
            {/* Picker only shown once a type is chosen — otherwise clicking
                a result would silently no-op in handleAddSelect (#292
                follow-up finding). */}
            {newRelationType ? (
              <EntityPicker onSelect={(id) => void handleAddSelect(id)} database={db} campaignId={campaignId} />
            ) : (
              <span className="relations-tab__hint">Bitte zuerst einen Relation-Typ wählen.</span>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
