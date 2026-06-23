type PropertySchema = {
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  items?: { type: 'string' };
  required?: boolean;
  title?: string;
};

type PropertiesSchema = Record<string, PropertySchema>;

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
            <div key={key} data-required={required || undefined}>
              <label data-required={required ? 'true' : undefined}>{label}</label>
              <div>
                {items.map((item, i) => (
                  <span key={i}>{item}</span>
                ))}
              </div>
            </div>
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
