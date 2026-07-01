import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listCardInstances, savePrintJob } from '../services/card-service';
import type { CardInstanceRow } from '../services/card-service';
import type { DatabaseLike } from '../services/entity-service';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildPrintHtml(cardIds: string[]): string {
  const csp = 'Content-Security-Policy';
  const cards = cardIds.map((id) => `<div class="card">${escapeHtml(id)}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta http-equiv="${csp}" content="default-src 'none'"></head><body>${cards}</body></html>`;
}

const SLOTS_PER_SHEET = 9;

interface Props {
  database: DatabaseLike;
  initialCards?: string[];
}

export function PrintSheetComposer({ database, initialCards = [] }: Props) {
  const { t } = useTranslation('common');
  const [cards, setCards] = useState<string[]>(initialCards);
  const [cutMarks, setCutMarks] = useState(false);
  const [backside, setBackside] = useState('blank');
  const [page, setPage] = useState(1);
  const [availableCards, setAvailableCards] = useState<CardInstanceRow[]>([]);

  useEffect(() => {
    listCardInstances(database).then(setAvailableCards).catch(console.error);
  }, [database]);

  const totalPages = Math.ceil(Math.max(cards.length, 1) / SLOTS_PER_SHEET);
  const currentPageCards = cards.slice((page - 1) * SLOTS_PER_SHEET, page * SLOTS_PER_SHEET);

  function handleAddCard() {
    const next = availableCards.find((c) => !cards.includes(c.id));
    if (next) setCards((prev) => [...prev, next.id]);
  }

  async function handleSave() {
    await savePrintJob(database, { cards, cutMarks, backside: backside === 'blank' ? null : backside });
    void buildPrintHtml(cards);
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

      <button onClick={handleAddCard}>{t('add')}</button>
      <button onClick={() => void handleSave()}>{t('save')}</button>
    </div>
  );
}
