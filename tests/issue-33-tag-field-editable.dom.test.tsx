// M2 gap: array/tag fields in PropertiesForm must be editable, not display-only.
// See: https://github.com/Djimon/WorldBrain/issues/33

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertiesForm } from '../src/ui/PropertiesForm';

const tagSchema = {
  aliases: { type: 'array' as const, items: { type: 'string' as const }, title: 'Aliases' },
};

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
