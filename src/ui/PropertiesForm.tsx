import { useState, useRef, useEffect } from 'react';

type PropertySchema = {
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  items?: { type: 'string' };
  required?: boolean;
  title?: string;
};

type PropertiesSchema = Record<string, PropertySchema>;

export type EntityMention = { id: string; title: string; type: string };

// ── Mention parsing helpers ───────────────────────────────────────────────────

// Stored format: @[Name](entityId)
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

export function parseMentions(text: string): Array<{ type: 'text' | 'mention'; value: string; id?: string }> {
  const parts: Array<{ type: 'text' | 'mention'; value: string; id?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    if (m.index! > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'mention', value: m[1], id: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

export function mentionDisplayText(text: string): string {
  return text.replace(MENTION_RE, '@$1');
}

// ── MentionChip (read mode) ───────────────────────────────────────────────────

export function MentionText({ text, onNavigate }: { text: string; onNavigate?: (id: string) => void }) {
  const parts = parseMentions(text);
  return (
    <span>
      {parts.map((p, i) =>
        p.type === 'mention' ? (
          <span key={i} className="mention-chip" onClick={() => p.id && onNavigate?.(p.id)}
            title={`→ ${p.value}`}>
            @{p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}

// ── MentionInput (edit mode) ──────────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  entities: EntityMention[];
  placeholder?: string;
}

function MentionInput({ value, onChange, entities, placeholder }: MentionInputProps) {
  // Display raw text with @[Name](id) → shown as @Name for readability
  const displayValue = mentionDisplayText(value);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [atPos, setAtPos] = useState(-1);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rawValue = useRef(value); // tracks the actual stored value with @[Name](id)

  // Keep rawValue in sync when prop changes externally
  useEffect(() => { rawValue.current = value; }, [value]);

  const suggestions = suggestQuery
    ? entities.filter((e) => e.title.toLowerCase().includes(suggestQuery.toLowerCase())).slice(0, 8)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const display = e.target.value;
    const cursor = e.target.selectionStart ?? display.length;

    // Detect @ trigger
    const atIdx = display.lastIndexOf('@', cursor - 1);
    if (atIdx !== -1 && (atIdx === 0 || display[atIdx - 1] === ' ')) {
      const query = display.slice(atIdx + 1, cursor);
      if (!query.includes(' ')) {
        setSuggestQuery(query);
        setAtPos(atIdx);
        setShowSuggest(true);
        setHighlightIdx(0);
        // Sync raw: replace everything before @atIdx with the raw equivalent
        rawValue.current = display;
        onChange(display);
        return;
      }
    }
    setShowSuggest(false);
    rawValue.current = display;
    onChange(display);
  }

  function insertMention(entity: EntityMention) {
    const display = mentionDisplayText(rawValue.current);
    const before = display.slice(0, atPos);
    const after = display.slice(inputRef.current?.selectionStart ?? display.length);
    const newDisplay = `${before}@[${entity.title}](${entity.id})${after} `;
    rawValue.current = newDisplay;
    onChange(newDisplay);
    setShowSuggest(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (suggestions[highlightIdx]) insertMention(suggestions[highlightIdx]); }
    if (e.key === 'Escape') { setShowSuggest(false); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={mentionDisplayText(value)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
        placeholder={placeholder}
      />
      {showSuggest && suggestions.length > 0 && (
        <div className="mention-suggest">
          {suggestions.map((e, i) => (
            <button key={e.id}
              className={`mention-suggest__item${i === highlightIdx ? ' active' : ''}`}
              onMouseDown={(ev) => { ev.preventDefault(); insertMention(e); }}
            >
              <span className="mention-suggest__type">{e.type}</span>
              <span className="mention-suggest__name">{e.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TagField ──────────────────────────────────────────────────────────────────

type TagFieldProps = {
  fieldKey: string;
  label: string;
  required: boolean;
  items: string[];
  onChange: (patch: Record<string, unknown>) => void;
};

function TagField({ fieldKey, label, required, items, onChange }: TagFieldProps) {
  const [inputValue, setInputValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onChange({ [fieldKey]: [...items, trimmed] });
    setInputValue('');
  }

  function handleRemove(index: number) {
    onChange({ [fieldKey]: items.filter((_, i) => i !== index) });
  }

  return (
    <div data-required={required ? 'true' : undefined}>
      <label data-required={required ? 'true' : undefined}>{label}</label>
      <div className="tag-field__chips">
        {items.map((item, i) => (
          <span key={i} className="tag-field__chip">
            {item}
            <button type="button" aria-label={`Remove ${item}`} onClick={() => handleRemove(i)}>×</button>
          </span>
        ))}
      </div>
      <input type="text" aria-label={`Add ${label}`} placeholder="Enter → hinzufügen"
        value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} />
    </div>
  );
}

// ── PropertiesForm ────────────────────────────────────────────────────────────

type PropertiesFormProps = {
  schema: PropertiesSchema;
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  entities?: EntityMention[];
};

export function PropertiesForm({ schema, values, onChange, entities = [] }: PropertiesFormProps) {
  return (
    <div>
      {Object.entries(schema).map(([key, fieldSchema]) => {
        const label = fieldSchema.title ?? key;
        const value = values[key];
        const required = fieldSchema.required ?? false;

        if (fieldSchema.type === 'boolean') {
          return (
            <label key={key} data-required={required || undefined}>
              <input type="checkbox" aria-label={label}
                checked={Boolean(value)}
                onChange={(e) => onChange({ [key]: e.target.checked })} />
              {label}
            </label>
          );
        }

        if (fieldSchema.type === 'string' && fieldSchema.enum) {
          return (
            <label key={key} data-required={required || undefined}>
              {label}
              <select aria-label={label} value={String(value ?? '')}
                onChange={(e) => onChange({ [key]: e.target.value })}>
                {fieldSchema.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </label>
          );
        }

        if (fieldSchema.type === 'number') {
          return (
            <label key={key} data-required={required || undefined}>
              {label}
              <input type="number" aria-label={label}
                value={(value as number) ?? 0}
                onChange={(e) => onChange({ [key]: e.target.valueAsNumber })} />
            </label>
          );
        }

        if (fieldSchema.type === 'array') {
          return (
            <TagField key={key} fieldKey={key} label={label} required={required}
              items={Array.isArray(value) ? (value as string[]) : []}
              onChange={onChange} />
          );
        }

        // Free-text string with @ mention autocomplete
        return (
          <label key={key} data-required={required ? 'true' : undefined}>
            {label}
            <MentionInput
              value={String(value ?? '')}
              onChange={(v) => onChange({ [key]: v })}
              entities={entities}
            />
          </label>
        );
      })}
    </div>
  );
}
