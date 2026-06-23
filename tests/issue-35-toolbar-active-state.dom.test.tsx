// M2 polish: BodyEditor toolbar buttons must reflect active formatting state via aria-pressed.
// See: https://github.com/Djimon/WorldBrain/issues/35

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyEditor } from '../src/ui/BodyEditor';

const emptyDoc = { format: 'portable_blocks_v1' as const, blocks: [] };

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
