import { useState } from 'react';
import { createEvent } from '../services/event-service';

interface CustomCounter {
  id: string;
  label: string;
  value: number;
}

interface Props {
  sessionId: string;
  database: unknown;
  onEncounterEnd?: () => void;
}

const SECONDS_PER_ROUND = 6;

export function EncounterCounters({ sessionId: _sessionId, database, onEncounterEnd }: Props) {
  const [round, setRound] = useState(1);
  const [counters, setCounters] = useState<CustomCounter[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const elapsedSeconds = (round - 1) * SECONDS_PER_ROUND;

  function handleNextRound() {
    setRound(r => r + 1);
  }

  function handleAddCounter() {
    setShowAdd(true);
    setCounters(prev => [...prev, { id: crypto.randomUUID(), label: newLabel || 'Counter', value: 0 }]);
    setNewLabel('');
  }

  function handleEndEncounter() {
    createEvent(database as never, {
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
    setShowAdd(false);
    onEncounterEnd?.();
  }

  return (
    <div>
      <div>
        <span>Round {round}</span>
        {round > 1 && <span> — Elapsed: {elapsedSeconds}s ({elapsedSeconds}s total)</span>}
        <button aria-label="Next Round" onClick={handleNextRound}>▶</button>
      </div>

      <div>
        {showAdd && (
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Counter name"
          />
        )}
        <button onClick={handleAddCounter}>Add Counter</button>
      </div>

      {counters.map(c => (
        <div key={c.id}>
          <span>{c.label}: {c.value}</span>
        </div>
      ))}

      <button onClick={handleEndEncounter}>End Encounter</button>
    </div>
  );
}
