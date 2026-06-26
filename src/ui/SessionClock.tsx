import { useState, useEffect } from 'react';
import { formatAbsoluteDay } from '../services/calendar-service';
import { listVars, setGlobalVar } from '../services/session-variable-service';
import type { DatabaseLike } from '../services/entity-service';

interface Calendar {
  id: string;
  title: string;
  year_length_days: number;
  months: unknown[];
  week: string[];
}

interface VarRow {
  id: string;
  type: string;
  label: string;
  value: unknown;
  default_value: unknown;
}

interface Props {
  sessionId: string;
  calendar: Calendar;
  worldTimeStart: number;
  database: DatabaseLike;
  onWorldTimeChange?: (day: number) => void;
}

export function SessionClock({ sessionId: _sessionId, calendar: _calendar, worldTimeStart, database, onWorldTimeChange }: Props) {
  const [worldTime, setWorldTime] = useState(worldTimeStart);
  const [vars, setVars] = useState<VarRow[]>([]);

  useEffect(() => {
    listVars(database, _sessionId).then(rows => setVars(rows as VarRow[]));
  }, [database, _sessionId]);

  const counters = vars.filter(v => v.type === 'number');

  function handleAdvance() {
    const next = worldTime + 1;
    setWorldTime(next);
    onWorldTimeChange?.(next);
  }

  async function handleIncrement(v: VarRow) {
    const next = Number(v.value) + 1;
    await setGlobalVar(database, v.id, next);
    setVars(prev => prev.map(x => x.id === v.id ? { ...x, value: next } : x));
  }

  async function handleDecrement(v: VarRow) {
    const next = Number(v.value) - 1;
    await setGlobalVar(database, v.id, next);
    setVars(prev => prev.map(x => x.id === v.id ? { ...x, value: next } : x));
  }

  return (
    <div>
      <div>
        <span>{formatAbsoluteDay(worldTime)}</span>
        <button onClick={handleAdvance}>Advance Day Forward</button>
      </div>
      <div>
        <h3>Global Counters</h3>
        {counters.map(v => (
          <div key={v.id}>
            <span>{v.label}</span>
            <button aria-label="decrement" onClick={() => void handleDecrement(v)}>-</button>
            <span>{String(v.value)}</span>
            <button aria-label="increment" onClick={() => void handleIncrement(v)}>+</button>
          </div>
        ))}
      </div>
    </div>
  );
}
