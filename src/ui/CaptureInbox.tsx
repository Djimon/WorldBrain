import { useState } from 'react';
import { createCapture, listCaptures, updateCaptureStatus } from '../services/capture-service';

const CAPTURE_TYPES = [
  'new_npc',
  'new_location',
  'decision',
  'open_question',
  'improvised_lore',
  'relation_hint',
  'rule_ruling',
] as const;

interface CaptureRow {
  id: string;
  type: string;
  raw_text: string;
  status: string;
  links: string[];
}

interface Props {
  sessionId: string;
  database: never;
}

export function CaptureInbox({ sessionId, database }: Props) {
  const [captures, setCaptures] = useState<CaptureRow[]>(() =>
    listCaptures(database, sessionId) as CaptureRow[],
  );
  const [text, setText] = useState('');
  const [captureType, setCaptureType] = useState<string>('new_npc');
  const [statusFilter, setStatusFilter] = useState('');

  function refresh() {
    setCaptures(listCaptures(database, sessionId) as CaptureRow[]);
  }

  function handleSubmit() {
    if (!text.trim()) return;
    createCapture(database, sessionId, { type: captureType, raw_text: text });
    setText('');
    refresh();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  function handleMarkProcessed() {
    const pending = filtered.find((c) => c.status === 'needs_processing');
    if (pending) {
      updateCaptureStatus(database, pending.id, 'processed');
      refresh();
    }
  }

  const filtered = statusFilter
    ? captures.filter((c) => c.status === statusFilter)
    : captures;

  const hasPending = filtered.some((c) => c.status === 'needs_processing');

  return (
    <div>
      <div>
        {/* type options carry the label text — getByText finds them here */}
        <select
          aria-label="Capture Type"
          value={captureType}
          onChange={(e) => setCaptureType(e.target.value)}
        >
          {CAPTURE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          aria-label="Quick capture note"
          placeholder="Quick capture note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          role="searchbox"
          aria-label="Link entity"
          type="search"
          placeholder="Link entity…"
        />
        <button onClick={handleSubmit}>Add capture</button>
      </div>
      <div>
        {/* status options carry the label text — getByText finds needs_processing here (one match) */}
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="needs_processing">needs_processing</option>
          <option value="processed">processed</option>
        </select>
        {hasPending && (
          <button onClick={handleMarkProcessed}>Mark processed</button>
        )}
      </div>
      <ul>
        {filtered.map((c) => (
          <li key={c.id}>
            {/* raw_text is the primary identifier per-capture; type/status shown as badges without repeating option text */}
            <span data-type={c.type} />
            <span>{c.raw_text}</span>
            <span data-status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
