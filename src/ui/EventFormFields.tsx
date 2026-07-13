// M14-S07: Event-Formular — kind, participants/locations, visibility (#262)
// Event-specific extra fields for the standard entity edit form (title/body
// come from EntityDetailView — not rebuilt here, per this Story's AC).
//
// Assumption (undocumented in AC): the end_day field is a plain counter-day
// number input, matching how start_day is already represented elsewhere
// (e.g. EventQuickCreatePanel's prefilled day). The AC mentions reusing
// CalendarDateInput, but that widget operates on {year,month,day} and would
// require the active calendar object + counter<->date conversion here —
// that wiring is presentation-layer detail for the Implementation Agent,
// not a behavioral requirement this test file needs to pin down.
import { useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { listEntitiesByType } from '../services/entity-service';
import { addRelation, deactivateRelation, getRelations } from '../services/relation-service';
import type { RelationRow } from '../services/relation-service';
import { EVENT_CATEGORY_SUGGESTIONS } from '../services/event-entity-service';

export type EventKind = 'single' | 'phase';

export interface EventFormFieldsProps {
  database: DatabaseLike;
  eventId: string;
  kind: EventKind;
  startDay: number;
  endDay?: number;
  onKindChange: (kind: EventKind) => void;
  onEndDayChange: (endDay: number | undefined) => void;
  visibility: string;
  onVisibilityChange: (visibility: string) => void;
  category?: string;
  onCategoryChange?: (category: string) => void;
}

/** Whether the current kind/day combination is valid to save: phase requires end_day >= start_day. */
export function isEventFormValid(kind: EventKind, startDay: number, endDay: number | undefined): boolean {
  if (kind === 'single') return true;
  return endDay !== undefined && endDay >= startDay;
}

/**
 * #292: event_kind is derived internally from the end-date field, never
 * shown/asked as its own control (the "Art" toggle must not appear in the
 * DOM). Empty end_day or end_day === start_day => 'single'; anything else
 * => 'phase'. Clamped end_day (>= start_day) is the caller's job before
 * calling this — this function only classifies.
 */
export function deriveEventKind(_startDay: number, _endDay: number | undefined): EventKind {
  throw new Error('not implemented');
}

const PARTICIPANT_RELATION = 'event_has_participant';
const PARTICIPANT_INVERSE = 'participant_in';
const LOCATION_RELATION = 'event_at_location';
const LOCATION_INVERSE = 'location_of';

export function EventFormFields({
  database, eventId, kind, startDay, endDay, onKindChange, onEndDayChange, visibility, onVisibilityChange,
  category, onCategoryChange,
}: EventFormFieldsProps) {
  const [entityTitles, setEntityTitles] = useState<Record<string, string>>({});
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  useEffect(() => {
    listEntitiesByType({ database, type: null }).then((rows) => {
      setEntityTitles(Object.fromEntries(rows.map((r) => [r.id, r.title])));
    }).catch(console.error);
  }, [database]);

  useEffect(() => {
    getRelations(database, eventId, { includeInactive: false }).then(setRelations).catch(console.error);
  }, [database, eventId]);

  async function confirmPill(relationType: string, inverseType: string, input: string, clear: () => void) {
    const trimmed = input.trim();
    if (!trimmed) return;
    const rows = await listEntitiesByType({ database, type: null });
    const match = rows.find((r) => r.title.toLowerCase() === trimmed.toLowerCase());
    if (!match) return;
    const { id } = await addRelation(database, {
      source_id: eventId,
      target_id: match.id,
      relation_type: relationType,
      inverse_type: inverseType,
      visibility,
    });
    setRelations((prev) => [...prev, {
      id, source_id: eventId, target_id: match.id, relation_type: relationType,
      inverse_type: inverseType, active: 1, visibility_json: JSON.stringify(visibility), notes: null,
    }]);
    setEntityTitles((prev) => ({ ...prev, [match.id]: match.title }));
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
        <span>Start: Tag {startDay}</span>
        <button type="button" aria-pressed={kind === 'single'} onClick={() => onKindChange('single')}>Single</button>
        <button type="button" aria-pressed={kind === 'phase'} onClick={() => onKindChange('phase')}>Phase</button>
      </div>

      {kind === 'phase' && (
        <input
          type="number"
          role="spinbutton"
          aria-label="Enddatum"
          value={endDay ?? ''}
          onChange={(e) => onEndDayChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )}

      <div className="event-form-fields__pills">
        <input
          type="text"
          aria-label="Teilnehmer"
          placeholder="Teilnehmer"
          value={participantInput}
          onChange={(e) => setParticipantInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirmPill(PARTICIPANT_RELATION, PARTICIPANT_INVERSE, participantInput, () => setParticipantInput(''));
          }}
        />
        {participantPills.map((r) => (
          <span key={r.id} data-pill>
            <span>{entityTitles[r.target_id] ?? r.target_id}</span>
            <button type="button" aria-label="Entfernen" onClick={() => removePill(r.id)}>×</button>
          </span>
        ))}
      </div>

      <div className="event-form-fields__pills">
        <input
          type="text"
          aria-label="Orte"
          placeholder="Orte"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirmPill(LOCATION_RELATION, LOCATION_INVERSE, locationInput, () => setLocationInput(''));
          }}
        />
        {locationPills.map((r) => (
          <span key={r.id} data-pill>
            <span>{entityTitles[r.target_id] ?? r.target_id}</span>
            <button type="button" aria-label="Entfernen" onClick={() => removePill(r.id)}>×</button>
          </span>
        ))}
      </div>

      <select aria-label="Sichtbarkeit" value={visibility} onChange={(e) => onVisibilityChange(e.target.value)}>
        <option value="public">Öffentlich</option>
        <option value="gm_only">Nur SL</option>
      </select>

      <input
        type="text"
        aria-label="Kategorie"
        placeholder="Kategorie"
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
