import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '../utils/markdown';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity } from '../services/entity-service';
import { PropertiesForm, MentionText } from './PropertiesForm';
import type { EntityMention } from './PropertiesForm';
import { getSchemaForType } from '../data/entity-type-schemas';
import { listEntitiesByType } from '../services/entity-service';
import { EventFormFields, deriveEventKind } from './EventFormFields';
import { EffectEditor } from './EffectEditor';
import { updateEventEntity } from '../services/event-entity-service';

type EffectiveResult = Awaited<ReturnType<typeof getEffectiveEntity>>;

type TabDefinition = {
  id: string;
  label: string;
  render: (props: { entityId: string; database?: DatabaseLike; onNavigate?: (id: string) => void }) => React.ReactNode;
};

const registeredTabs: TabDefinition[] = [];
export function registerEntityTab(tab: TabDefinition) {
  // Idempotent by id — re-registration (HMR, double import) replaces rather
  // than appends, so tabs never duplicate.
  const i = registeredTabs.findIndex((t) => t.id === tab.id);
  if (i !== -1) registeredTabs[i] = tab; else registeredTabs.push(tab);
}
export function clearEntityTabs() { registeredTabs.splice(0); }

async function saveEntity(db: DatabaseLike, entityId: string, patch: {
  title?: string; summary?: string; properties?: Record<string, unknown>; visibility?: string;
}) {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { fields.push('title = ?'); vals.push(patch.title); }
  if (patch.summary !== undefined) { fields.push('summary = ?'); vals.push(patch.summary); }
  if (patch.properties !== undefined) { fields.push('properties_json = ?'); vals.push(JSON.stringify(patch.properties)); }
  if (patch.visibility !== undefined) { fields.push('visibility = ?'); vals.push(patch.visibility); }
  if (!fields.length) return;
  fields.push("updated_at = datetime('now')");
  vals.push(entityId);
  await db.execute(`UPDATE base_entities SET ${fields.join(', ')} WHERE id = ?`, vals);
}

type EntityDetailViewProps = { entityId: string; database?: DatabaseLike; onNavigateToEntity?: (id: string) => void };

export function EntityDetailView({ entityId, database, onNavigateToEntity }: EntityDetailViewProps) {
  const { t } = useTranslation('entity');
  const [activeTab, setActiveTab] = useState('overview');
  const [extraTabs] = useState<TabDefinition[]>(() => [...registeredTabs]);
  const [result, setResult] = useState<EffectiveResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [allEntities, setAllEntities] = useState<EntityMention[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editProps, setEditProps] = useState<Record<string, unknown>>({});
  // #292: Event-specific edit state (EventFormFields + EffectEditor own these
  // fields instead of the generic PropertiesForm for type='Event').
  const [editStartDay, setEditStartDay] = useState(0);
  const [editEndDay, setEditEndDay] = useState<number | undefined>(undefined);
  const [editVisibility, setEditVisibility] = useState('public');
  const [editCategory, setEditCategory] = useState<string | undefined>(undefined);

  function load() {
    setLoading(true);
    getEffectiveEntity({ database: database as DatabaseLike, entityId })
      .then((r) => { setResult(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(); setEditing(false); setActiveTab('overview');
    if (database) {
      listEntitiesByType({ database: database as Parameters<typeof listEntitiesByType>[0]['database'], type: null })
        .then((rows) => setAllEntities(rows as EntityMention[]))
        .catch(console.error);
    }
  }, [database, entityId]);

  function startEdit() {
    if (!result?.found) return;
    const { entity } = result;
    setEditTitle(entity.title);
    setEditSummary(entity.summary);
    setEditProps({ ...entity.properties });
    if (entity.type === 'Event') {
      setEditStartDay(typeof entity.properties.start_day === 'number' ? entity.properties.start_day : 0);
      setEditEndDay(typeof entity.properties.end_day === 'number' ? entity.properties.end_day : undefined);
      setEditVisibility(entity.visibility);
      setEditCategory(typeof entity.properties.category === 'string' ? entity.properties.category : undefined);
    }
    setEditing(true);
  }

  async function commitEdit() {
    if (!database || !result?.found) return;
    if (result.entity.type === 'Event') {
      const eventKind = deriveEventKind(editStartDay, editEndDay);
      await updateEventEntity(database as DatabaseLike, entityId, {
        title: editTitle,
        end_day: editEndDay,
        event_kind: eventKind,
        category: editCategory,
      });
      await saveEntity(database as DatabaseLike, entityId, { summary: editSummary, visibility: editVisibility });
    } else {
      await saveEntity(database as DatabaseLike, entityId, {
        title: editTitle,
        summary: editSummary,
        properties: editProps,
      });
    }
    setEditing(false);
    load();
  }

  if (loading) return <div className="entity-detail__loading">{t('loading')}</div>;
  if (!result) return <div className="entity-detail__error" role="alert">{t('loadingError')}</div>;
  if (!result.found) return <div className="entity-detail__error" role="alert">{t('notFound', { id: entityId })}</div>;

  const { entity } = result;
  const schema = getSchemaForType(entity.type);

  const tabs: TabDefinition[] = [
    {
      id: 'overview',
      label: t('tab.overview'),
      render: () => editing ? (
        <div className="entity-detail__edit-form">
          <div className="entity-detail__field">
            <label className="entity-detail__field-label">{t('field.name')}</label>
            <input className="entity-detail__input" value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="entity-detail__field">
            <label className="entity-detail__field-label">{t('field.summary')}</label>
            <textarea className="entity-detail__textarea" value={editSummary} rows={3}
              onChange={(e) => setEditSummary(e.target.value)} />
          </div>
          {entity.type === 'Event' ? (
            <>
              <div className="entity-detail__field">
                <EventFormFields
                  database={database as DatabaseLike}
                  eventId={entityId}
                  startDay={editStartDay}
                  endDay={editEndDay}
                  onEndDayChange={setEditEndDay}
                  visibility={editVisibility}
                  onVisibilityChange={setEditVisibility}
                  category={editCategory}
                  onCategoryChange={setEditCategory}
                />
              </div>
              <div className="entity-detail__field">
                <EffectEditor database={database as DatabaseLike} eventId={entityId} startDay={editStartDay} />
              </div>
            </>
          ) : Object.keys(schema.properties).length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">{t('field.properties')}</label>
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
              <label className="entity-detail__field-label">{t('field.summary')}</label>
              <div className="entity-detail__summary entity-detail__summary--md"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(entity.summary)) }} />
            </div>
          )}
          {entity.type === 'Event' ? (
            // #292: Event's real fields (start_day/end_day are raw day
            // counters) are not shown as generic property rows here — no
            // calendar object is available in this view to project them into
            // a real date (see m14-s16-event-form-wiring.dom.test.tsx's
            // scope note), and showing the bare counter integer is exactly
            // the bug this issue fixes. Only category (already a plain,
            // safe-to-display string) is surfaced; participants/locations
            // are relations shown via the Relations tab, not here.
            typeof entity.properties.category === 'string' && entity.properties.category !== '' && (
              <div className="entity-detail__field">
                <label className="entity-detail__field-label">{t('field.properties')}</label>
                <div className="entity-detail__properties">
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">Kategorie</span>
                    <span className="entity-detail__prop-val">{String(entity.properties.category)}</span>
                  </div>
                </div>
              </div>
            )
          ) : Object.keys(schema.properties).length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">{t('field.properties')}</label>
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
                  <span className="entity-detail__prop-empty">{t('noProperties')}</span>
                )}
              </div>
            </div>
          )}
          {entity.aliases.length > 0 && (
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">{t('field.aliases')}</label>
              <div className="entity-detail__field-value">{entity.aliases.join(', ')}</div>
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
              onClick={() => void commitEdit()}>{t('save')}</button>
            <button className="btn" style={{ fontSize: '0.8rem', padding: '3px 10px' }}
              onClick={() => setEditing(false)}>{t('cancel')}</button>
          </>
        ) : (
          <button className="entity-detail__edit-btn" onClick={startEdit} aria-label={t('edit', 'Bearbeiten')} title={t('edit', 'Bearbeiten')}>✏️</button>
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
        {activeTabDef?.render({ entityId, database, onNavigate: onNavigateToEntity })}
      </div>
    </div>
  );
}

