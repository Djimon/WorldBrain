import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addLogEntry } from '../services/session-log-service';
import type { DatabaseLike } from '../services/entity-service';

interface Encounter {
  id: string;
  title: string;
  type: string;
  linked_location: string | null;
  group: string | null;
}

interface EncounterModeProps {
  database: DatabaseLike;
  sessionId: string;
  encounters: Encounter[];
  onEncounterEnd: () => void;
}

const UNGROUPED = '__ungrouped__';

export function EncounterMode({ database, sessionId, encounters, onEncounterEnd }: EncounterModeProps) {
  const { t } = useTranslation('session');
  const [locationFilter, setLocationFilter] = useState('');
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  const filtered = encounters.filter((enc) => {
    if (!locationFilter) return true;
    return (enc.linked_location ?? '').toLowerCase().includes(locationFilter.toLowerCase());
  });

  const groups = new Map<string, Encounter[]>();
  for (const enc of filtered) {
    const key = enc.group ?? UNGROUPED;
    const list = groups.get(key) ?? [];
    list.push(enc);
    groups.set(key, list);
  }

  function handleStart(enc: Encounter): void {
    setActiveEncounter(enc);
  }

  function handleEnd(): void {
    if (!activeEncounter) return;
    void addLogEntry(database, {
      session_id: sessionId,
      real_timestamp: new Date().toISOString(),
      world_datetime: '',
      round: null,
      action_type: 'encounter',
      description: `${t('encounter.ended', 'Encounter beendet')}: ${activeEncounter.title}`,
      entity_id: null,
    });
    setActiveEncounter(null);
    onEncounterEnd();
  }

  if (activeEncounter) {
    return (
      <div className="encounter-mode__active">
        <h3>{activeEncounter.title}</h3>
        <button className="btn" onClick={handleEnd}>
          {t('encounter.end', 'Encounter beenden')}
        </button>
      </div>
    );
  }

  return (
    <div className="encounter-mode">
      <input
        type="text"
        aria-label={t('encounter.filterLocation', 'Ort filtern')}
        placeholder={t('encounter.filterLocation', 'Ort filtern')}
        value={locationFilter}
        onChange={(e) => setLocationFilter(e.target.value)}
      />

      {[...groups.entries()].map(([group, list]) => (
        <section key={group} className="encounter-mode__group">
          {group !== UNGROUPED && <h4>{group}</h4>}
          <ul>
            {list.map((enc) => (
              <li key={enc.id}>
                <span>{enc.title}</span>
                <button className="btn" onClick={() => handleStart(enc)}>
                  {t('encounter.start', 'Encounter starten')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
