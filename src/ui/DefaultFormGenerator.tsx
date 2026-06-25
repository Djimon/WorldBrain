import { useState } from 'react';

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  items?: JsonSchema;
}

interface UiSchema {
  [field: string]: { 'ui:widget'?: string };
}

interface Props {
  schema: JsonSchema;
  uiSchema?: UiSchema;
  onChange: (values: Record<string, unknown>) => void;
  initialValues?: Record<string, unknown>;
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldControl({
  name, schema, uiWidget, required, value, onChange,
}: {
  name: string;
  schema: JsonSchema;
  uiWidget?: string;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = humanize(name);

  if (uiWidget === 'textarea') {
    return (
      <div>
        <label>{label}{required && <span aria-hidden="true"> *</span>}</label>
        <textarea
          aria-required={required}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (schema.enum) {
    return (
      <div>
        <label>{label}{required && ' *'}</label>
        <select
          aria-required={required}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" />
          {schema.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  if (schema.type === 'boolean') {
    return (
      <div>
        <label>
          <input
            type="checkbox"
            aria-required={required}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {label}
        </label>
      </div>
    );
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return (
      <div>
        <label>{label}{required && ' *'}</label>
        <input
          type="number"
          aria-required={required}
          value={value !== undefined ? Number(value) : ''}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
      </div>
    );
  }

  if (schema.type === 'array') {
    return (
      <div>
        <label>{label}{required && ' *'}</label>
        <input
          type="text"
          aria-required={required}
          placeholder="Comma-separated values"
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        />
      </div>
    );
  }

  if (schema.type === 'object' && schema.properties) {
    return (
      <fieldset>
        <legend>{label}</legend>
        {Object.entries(schema.properties).map(([k, s]) => (
          <FieldControl
            key={k} name={k} schema={s} required={false}
            value={(value as Record<string, unknown>)?.[k]}
            onChange={(v) => onChange({ ...(value as Record<string, unknown>), [k]: v })}
          />
        ))}
      </fieldset>
    );
  }

  return (
    <div>
      <label>{label}{required && <span> *</span>}</label>
      <input
        type="text"
        aria-required={required}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function DefaultFormGenerator({ schema, uiSchema, onChange, initialValues }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  function handleChange(field: string, value: unknown) {
    const next = { ...values, [field]: value };
    setValues(next);
    onChange(next);
  }

  return (
    <form>
      {Object.entries(properties).map(([name, fieldSchema]) => (
        <FieldControl
          key={name}
          name={name}
          schema={fieldSchema}
          uiWidget={uiSchema?.[name]?.['ui:widget']}
          required={required.has(name)}
          value={values[name]}
          onChange={(v) => handleChange(name, v)}
        />
      ))}
    </form>
  );
}
