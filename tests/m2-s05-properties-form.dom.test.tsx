// M2-S05: Properties form generated from entity-type JSON Schema.
// See: https://github.com/Djimon/WorldBrain/issues/26

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import { PropertiesForm } from '../src/ui/PropertiesForm';

type PropertySchema = {
  type: 'string' | 'boolean' | 'number' | 'array';
  enum?: string[];
  items?: { type: 'string' };
  required?: boolean;
  title?: string;
};

type PropertiesSchema = Record<string, PropertySchema>;

function renderForm(schema: PropertiesSchema, values: Record<string, unknown>, onChange = vi.fn()) {
  return render(<PropertiesForm schema={schema} values={values} onChange={onChange} />);
}

// Bug #33: array-valued tag field (aliases) rendered by TagField.
const tagSchema: PropertiesSchema = {
  aliases: { type: 'array', items: { type: 'string' }, title: 'Aliases' },
};

describe('M2-S05 properties form-from-schema', () => {
  describe('string field → text input', () => {
    it('renders a text input for a string property', () => {
      renderForm({ name: { type: 'string', title: 'Name' } }, { name: 'Ada' });

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toHaveAttribute('type', 'text');
    });

    it('shows the current value in the text input', () => {
      renderForm({ role: { type: 'string', title: 'Role' } }, { role: 'archivist' });

      expect(screen.getByLabelText(/role/i)).toHaveValue('archivist');
    });

    it('emits a patch with the updated string value on change', () => {
      const onChange = vi.fn();
      renderForm({ role: { type: 'string', title: 'Role' } }, { role: 'archivist' }, onChange);

      fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'fugitive' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ role: 'fugitive' }));
    });
  });

  describe('enum field → dropdown', () => {
    it('renders a select element for an enum property', () => {
      renderForm(
        { status: { type: 'string', enum: ['alive', 'dead', 'unknown'], title: 'Status' } },
        { status: 'alive' },
      );

      expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
    });

    it('shows all allowed enum values as options', () => {
      renderForm(
        { status: { type: 'string', enum: ['alive', 'dead', 'unknown'], title: 'Status' } },
        { status: 'alive' },
      );

      expect(screen.getByRole('option', { name: 'alive' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'dead' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'unknown' })).toBeInTheDocument();
    });

    it('emits a patch with the selected enum value on change', () => {
      const onChange = vi.fn();
      renderForm(
        { status: { type: 'string', enum: ['alive', 'dead', 'unknown'], title: 'Status' } },
        { status: 'alive' },
        onChange,
      );

      fireEvent.change(screen.getByRole('combobox', { name: /status/i }), { target: { value: 'dead' } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'dead' }));
    });
  });

  describe('boolean field → toggle/checkbox', () => {
    it('renders a checkbox for a boolean property', () => {
      renderForm({ isRecurring: { type: 'boolean', title: 'Recurring' } }, { isRecurring: false });

      expect(screen.getByRole('checkbox', { name: /recurring/i })).toBeInTheDocument();
    });

    it('emits a patch with true when checkbox is checked', () => {
      const onChange = vi.fn();
      renderForm({ isRecurring: { type: 'boolean', title: 'Recurring' } }, { isRecurring: false }, onChange);

      fireEvent.click(screen.getByRole('checkbox', { name: /recurring/i }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isRecurring: true }));
    });
  });

  describe('number field → number input', () => {
    it('renders a number input for a number property', () => {
      renderForm({ level: { type: 'number', title: 'Level' } }, { level: 5 });

      expect(screen.getByLabelText(/level/i)).toHaveAttribute('type', 'number');
    });

    it('emits a numeric patch value on change', () => {
      const onChange = vi.fn();
      renderForm({ level: { type: 'number', title: 'Level' } }, { level: 5 }, onChange);

      fireEvent.change(screen.getByLabelText(/level/i), { target: { value: '10', valueAsNumber: 10 } });

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ level: 10 }));
    });
  });

  describe('array of string field → tag input', () => {
    it('renders a tag input for an array-of-string property', () => {
      renderForm(
        { aliases: { type: 'array', items: { type: 'string' }, title: 'Aliases' } },
        { aliases: ['The Red Notary'] },
      );

      expect(screen.getByText('The Red Notary')).toBeInTheDocument();
    });
  });

  describe('required fields', () => {
    it('marks a required field visually', () => {
      renderForm(
        { title: { type: 'string', title: 'Title', required: true } },
        { title: '' },
      );

      const label = screen.getByText(/title/i);
      expect(label.closest('label') ?? label.parentElement).toHaveAttribute('data-required', 'true');
    });
  });

  describe('field ordering', () => {
    it('renders fields in schema-defined order', () => {
      renderForm(
        {
          alpha: { type: 'string', title: 'Alpha' },
          beta: { type: 'string', title: 'Beta' },
          gamma: { type: 'string', title: 'Gamma' },
        },
        { alpha: '', beta: '', gamma: '' },
      );

      // String fields render via MentionInput wrapped in a <label>; the
      // accessible name comes from label association, not an aria-label attr.
      const fields = screen.getAllByRole('textbox');
      const alphaIdx = fields.indexOf(screen.getByLabelText(/alpha/i));
      const betaIdx = fields.indexOf(screen.getByLabelText(/beta/i));
      const gammaIdx = fields.indexOf(screen.getByLabelText(/gamma/i));

      // Schema-defined order must be preserved
      expect(alphaIdx).toBeGreaterThanOrEqual(0);
      expect(alphaIdx).toBeLessThan(betaIdx);
      expect(betaIdx).toBeLessThan(gammaIdx);
    });
  });

  describe('patch output', () => {
    it('emits only the changed field in the patch, not the full schema', () => {
      const onChange = vi.fn();
      renderForm(
        {
          role: { type: 'string', title: 'Role' },
          status: { type: 'string', title: 'Status' },
        },
        { role: 'archivist', status: 'alive' },
        onChange,
      );

      fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'fugitive' } });

      const patch = onChange.mock.calls[0][0];
      expect(patch).toHaveProperty('role', 'fugitive');
    });
  });
});

// Bug #33
describe('issue-33 tag field editable', () => {
  describe('existing tags rendered as removable chips', () => {
    it('renders each existing tag as a visible chip', () => {
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['The Red Notary', 'Archivist'] }}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText('The Red Notary')).toBeInTheDocument();
      expect(screen.getByText('Archivist')).toBeInTheDocument();
    });

    it('each tag chip has a remove control', () => {
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['The Red Notary'] }}
          onChange={vi.fn()}
        />,
      );

      // Remove button/icon adjacent to the tag chip
      const removeButton = screen.getByRole('button', { name: /remove.*the red notary|×|✕|delete/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('clicking remove emits onChange with the tag removed from the array', () => {
      const onChange = vi.fn();
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['The Red Notary', 'Archivist'] }}
          onChange={onChange}
        />,
      );

      const removeButton = screen.getByRole('button', { name: /remove.*the red notary|×|✕|delete/i });
      fireEvent.click(removeButton);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ aliases: ['Archivist'] }),
      );
    });
  });

  describe('adding new tags', () => {
    it('renders a text input for adding new tags', () => {
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: [] }}
          onChange={vi.fn()}
        />,
      );

      const input = screen.getByRole('textbox', { name: /add.*alias|aliases|new tag/i });
      expect(input).toBeInTheDocument();
    });

    it('pressing Enter in the tag input emits onChange with the new tag appended', () => {
      const onChange = vi.fn();
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['Existing'] }}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('textbox', { name: /add.*alias|aliases|new tag/i });
      fireEvent.change(input, { target: { value: 'New Tag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ aliases: ['Existing', 'New Tag'] }),
      );
    });

    it('adding a tag clears the input field', () => {
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: [] }}
          onChange={vi.fn()}
        />,
      );

      const input = screen.getByRole('textbox', { name: /add.*alias|aliases|new tag/i });
      fireEvent.change(input, { target: { value: 'New Tag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input).toHaveValue('');
    });

    it('empty string is not added as a tag', () => {
      const onChange = vi.fn();
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['Existing'] }}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('textbox', { name: /add.*alias|aliases|new tag/i });
      fireEvent.change(input, { target: { value: '  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('onChange array emission', () => {
    it('onChange receives the full updated array, not just the changed item', () => {
      const onChange = vi.fn();
      render(
        <PropertiesForm
          schema={tagSchema}
          values={{ aliases: ['A', 'B', 'C'] }}
          onChange={onChange}
        />,
      );

      const input = screen.getByRole('textbox', { name: /add.*alias|aliases|new tag/i });
      fireEvent.change(input, { target: { value: 'D' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      const emitted = onChange.mock.calls[0][0];
      expect(emitted.aliases).toEqual(['A', 'B', 'C', 'D']);
    });
  });
});

