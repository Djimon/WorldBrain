import { useState } from 'react';
import { createEvent } from '../services/event-service';
import type { DatabaseLike } from '../services/entity-service';

interface CustomCounter {
  id: string;
  label: string;
  value: number;
}

interface Props {
  sessionId: string;
  database: DatabaseLike;
  onEncounterEnd?: () => void;
}

const SECONDS_PER_ROUND = 6;

export function EncounterCounters({ sessionId: _sessionId, database, onEncounterEnd }: Props) {
  const [round, setRound] = useState(1);
  const [counters, setCounters] = useState<CustomCounter[]>([]);
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const elapsedSeconds = (round - 1) * SECONDS_PER_ROUND;

  function handleNextRound() {
    setRound(r => r + 1);
  }

  function handleAddCounter() {
    const id = crypto.randomUUID();
    setCounters(prev => [...prev, { id, label: 'Counter', value: 0 }]);
    setPendingId(id);
    setPendingLabel('');
  }

  function handleLabelKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && pendingId) {
      const label = pendingLabel.trim() || 'Counter';
      setCounters(prev => prev.map(c => c.id === pendingId ? { ...c, label } : c));
      setPendingLabel('');
      setPendingId(null);
    }
  }

  function handleIncrement(id: string) {
    setCounters(prev => prev.map(c => c.id === id ? { ...c, value: c.value + 1 } : c));
  }

  function handleDecrement(id: string) {
    setCounters(prev => prev.map(c => c.id === id ? { ...c, value: c.value - 1 } : c));
  }

  function handleEndEncounter() {
    createEvent(database, {
      title: `Encounter — ${round} rounds (${elapsedSeconds + SECONDS_PER_ROUND}s)`,
      type: 'session_event',
      start_day: 0,
      precision: 'day',
      visibility: 'public',
      participants: [],
      locations: [],
    });
    setRound(1);
    setCounters([]);
    setPendingId(null);
    setPendingLabel('');
    onEncounterEnd?.();
  }

  return (
    <div>
      <div>
        <span>Round {round}</span>
        {round > 1 && <span> — Elapsed: {elapsedSeconds}s ({round * SECONDS_PER_ROUND}s total)</span>}
        <button aria-label="Next Round" onClick={handleNextRound}>▶</button>
      </div>

      <div>
        {pendingId !== null && (
          <input
            type="text"
            value={pendingLabel}
            onChange={e => setPendingLabel(e.target.value)}
            onKeyDown={handleLabelKeyDown}
            aria-label="Counter name"
            placeholder="Counter name"
          />
        )}
        <button onClick={handleAddCounter}>Add Counter</button>
      </div>

      {counters.map(c => (
        <div key={c.id} data-counter={c.id}>
          <span>{c.label}: <span data-counter-value>{c.value}</span></span>
          <button aria-label="decrement" onClick={() => handleDecrement(c.id)}>−</button>
          <button aria-label="increment" onClick={() => handleIncrement(c.id)}>+</button>
        </div>
      ))}

      <button onClick={handleEndEncounter}>End Encounter</button>
    </div>
  );
}
