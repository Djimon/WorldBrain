// M14-S07: Event form — kind, participants/locations, visibility (#262)
// Event-specific extra fields for the standard entity edit form (title/body
// come from EntityDetailView — not rebuilt here, per this Story's AC).
//
// #292 follow-up: an optional `calendar` prop renders start/end via the real
// CalendarDateInput widget (counter <-> {year,month,day} projection) when a
// calendar is available (e.g. the calendar area, which always has one).
// Without it (e.g. browsing entities outside the calendar context, where no
// calendar is unambiguously "active"), falls back to the plain counter-day
// number input this component originally shipped with — m14-s07's tests
// exercise that fallback path directly.
import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';
import { addRelation, deactivateRelation, getRelations } from '../services/relation-service';
import type { RelationRow } from '../services/relation-service';
import { EVENT_CATEGORY_SUGGESTIONS } from '../services/event-entity-service';
import type { CalendarShape } from '../../core_data/calendar-schema';
import { counterToDate, dateToCounter, formatCalendarDate } from '../../core_data/calendar-schema';
import { CalendarDateInput } from './CalendarDateInput';

export type EventKind = 'single' | 'phase';

export interface EventFormFieldsProps {
  database: DatabaseLike;
  eventId: string;
  startDay: number;
  endDay?: number;
  onEndDayChange: (endDay: number | undefined) => void;
  visibility: string;
  onVisibilityChange: (visibility: string) => void;
  category?: string;
  onCategoryChange?: (category: string) => void;
  calendar?: CalendarShape;
}

/** Whether the current kind/day combination is valid to save: phase requires end_day >= start_day. */
export function isEventFormValid(kind: EventKind, startDay: number, endDay: number | undefined): boolean {
  if (kind === 'single') return true;
  return endDay !== undefined && endDay >= startDay;
}

/**
 * #292: event_kind is derived internally from the end-date field, never
 * shown/asked as its own control (the "Kind" toggle must not appear in the
 * DOM). Empty end_day or end_day === start_day => 'single'; anything else
 * => 'phase'. Clamped end_day (>= start_day) is the caller's job before
 * calling this — this function only classifies.
 */
export function deriveEventKind(startDay: number, endDay: number | undefined): EventKind {
  if (endDay === undefined || endDay === startDay) return 'single';
  return 'phase';
}

const PARTICIPANT_RELATION = 'event_has_participant';
const PARTICIPANT_INVERSE = 'participant_in';
const LOCATION_RELATION = 'event_at_location';
const LOCATION_INVERSE = 'location_of';

interface EntityOption { id: string; title: string }

/**
 * @-triggered autocomplete for picking an entity to attach as a relation
 * (participant/location) — same interaction as PropertiesForm's mention
 * field (type "@", arrow keys, Enter/click to pick). Typing the full title
 * without "@" and pressing Enter also works (exact match), so this mirrors
 * the pill-input's original plain-Enter contract too.
 */
function RelationAutocomplete({
  label, entities, onSelect, pills, onRemovePill, onEnterFallback,
}: {
  label: string;
  entities: EntityOption[];
  onSelect: (entity: EntityOption) => void;
  pills: { id: string; title: string }[];
  onRemovePill: (id: string) => void;
  onEnterFallback: (input: string) => void;
}) {
  const { t } = useTranslation('entity');
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const query = input.replace(/^@/, '');
  const matches = open && query
    ? entities.filter((e) => e.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function selectEntity(entity: EntityOption) {
    onSelect(entity);
    setInput('');
    setOpen(false);
  }

  function handleChange(value: string) {
    setInput(value);
    setOpen(value.startsWith('@') && value.length > 1);
    setHighlight(0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (open && matches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((i) => Math.min(i + 1, matches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectEntity(matches[highlight]); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    if (e.key === 'Enter') {
      const value = input;
      setInput('');
      onEnterFallback(value);
    }
  }

  return (
    <div className="event-form-fields__pills">
      <div className="event-form-fields__autocomplete">
        <input
          type="text"
          aria-label={label}
          placeholder={label}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && matches.length > 0 && (
          <div className="event-form-fields__suggest">
            {matches.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={`event-form-fields__suggest-item${i === highlight ? ' active' : ''}`}
                onMouseDown={(ev) => { ev.preventDefault(); selectEntity(m); }}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {pills.map((p) => (
        <span key={p.id} data-pill>
          <span>{p.title}</span>
          <button type="button" aria-label={t('remove', { ns: 'common' })} onClick={() => onRemovePill(p.id)}>×</button>
        </span>
      ))}
    </div>
  );
}

export function EventFormFields({
  database, eventId, startDay, endDay, onEndDayChange, visibility, onVisibilityChange,
  category, onCategoryChange, calendar,
}: EventFormFieldsProps) {
  const { t } = useTranslation('entity');
  const [entityTitles, setEntityTitles] = useState<Record<string, string>>({});
  const [allEntities, setAllEntities] = useState<EntityOption[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);

  useEffect(() => {
    listEntitiesByType({ database, type: null }).then((rows) => {
      setEntityTitles(Object.fromEntries(rows.map((r) => [r.id, r.title])));
      setAllEntities(rows.map((r) => ({ id: r.id, title: r.title })));
    }).catch(console.error);
  }, [database]);

  useEffect(() => {
    getRelations(database, eventId, { includeInactive: false }).then(setRelations).catch(console.error);
  }, [database, eventId]);

  async function addPillRelation(relationType: string, inverseType: string, entity: EntityOption) {
    const { id } = await addRelation(database, {
      source_id: eventId,
      target_id: entity.id,
      relation_type: relationType,
      inverse_type: inverseType,
      visibility,
    });
    setRelations((prev) => [...prev, {
      id, source_id: eventId, target_id: entity.id, relation_type: relationType,
      inverse_type: inverseType, active: 1, visibility_json: JSON.stringify(visibility), notes: null,
    }]);
    setEntityTitles((prev) => ({ ...prev, [entity.id]: entity.title }));
  }

  /** Enter with no "@" dropdown open: fresh-fetched exact title match (no
   *  reliance on allEntities' load timing — keeps this path safe even if the
   *  mount-effect fetch hasn't resolved yet). */
  async function confirmExactMatch(relationType: string, inverseType: string, input: string, clear: () => void) {
    const trimmed = input.trim();
    if (!trimmed) return;
    const rows = await listEntitiesByType({ database, type: null });
    const match = rows.find((r) => r.title.toLowerCase() === trimmed.toLowerCase());
    if (!match) return;
    await addPillRelation(relationType, inverseType, { id: match.id, title: match.title });
    clear();
  }

  async function removePill(relationId: string) {
    await deactivateRelation(database, relationId);
    setRelations((prev) => prev.filter((r) => r.id !== relationId));
  }

  const participantPills = relations.filter((r) => r.relation_type === PARTICIPANT_RELATION && r.active === 1);
  const locationPills = relations.filter((r) => r.relation_type === LOCATION_RELATION && r.active === 1);

  return (
    <div className="event-form-fields">
      <div className="event-form-fields__kind">
        <span>{t('event.startLabel')}{calendar ? formatCalendarDate(calendar, startDay) : t('event.dayCounter', { day: startDay })}</span>
      </div>

      {calendar ? (
        <div className="event-form-fields__enddate">
          <span className="event-form-fields__field-label">{t('event.end')}</span>
          <CalendarDateInput
            months={calendar.months ?? []}
            value={counterToDate(calendar, endDay ?? startDay)}
            onChange={(date) => onEndDayChange(Math.max(dateToCounter(calendar, date), startDay))}
          />
        </div>
      ) : (
        <input
          type="number"
          role="spinbutton"
          aria-label={t('event.endDate')}
          value={endDay ?? ''}
          onChange={(e) => {
            if (e.target.value === '') { onEndDayChange(undefined); return; }
            onEndDayChange(Math.max(Number(e.target.value), startDay));
          }}
        />
      )}

      <RelationAutocomplete
        label={t('event.participants')}
        entities={allEntities}
        onSelect={(entity) => void addPillRelation(PARTICIPANT_RELATION, PARTICIPANT_INVERSE, entity)}
        onEnterFallback={(input) => void confirmExactMatch(PARTICIPANT_RELATION, PARTICIPANT_INVERSE, input, () => {})}
        pills={participantPills.map((r) => ({ id: r.id, title: entityTitles[r.target_id] ?? r.target_id }))}
        onRemovePill={removePill}
      />

      <RelationAutocomplete
        label={t('event.locations')}
        entities={allEntities}
        onSelect={(entity) => void addPillRelation(LOCATION_RELATION, LOCATION_INVERSE, entity)}
        onEnterFallback={(input) => void confirmExactMatch(LOCATION_RELATION, LOCATION_INVERSE, input, () => {})}
        pills={locationPills.map((r) => ({ id: r.id, title: entityTitles[r.target_id] ?? r.target_id }))}
        onRemovePill={removePill}
      />

      <select aria-label={t('field.visibility')} value={visibility} onChange={(e) => onVisibilityChange(e.target.value)}>
        <option value="public">{t('vis.public')}</option>
        <option value="gm_only">{t('vis.gmOnly')}</option>
      </select>

      <input
        type="text"
        aria-label={t('event.category')}
        placeholder={t('event.category')}
        list="event-category-suggestions"
        value={category ?? ''}
        onChange={(e) => onCategoryChange?.(e.target.value)}
      />
      <datalist id="event-category-suggestions">
        {EVENT_CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
      </datalist>
    </div>
  );
}
