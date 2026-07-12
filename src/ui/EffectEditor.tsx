// M14-S12: Effekt-Editor im Event-Formular (#267)
// Manages an Event entity's properties.effects (S09 event-effects-service)
// list: add/remove, with client-side S08 target/verb validation gating
// "hinzufügen" before any addEffect call (Decision — invalid never saved).
//
// Assumption (undocumented in AC, same reasoning as EventFormFields.tsx):
// the day field is a plain counter-day number input, not the full
// CalendarDateInput widget — that needs the active calendar object +
// counter<->date conversion, which is presentation-layer wiring for the
// Implementation Agent, not a behavioral requirement this test file needs
// to pin down.
import { useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { addEffect, listEffects, removeEffect } from '../services/event-effects-service';
import type { EffectInput } from '../services/event-effects-service';
import { listWorldVariables } from '../services/world-state-projection';
import { parseTarget, EFFECT_VERBS } from '../services/effect-vocabulary';
import type { EffectVerb } from '../services/effect-vocabulary';

export interface EffectEditorProps {
  database: DatabaseLike;
  eventId: string;
  startDay: number;
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

export function EffectEditor({ database, eventId, startDay }: EffectEditorProps) {
  const [effects, setEffects] = useState<EffectInput[]>([]);
  const [worldVars, setWorldVars] = useState<string[]>([]);
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

  async function handleAdd() {
    if (!targetValid) return;
    const effect: EffectInput = { day, target, verb, ...(value !== '' ? { value } : {}) };
    await addEffect(database, eventId, effect);
    setEffects((prev) => [...prev, effect]);
    setTarget('');
    setValue('');
  }

  async function handleRemove(index: number) {
    await removeEffect(database, eventId, index);
    setEffects((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="effect-editor">
      <ul>
        {effects.map((e, index) => (
          <li key={index}>
            <span>{e.target} · {e.verb} · Tag {e.day}</span>
            <button type="button" onClick={() => handleRemove(index)}>Entfernen</button>
          </li>
        ))}
      </ul>
      <input
        type="number"
        role="spinbutton"
        aria-label="Tag"
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
      />
      <input
        type="text"
        aria-label="Target"
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
      <select aria-label="Verb" value={verb} onChange={(e) => setVerb(e.target.value as EffectVerb)}>
        {EFFECT_VERBS.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <input type="text" aria-label="Wert" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" disabled={!targetValid} onClick={() => void handleAdd()}>Effekt hinzufügen</button>
    </div>
  );
}
