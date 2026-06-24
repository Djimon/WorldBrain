// M6-S03: Default form generator — auto-generate form from JSON Schema, no UI Schema required.
// See: https://github.com/Djimon/WorldBrain/issues/93

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DefaultFormGenerator } from '../src/ui/DefaultFormGenerator';

const stringSchema = {
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
};

const allTypesSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    count: { type: 'number' },
    active: { type: 'boolean' },
    category: { type: 'string', enum: ['A', 'B', 'C'] },
    tags: { type: 'array', items: { type: 'string' } },
    metadata: { type: 'object', properties: { key: { type: 'string' } } },
  },
};

describe('M6-S03 default form generator', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<DefaultFormGenerator schema={stringSchema} onChange={vi.fn()} />)).not.toThrow();
    });

    it('renders a text input for string property', () => {
      render(<DefaultFormGenerator schema={stringSchema} onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('type mappings', () => {
    it('string → text input', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { label: { type: 'string' } } }} onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('number → number input', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { count: { type: 'number' } } }} onChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('boolean → checkbox or toggle', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { active: { type: 'boolean' } } }} onChange={vi.fn()} />);
      const toggle = screen.queryByRole('checkbox') ?? screen.queryByRole('switch');
      expect(toggle).toBeInTheDocument();
    });

    it('enum → select', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { category: { type: 'string', enum: ['A', 'B', 'C'] } } }} onChange={vi.fn()} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('array of string → multi-select or tag input', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } }} onChange={vi.fn()} />);
      const multi = screen.queryByRole('listbox') ?? screen.queryByRole('textbox');
      expect(multi).toBeInTheDocument();
    });

    it('object → grouped section', () => {
      render(<DefaultFormGenerator schema={{ type: 'object', properties: { metadata: { type: 'object', properties: { key: { type: 'string' } } } } }} onChange={vi.fn()} />);
      const section = document.querySelector('fieldset') ?? screen.queryByRole('group');
      expect(section).toBeInTheDocument();
    });
  });

  describe('required fields', () => {
    it('required field is marked visually', () => {
      render(<DefaultFormGenerator schema={stringSchema} onChange={vi.fn()} />);
      const required = document.querySelector('[aria-required="true"]') ?? screen.queryByText(/\*/);
      expect(required).toBeInTheDocument();
    });
  });

  describe('onChange', () => {
    it('typing in text field calls onChange with updated value', () => {
      const onChange = vi.fn();
      render(<DefaultFormGenerator schema={stringSchema} onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hello' }));
    });
  });

  describe('UI Schema override', () => {
    it('when uiSchema provided, it overrides default layout', () => {
      const uiSchema = { name: { 'ui:widget': 'textarea' } };
      render(<DefaultFormGenerator schema={stringSchema} uiSchema={uiSchema} onChange={vi.fn()} />);
      expect(screen.getByRole('textbox').tagName.toLowerCase()).toBe('textarea');
    });
  });
});
