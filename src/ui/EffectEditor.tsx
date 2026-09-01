// M14-S12: Effect editor in the event form (#267)
// Manages an Event entity's properties.effects (S09 event-effects-service)
// list: add/remove, with client-side S08 target/verb validation gating
// "add" before any addEffect call (Decision — invalid never saved).
//
// #292 follow-up: an optional `calendar` prop renders the day field via the
// real CalendarDateInput widget when a calendar is available; without one,
// falls back to the plain counter-day number input (m14-s12's tests exercise
// that fallback path directly), same pattern as EventFormFields.tsx.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { addEffect, listEffects, removeEffect } from '../services/event-effects-service';
import type { EffectInput } from '../services/event-effects-service';
import { listWorldVariables } from '../services/world-state-projection';
import { parseTarget, EFFECT_VERBS } from '../services/effect-vocabulary';
import type { EffectVerb } from '../services/effect-vocabulary';
import type { CalendarShape } from '../../core_data/calendar-schema';
import { counterToDate, dateToCounter, formatCalendarDate } from '../../core_data/calendar-schema';
import { CalendarDateInput } from './CalendarDateInput';

export interface EffectEditorProps {
  database: DatabaseLike;
  eventId: string;
  startDay: number;
  calendar?: CalendarShape;
}

function isValidTarget(target: string): boolean {
  if (!target) return false;
  try {
    parseTarget(target);
    return true;
  } catch {
    return false;
  }
}

export function EffectEditor({ database, eventId, startDay, calendar }: EffectEditorProps) {
  const { t } = useTranslation('entity');
  const [effects, setEffects] = useState<EffectInput[]>([]);
  const [worldVars, setWorldVars] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState(startDay);
  const [target, setTarget] = useState('');
  const [verb, setVerb] = useState<EffectVerb>(EFFECT_VERBS[0]);
  const [value, setValue] = useState('');

  useEffect(() => {
    listEffects(database, eventId).then((rows) => setEffects(rows as EffectInput[])).catch(console.error);
  }, [database, eventId]);

  useEffect(() => {
    listWorldVariables(database).then(setWorldVars).catch(console.error);
  }, [database]);

  const targetValid = isValidTarget(target);

  function openAddForm() {
    setDay(startDay);
    setTarget('');
    setVerb(EFFECT_VERBS[0]);
    setValue('');
    setAdding(true);
  }

  async function handleAdd() {
    if (!targetValid) return;
    const effect: EffectInput = { day, target, verb, ...(value !== '' ? { value } : {}) };
    await addEffect(database, eventId, effect);
    setEffects((prev) => [...prev, effect]);
    setAdding(false);
  }

  async function handleRemove(index: number) {
    await removeEffect(database, eventId, index);
    setEffects((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="effect-editor">
      <ul className="effect-editor__list">
        {effects.map((e, index) => (
          <li key={index}>
            <span>{e.target} · {e.verb} · {calendar && e.day !== undefined ? formatCalendarDate(calendar, e.day) : t('event.dayCounter', { day: e.day })}</span>
            <button type="button" onClick={() => handleRemove(index)}>{t('remove', { ns: 'common' })}</button>
          </li>
        ))}
        {effects.length === 0 && <li className="effect-editor__empty">{t('effect.empty')}</li>}
      </ul>

      {adding ? (
        <div className="effect-editor__form">
          {calendar ? (
            <CalendarDateInput
              months={calendar.months ?? []}
              value={counterToDate(calendar, day)}
              onChange={(date) => setDay(dateToCounter(calendar, date))}
            />
          ) : (
            <input
              type="number"
              role="spinbutton"
              aria-label={t('effect.day')}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            />
          )}
          <input
            type="text"
            aria-label={t('effect.target')}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          {worldVars.length > 0 && (
            <div className="effect-editor__suggestions">
              {worldVars.map((v) => (
                <button key={v} type="button" onClick={() => setTarget(v)}>{v}</button>
              ))}
            </div>
          )}
          <select aria-label={t('effect.verb')} value={verb} onChange={(e) => setVerb(e.target.value as EffectVerb)}>
            {EFFECT_VERBS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input type="text" aria-label={t('effect.value')} value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="effect-editor__form-actions">
            <button type="button" disabled={!targetValid} onClick={() => void handleAdd()}>{t('effect.add')}</button>
            <button type="button" onClick={() => setAdding(false)}>{t('cancel', { ns: 'common' })}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="effect-editor__add-toggle" onClick={openAddForm}>{t('effect.new')}</button>
      )}
    </div>
  );
}
