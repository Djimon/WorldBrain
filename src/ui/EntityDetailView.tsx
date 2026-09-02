import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '../utils/markdown';
import type { DatabaseLike } from '../services/entity-service';
import { getEffectiveEntity, deleteEntity } from '../services/entity-service';
import { PropertiesForm, MentionText } from './PropertiesForm';
import type { EntityMention } from './PropertiesForm';
import { getSchemaForType } from '../data/entity-type-schemas';
import { listEntitiesByType } from '../services/entity-service';
import { EventFormFields, deriveEventKind } from './EventFormFields';
import { EffectEditor } from './EffectEditor';
import { updateEventEntity } from '../services/event-entity-service';
import type { CalendarShape } from '../../core_data/calendar-schema';
import { formatCalendarDate } from '../../core_data/calendar-schema';
import { loadActiveCalendar } from '../services/calendar-service';
import { getRelations } from '../services/relation-service';
import type { RelationRow } from '../services/relation-service';
import { Button, Chip, Tabs } from './primitives';
import { useReadOnly } from './useReadOnly';
import { VisibilityScopePicker, type BaseScope } from './VisibilityScopePicker';
import { PromoteControl } from './PromoteControl';
import { useAppMode } from './AppModeContext';
import { upsertCampaignOverride } from '../services/campaign-override-service';

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

type EntityDetailViewProps = {
  entityId: string;
  database?: DatabaseLike;
  onNavigateToEntity?: (id: string) => void;
  // #292: when rendered inline inside the calendar area, the caller has a
  // real calendar to project Event day-counters into dates, and wants the
  // freshly-created event to open directly in edit mode.
  calendar?: CalendarShape;
  startInEditMode?: boolean;
  /** Called after the entity is deleted — the parent owns what happens next
   *  (close an inline panel, clear a list selection, ...). */
  onDeleted?: () => void;
  /** M14 (#345): Called after every successful `commitEdit()` — parent can
   *  bump its cache/refresh token (e.g. calendar refresh after an end-date
   *  change). Fires for both the Event and non-Event branch. */
  onSaved?: () => void;
  /** Read-only compact peek: render ONLY the overview tab (no registered extra
   *  tabs, no tab strip, no edit pencil). Used by the graph node-preview so it
   *  can't re-mount its own Graph tab → infinite recursion. The caller pairs it
   *  with its own jump-to-entity affordance (e.g. the graph's "Open" button). */
  overviewOnly?: boolean;
  /** M10-S21 (#365): set in the campaign context — then the promote switch
   *  appears (override → world base). For a pure world-base edit it is
   *  unset → no promote (there is no override). */
  campaignId?: string;
};

export function EntityDetailView({ entityId, database, onNavigateToEntity, calendar, startInEditMode, onDeleted, onSaved, overviewOnly, campaignId: campaignIdProp }: EntityDetailViewProps) {
  // M10-S21 (#365, D25 reconciliation): the edit target comes from the active
  // campaign context, NOT from the edit/play toggle. Only when the DM has an
  // active campaign in play mode are edits campaign-scoped (override)
  // and the promote switch reachable. Otherwise = world base (no override).
  const { mode, sessionRole, activeSessionId } = useAppMode();
  const campaignId = campaignIdProp
    ?? (mode === 'play' && sessionRole === 'dm' && activeSessionId !== null ? activeSessionId : undefined);
  const { t } = useTranslation('entity');
  const readOnly = useReadOnly(); // M10-S23: player mode hides edit/delete.
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
  const [deletePrompt, setDeletePrompt] = useState(false);
  // Bumped after each save so PromoteControl re-checks whether an override now exists
  // (a DM edit in campaign context just created one → the promote button should appear).
  const [promoteReloadTick, setPromoteReloadTick] = useState(0);
  // #292 follow-up: a day-counter is meaningless without a calendar to
  // project it through. If the caller didn't hand one down explicitly (e.g.
  // viewed via the Entity-Browser, not the calendar area), resolve the
  // project's active calendar ourselves — a counter always corresponds to a
  // real date in whichever calendar is active, this isn't optional.
  const [autoCalendar, setAutoCalendar] = useState<CalendarShape | null>(null);
  const effectiveCalendar = calendar ?? autoCalendar ?? undefined;
  const [eventRelations, setEventRelations] = useState<RelationRow[]>([]);
  const [relationEntityTitles, setRelationEntityTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (calendar || !database) return;
    loadActiveCalendar(database as DatabaseLike).then(setAutoCalendar).catch(console.error);
  }, [calendar, database]);

  async function handleDelete() {
    if (!database) return;
    await deleteEntity(database as DatabaseLike, entityId);
    setDeletePrompt(false);
    onDeleted?.();
  }

  function load() {
    setLoading(true);
    getEffectiveEntity({ database: database as DatabaseLike, entityId })
      .then((r) => { setResult(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(); setEditing(false); setActiveTab('overview'); setDeletePrompt(false);
    if (database) {
      listEntitiesByType({ database: database as Parameters<typeof listEntitiesByType>[0]['database'], type: null })
        .then((rows) => setAllEntities(rows as EntityMention[]))
        .catch(console.error);
    }
  }, [database, entityId]);

  // #292: auto-enter edit mode once, right after a freshly-created event
  // loads (day-click in the calendar) — not on every subsequent reload of
  // the same entity (e.g. after commitEdit's own load() call).
  const autoEditAppliedFor = useRef<string | null>(null);
  useEffect(() => {
    // `result` may still hold the PREVIOUS entity for a render or two after
    // entityId changes (load() is async). Auto-editing then would populate the
    // form from the stale entity — the "clicking event B opens event A's edit"
    // bug. Only fire once `result` actually corresponds to the current entityId.
    if (
      startInEditMode && !readOnly && result?.found && result.entity.id === entityId
      && autoEditAppliedFor.current !== entityId
    ) {
      autoEditAppliedFor.current = entityId;
      startEdit();
    }
  }, [result, startInEditMode, entityId, readOnly]);

  // #292 follow-up: participants/locations shown directly in the Event
  // overview (not only behind the separate Relations tab) — "who/where" is
  // core info for an event, not an incidental relation to browse elsewhere.
  useEffect(() => {
    if (!database || !result?.found || result.entity.type !== 'Event') return;
    getRelations(database as DatabaseLike, entityId, { includeInactive: false }).then(setEventRelations).catch(console.error);
  }, [database, entityId, result]);

  useEffect(() => {
    if (!database || eventRelations.length === 0) return;
    listEntitiesByType({ database: database as Parameters<typeof listEntitiesByType>[0]['database'], type: null })
      .then((rows) => setRelationEntityTitles(Object.fromEntries(rows.map((r) => [r.id, r.title]))))
      .catch(console.error);
  }, [database, eventRelations]);

  function startEdit() {
    if (!result?.found) return;
    const { entity } = result;
    setEditTitle(entity.title);
    setEditSummary(entity.summary);
    setEditProps({ ...entity.properties });
    // M10-S07: editVisibility applies to ALL entity types (VisibilityScopePicker
    // in the overview tab), no longer only for Events.
    setEditVisibility(entity.visibility);
    if (entity.type === 'Event') {
      setEditStartDay(typeof entity.properties.start_day === 'number' ? entity.properties.start_day : 0);
      setEditEndDay(typeof entity.properties.end_day === 'number' ? entity.properties.end_day : undefined);
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
      onSaved?.();
    } else if (campaignId !== undefined) {
      // M10-S21: edit in the active DM-play campaign context → campaign override
      // (properties), base world UNTOUCHED. The promote switch can later lift
      // the override into the world.
      await upsertCampaignOverride(database as DatabaseLike, {
        campaignId,
        entityId,
        patchJson: JSON.stringify(editProps),
      });
      onSaved?.();
    } else {
      await saveEntity(database as DatabaseLike, entityId, {
        title: editTitle,
        summary: editSummary,
        properties: editProps,
        visibility: editVisibility,
      });
      onSaved?.();
    }
    setEditing(false);
    setPromoteReloadTick((n) => n + 1);
    load();
  }

  if (loading) return <div className="entity-detail__loading">{t('loading', { ns: 'common' })}</div>;
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
                  calendar={effectiveCalendar}
                />
              </div>
              <div className="entity-detail__field">
                <EffectEditor database={database as DatabaseLike} eventId={entityId} startDay={editStartDay} calendar={effectiveCalendar} />
              </div>
              {/* M10-S07: Events also get the per-player/group editor
                  (the base-scope select in EventFormFields only covers the 4
                  classic scopes; the additive layer follows here). */}
              <div className="entity-detail__field">
                <label className="entity-detail__field-label">{t('field.visibility')}</label>
                <VisibilityScopePicker
                  database={database as DatabaseLike}
                  targetType="entity"
                  targetId={entityId}
                  baseScope={(editVisibility || 'public') as BaseScope}
                  onBaseScopeChange={(s) => setEditVisibility(s)}
                />
              </div>
            </>
          ) : (
            <>
              {Object.keys(schema.properties).length > 0 && (
                <div className="entity-detail__field">
                  <label className="entity-detail__field-label">{t('field.properties')}</label>
                  <PropertiesForm
                    schema={schema.properties}
                    values={editProps}
                    onChange={(patch) => setEditProps((prev) => ({ ...prev, ...patch }))}
                    entities={allEntities}
                  />
                </div>
              )}
              {/* M10-S07 (#356): base-scope + per-player/group overrides.
                  Editor deliberately here for all non-Event types (Events have
                  their own visibility widget in EventFormFields). */}
              <div className="entity-detail__field">
                <label className="entity-detail__field-label">{t('field.visibility')}</label>
                <VisibilityScopePicker
                  database={database as DatabaseLike}
                  targetType="entity"
                  targetId={entityId}
                  baseScope={(editVisibility || 'public') as BaseScope}
                  onBaseScopeChange={(s) => setEditVisibility(s)}
                />
              </div>
            </>
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
            // #292 follow-up: start_day/end_day are raw day counters — a
            // counter is meaningless without a calendar, but the project
            // always HAS an active one (effectiveCalendar self-resolves it
            // when no explicit `calendar` prop was passed), so a real date
            // shows here too, never the bare integer. Participants/locations
            // surfaced directly (not only behind the separate Relations tab).
            <div className="entity-detail__field">
              <label className="entity-detail__field-label">{t('field.properties')}</label>
              <div className="entity-detail__properties">
                {effectiveCalendar && typeof entity.properties.start_day === 'number' && (
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">{t('event.start')}</span>
                    <span className="entity-detail__prop-val">{formatCalendarDate(effectiveCalendar, entity.properties.start_day)}</span>
                  </div>
                )}
                {effectiveCalendar && typeof entity.properties.end_day === 'number' && (
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">{t('event.end')}</span>
                    <span className="entity-detail__prop-val">{formatCalendarDate(effectiveCalendar, entity.properties.end_day)}</span>
                  </div>
                )}
                {typeof entity.properties.category === 'string' && entity.properties.category !== '' && (
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">{t('event.category')}</span>
                    <span className="entity-detail__prop-val">{String(entity.properties.category)}</span>
                  </div>
                )}
                {eventRelations.filter((r) => r.relation_type === 'event_has_participant' && r.active === 1).length > 0 && (
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">{t('event.participants')}</span>
                    <span className="entity-detail__prop-val">
                      {eventRelations
                        .filter((r) => r.relation_type === 'event_has_participant' && r.active === 1)
                        .map((r) => relationEntityTitles[r.target_id] ?? r.target_id)
                        .join(', ')}
                    </span>
                  </div>
                )}
                {eventRelations.filter((r) => r.relation_type === 'event_at_location' && r.active === 1).length > 0 && (
                  <div className="entity-detail__prop-row">
                    <span className="entity-detail__prop-key">{t('event.locations')}</span>
                    <span className="entity-detail__prop-val">
                      {eventRelations
                        .filter((r) => r.relation_type === 'event_at_location' && r.active === 1)
                        .map((r) => relationEntityTitles[r.target_id] ?? r.target_id)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
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
                      <span className="entity-detail__prop-key">{t('prop.' + key, { ns: 'entity', defaultValue: fieldDef.title ?? key })}</span>
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
    ...(overviewOnly ? [] : extraTabs),
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
        <Chip tone="accent" className="entity-detail__type-badge">{entity.type}</Chip>
        {editing ? (
          <>
            <Button tone="accent" size="compact" onClick={() => void commitEdit()}>{t('save', { ns: 'common' })}</Button>
            <Button size="compact" onClick={() => setEditing(false)}>{t('cancel', { ns: 'common' })}</Button>
            {deletePrompt ? (
              <span className="entity-detail__delete-confirm">
                <span>{t('deleteConfirm')}</span>
                <Button tone="danger" variant="outline" size="compact" onClick={() => void handleDelete()}>{t('deleteConfirmYes')}</Button>
                <Button size="compact" onClick={() => setDeletePrompt(false)}>{t('cancel', { ns: 'common' })}</Button>
              </span>
            ) : (
              <Button tone="danger" variant="outline" size="compact" onClick={() => setDeletePrompt(true)}>{t('delete', { ns: 'common' })}</Button>
            )}
          </>
        ) : overviewOnly || readOnly ? null : (
          <Button variant="ghost" size="icon" className="entity-detail__edit-btn" onClick={startEdit} aria-label={t('edit', { ns: 'common' })} title={t('edit', { ns: 'common' })}>✏️</Button>
        )}
        {/* M10-S21 (#365): promote switch only in the campaign context + not
            read-only. Lifts this entity's campaign override into the world. */}
        {campaignId !== undefined && !overviewOnly && !readOnly && database !== undefined && (
          <PromoteControl database={database} campaignId={campaignId} entityId={entityId} onChanged={onSaved} reloadToken={promoteReloadTick} />
        )}
      </div>
      {!overviewOnly && (
        <Tabs
          className="entity-detail__tabs"
          label={t('entityDetailTabs')}
          activeId={activeTab}
          onSelect={setActiveTab}
          options={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        />
      )}
      <div className="entity-detail__body" role="tabpanel">
        {activeTabDef?.render({ entityId, database, onNavigate: onNavigateToEntity })}
      </div>
    </div>
  );
}

