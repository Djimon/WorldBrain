type PropertySchema = {
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  items?: { type: 'string' };
  required?: boolean;
  title?: string;
};

type PropertiesSchema = Record<string, PropertySchema>;

import { useState } from 'react';

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
      <div>
        {items.map((item, i) => (
          <span key={i}>
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => handleRemove(i)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        aria-label={`Add ${label}`}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

type PropertiesFormProps = {
  schema: PropertiesSchema;
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
};

export function PropertiesForm({ schema, values, onChange }: PropertiesFormProps) {
  return (
    <div>
      {Object.entries(schema).map(([key, fieldSchema]) => {
        const label = fieldSchema.title ?? key;
        const value = values[key];
        const required = fieldSchema.required ?? false;

        if (fieldSchema.type === 'boolean') {
          return (
            <label key={key} data-required={required || undefined}>
              <input
                type="checkbox"
                aria-label={label}
                checked={Boolean(value)}
                onChange={(e) => onChange({ [key]: e.target.checked })}
              />
              {label}
            </label>
          );
        }

        if (fieldSchema.type === 'string' && fieldSchema.enum) {
          return (
            <label key={key} data-required={required || undefined}>
              {label}
              <select
                aria-label={label}
                value={String(value ?? '')}
                onChange={(e) => onChange({ [key]: e.target.value })}
              >
                {fieldSchema.enum.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          );
        }

        if (fieldSchema.type === 'number') {
          return (
            <label key={key} data-required={required || undefined}>
              {label}
              <input
                type="number"
                aria-label={label}
                value={value as number ?? 0}
                onChange={(e) => onChange({ [key]: e.target.valueAsNumber })}
              />
            </label>
          );
        }

        if (fieldSchema.type === 'array') {
          const items = Array.isArray(value) ? (value as string[]) : [];
          return (
            <TagField
              key={key}
              fieldKey={key}
              label={label}
              required={required}
              items={items}
              onChange={onChange}
            />
          );
        }

        return (
          <label key={key} data-required={required ? 'true' : undefined}>
            {label}
            <input
              type="text"
              aria-label={label}
              value={String(value ?? '')}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
          </label>
        );
      })}
    </div>
  );
}
