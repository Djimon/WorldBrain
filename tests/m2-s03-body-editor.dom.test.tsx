// M2-S03: BodyEditor component — TipTap DOM integration.
// Tests that BodyEditor renders and emits block-JSON changes.
// See: https://github.com/Djimon/WorldBrain/issues/24

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BodyEditor } from '../src/ui/BodyEditor';

const emptyDoc = { format: 'portable_blocks_v1' as const, blocks: [] };

describe('M2-S03 BodyEditor component', () => {
  it('renders an editable content area', () => {
    render(<BodyEditor initialBlocks={emptyDoc} onChange={vi.fn()} />);

    const editor = screen.getByRole('textbox');

    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  it('renders initial content from portable_blocks_v1 blocks', () => {
    const initialBlocks = {
      format: 'portable_blocks_v1' as const,
      blocks: [{ type: 'paragraph' as const, text: 'Hello world.' }],
    };

    render(<BodyEditor initialBlocks={initialBlocks} onChange={vi.fn()} />);

    expect(screen.getByText('Hello world.')).toBeInTheDocument();
  });

  it('shows a minimal toolbar with Bold, Italic, H1, H2, and list buttons', () => {
    render(<BodyEditor initialBlocks={emptyDoc} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /h1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /h2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();
  });

  it('calls onChange with portable_blocks_v1 output when content changes', async () => {
    const handleChange = vi.fn();
    render(<BodyEditor initialBlocks={emptyDoc} onChange={handleChange} />);

    const editor = screen.getByRole('textbox');
    fireEvent.input(editor, { target: { innerHTML: '<p>New content</p>' } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalled();
      const emittedDoc = handleChange.mock.calls[0][0];
      expect(emittedDoc.format).toBe('portable_blocks_v1');
      expect(Array.isArray(emittedDoc.blocks)).toBe(true);
    });
  });

  it('is a standalone component that does not require an entity context to render', () => {
    expect(() =>
      render(<BodyEditor initialBlocks={emptyDoc} onChange={vi.fn()} />),
    ).not.toThrow();
  });
});
