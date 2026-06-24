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

// Bug #35
describe('issue-35 toolbar active state', () => {
  describe('aria-pressed attribute on toolbar buttons', () => {
    it('Bold button has aria-pressed attribute', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton).toHaveAttribute('aria-pressed');
    });

    it('Italic button has aria-pressed attribute', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const italicButton = screen.getByRole('button', { name: /italic/i });
      expect(italicButton).toHaveAttribute('aria-pressed');
    });

    it('H1 button has aria-pressed attribute', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const h1Button = screen.getByRole('button', { name: /h1|heading 1/i });
      expect(h1Button).toHaveAttribute('aria-pressed');
    });

    it('H2 button has aria-pressed attribute', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const h2Button = screen.getByRole('button', { name: /h2|heading 2/i });
      expect(h2Button).toHaveAttribute('aria-pressed');
    });

    it('List button has aria-pressed attribute', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const listButton = screen.getByRole('button', { name: /list|bullet/i });
      expect(listButton).toHaveAttribute('aria-pressed');
    });
  });

  describe('aria-pressed defaults to false when no formatting is active', () => {
    it('Bold button aria-pressed is "false" in empty document with no selection', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const boldButton = screen.getByRole('button', { name: /bold/i });
      expect(boldButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('Italic button aria-pressed is "false" in empty document', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const italicButton = screen.getByRole('button', { name: /italic/i });
      expect(italicButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('H1 button aria-pressed is "false" in empty document', () => {
      render(<BodyEditor initialContent={emptyDoc} onChange={() => {}} />);

      const h1Button = screen.getByRole('button', { name: /h1|heading 1/i });
      expect(h1Button.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('source-level: editor.isActive() is used for aria-pressed', () => {
    it('BodyEditor.tsx source uses isActive() for aria-pressed', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/BodyEditor.tsx', 'utf-8');
      expect(src).toMatch(/isActive\s*\(/);
      expect(src).toMatch(/aria-pressed/);
    });
  });
});

