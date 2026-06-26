import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity } from '../services/entity-service';
import { PropertiesForm, MentionText } from './PropertiesForm';
import type { EntityMention } from './PropertiesForm';
import { getSchemaForType } from '../data/entity-type-schemas';
import { listEntitiesByType } from '../services/entity-service';

async function findMentions(db: DatabaseLike, entityId: string): Promise<{ id: string; title: string; type: string }[]> {
  const rows = await db.select<{ id: string; title: string; type: string }>(
    `SELECT id, title, type FROM base_entities WHERE properties_json LIKE ? OR summary LIKE ?`,
    [`%](${entityId})%`, `%](${entityId})%`],
  );
  return rows;
}

type EffectiveResult = Awaited<ReturnType<typeof getEffectiveEntity>>;

type TabDefinition = {
  id: string;
  label: string;
  render: (props: { entityId: string; database?: DatabaseLike }) => React.ReactNode;
};

const registeredTabs: TabDefinition[] = [];
export function registerEntityTab(tab: TabDefinition) { registeredTabs.push(tab); }
export function clearEntityTabs() { registeredTabs.splice(0); }

async function saveEntity(db: DatabaseLike, entityId: string, patch: {
  title?: string; summary?: string; properties?: Record<string, unknown>;
}) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { fields.push('title = ?'); vals.push(patch.title); }
  if (patch.summary !== undefined) { fields.push('summary = ?'); vals.push(patch.summary); }
  if (patch.properties !== undefined) { fields.push('properties_json = ?'); vals.push(JSON.stringify(patch.properties)); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now')");
  vals.push(entityId);
  await db.execute(`UPDATE base_entities SET ${fields.join(', ')} WHERE id = ?`, vals);
}

type EntityDetailViewProps = { entityId: string; database?: DatabaseLike; onNavigateToEntity?: (id: string) => void };

export function EntityDetailView({ entityId, database, onNavigateToEntity }: EntityDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [extraTabs] = useState<TabDefinition[]>(() => [...registeredTabs]);
  const [result, setResult] = useState<EffectiveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [allEntities, setAllEntities] = useState<EntityMention[]>([]);
  const [mentions, setMentions] = useState<{ id: string; title: string; type: string }[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editProps, setEditProps] = useState<Record<string, unknown>>({});

  function load() {
    setLoading(true);
    getEffectiveEntity({ database: database as DatabaseLike, entityId })
      .then((r) => { setResult(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(); setEditing(false);
    if (database) {
      listEntitiesByType({ database: database as Parameters<typeof listEntitiesByType>[0]['database'], type: null })
        .then((rows) => setAllEntities(rows as EntityMention[]))
        .catch(console.error);
      findMentions(database as DatabaseLike, entityId)
        .then(setMentions)
        .catch(console.error);
    }
  }, [database, entityId]);

  function startEdit() {
    if (!result?.found) return;
    const { entity } = result;
    setEditTitle(entity.title);
    setEditSummary(entity.summary);
    setEditProps({ ...entity.properties });
    setEditing(true);
  }

  async function commitEdit() {
    if (!database) return;
    await saveEntity(database as DatabaseLike, entityId, {
      title: editTitle,
      summary: editSummary,
      properties: editProps,
    });
    setEditing(false);
    load();
  }

  if (loading) return <div className="entity-detail__loading">Ladeâ€¦</div>;
  if (!result) return <div className="entity-detail__error">Fehler beim Laden.</div>;
  if (!result.found) return <div className="entity-detail__error">Entity nicht gefunden.</div>;

  const { entity } = result;
  const schema = getSchemaForType(entity.type);

  const tabs: TabDefinition[] = [
    {
      id: 'overview',
      label: 'Ãœbersicht',
      render: () => editing ? (
        <div className="entity-detail__edit-form">
          <div className="entity-detail__field">
            <label className="entity-detail__field-label">Name</label>
            <input className="entity-detail__input" value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="entity-detail__field">
            <label className="entity-detail__field-label">Zusammenfassung</label>
            <textarea className="entity-detail__textarea" value={editSummary} rows={3}
              onChange={(e) => setEditSummary(e.target.value)} />
          </div>
          {Object.keys(schema.properties).length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">Eigenschaften</label>
              <div className="entity-detail__props-form">
                <PropertiesForm
                  schema={schema.properties}
                  values={editProps}
                  onChange={(patch) => setEditProps((prev) => ({ ...prev, ...patch }))}
                  entities={allEntities}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="entity-detail__overview">
          {entity.summary && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">Zusammenfassung</label>
              <div className="entity-detail__summary">{entity.summary}</div>
            </div>
          )}
          {Object.keys(schema.properties).length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">Eigenschaften</label>
              <div className="entity-detail__properties">
                {Object.entries(schema.properties).map(([key, fieldDef]) => {
                  const val = entity.properties[key];
                  if (val === undefined || val === '' || val === null) return null;
                  const display = Array.isArray(val) ? (val as string[]).join(', ') : String(val);
                  return (
                    <div key={key} className="entity-detail__prop-row">
                      <span className="entity-detail__prop-key">{fieldDef.title ?? key}</span>
                      <span className="entity-detail__prop-val">
                        <MentionText text={display} onNavigate={onNavigateToEntity} />
                      </span>
                    </div>
                  );
                })}
                {Object.keys(entity.properties)
                  .filter((k) => !(k in schema.properties))
                  .map((key) => (
                    <div key={key} className="entity-detail__prop-row">
                      <span className="entity-detail__prop-key">{key}</span>
                      <span className="entity-detail__prop-val">{String(entity.properties[key])}</span>
                    </div>
                  ))}
                {Object.keys(entity.properties).length === 0 && (
                  <span className="entity-detail__prop-empty">Noch keine Eigenschaften gesetzt.</span>
                )}
              </div>
            </div>
          )}
          {entity.aliases.length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">Aliase</label>
              <div className="entity-detail__field-value">{entity.aliases.join(', ')}</div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'mentions',
      label: 'Mentions',
      render: () => (
        <div className="entity-detail__mentions">
          {mentions.length === 0 ? (
            <span className="entity-detail__prop-empty">Keine Verlinkungen gefunden.</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' }}>
              {mentions.map((m) => (
                <span key={m.id} className="mention-chip"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onNavigateToEntity?.(m.id)}
                  title={`${m.type}: ${m.title}`}>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7, marginRight: 3 }}>{m.type}</span>
                  {m.title}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    ...extraTabs,
  ];

  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="entity-detail">
      <div className="entity-detail__header">
        {editing ? (
          <input className="entity-detail__title-input" value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)} autoFocus />
        ) : (
          <div className="entity-detail__name">{entity.title}</div>
        )}
        <div className="entity-detail__type-badge">{entity.type}</div>
        {editing ? (
          <>
            <button className="btn btn--primary" style={{ fontSize: '0.8rem', padding: '3px 10px' }}
              onClick={() => void commitEdit()}>Speichern</button>
            <button className="btn" style={{ fontSize: '0.8rem', padding: '3px 10px' }}
              onClick={() => setEditing(false)}>Abbrechen</button>
          </>
        ) : (
          <button className="entity-detail__edit-btn" onClick={startEdit} title="Bearbeiten">âœï¸</button>
        )}
      </div>
      <div className="entity-detail__tabs" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            className={`entity-detail__tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="entity-detail__body" role="tabpanel">
        {activeTabDef?.render({ entityId, database })}
      </div>
    </div>
  );
}

