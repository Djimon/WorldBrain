import { useState } from 'react';
import { listCardInstances, savePrintJob } from '../services/card-service';
import type { DatabaseLike } from '../services/entity-service';

const SLOTS_PER_SHEET = 9;

interface Props {
  database: DatabaseLike;
  initialCards?: string[];
}

export function PrintSheetComposer({ database, initialCards = [] }: Props) {
  const [cards, setCards] = useState<string[]>(initialCards);
  const [cutMarks, setCutMarks] = useState(false);
  const [backside, setBackside] = useState('blank');
  const [page, setPage] = useState(1);

  const availableCards = listCardInstances(database);
  const totalPages = Math.ceil(Math.max(cards.length, 1) / SLOTS_PER_SHEET);
  const currentPageCards = cards.slice((page - 1) * SLOTS_PER_SHEET, page * SLOTS_PER_SHEET);

  function handleAddCard() {
    const next = availableCards.find((c) => !cards.includes(c.id));
    if (next) setCards((prev) => [...prev, next.id]);
  }

  function handleSave() {
    savePrintJob(database, { cards, cutMarks, backside: backside === 'blank' ? null : backside });
  }

  const slots = Array.from({ length: SLOTS_PER_SHEET }, (_, i) => currentPageCards[i] ?? null);

  return (
    <div>
      <div data-testid="sheet-preview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {slots.map((cardId, i) => (
            <div key={i} data-slot={i} style={{ border: '1px solid #ccc', minHeight: '80px' }}>
              {cardId ?? ''}
              {cutMarks && <span data-cut-mark="true" />}
            </div>
          ))}
        </div>
      </div>

      {cards.length > 0 && (
        <ul>
          {cards.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}>
              {i === 0 ? 'Sheet 1' : `Sheet ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div>
        <input
          type="checkbox"
          id="cut-marks"
          aria-label="Cut marks"
          checked={cutMarks}
          onChange={(e) => setCutMarks(e.target.checked)}
        />
        <label htmlFor="cut-marks">Cut marks</label>
      </div>

      <select
        aria-label="Backside"
        value={backside}
        onChange={(e) => setBackside(e.target.value)}
      >
        <option value="blank">Blank</option>
        <option value="logo">Logo</option>
        <option value="category">Category pattern</option>
      </select>

      <button onClick={handleAddCard}>Add Card</button>
      <button onClick={handleSave}>Save Print Job</button>
    </div>
  );
}
