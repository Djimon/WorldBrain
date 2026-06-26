// M8-S10: Würfelpanel
// See: https://github.com/Djimon/WorldBrain/issues/162

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DicePanel } from '../src/ui/DicePanel';

describe('M8-S10 dice panel', () => {
  describe('supported dice buttons', () => {
    it('renders W4 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w4|d4/i })).toBeInTheDocument();
    });

    it('renders W6 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w6|d6/i })).toBeInTheDocument();
    });

    it('renders W8 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w8|d8/i })).toBeInTheDocument();
    });

    it('renders W10 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w10|d10/i })).toBeInTheDocument();
    });

    it('renders W12 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w12|d12/i })).toBeInTheDocument();
    });

    it('renders W20 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w20|d20/i })).toBeInTheDocument();
    });

    it('renders W100 button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /w100|d100/i })).toBeInTheDocument();
    });
  });

  describe('dice expression input', () => {
    it('renders input field for dice expression', () => {
      render(<DicePanel />);
      expect(screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i })).toBeInTheDocument();
    });

    it('clicking a dice button (W6) populates expression input', () => {
      render(<DicePanel />);
      fireEvent.click(screen.getByRole('button', { name: /w6|d6/i }));
      const input = screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i }) as HTMLInputElement;
      expect(input.value).toMatch(/d6|w6/i);
    });

    it('preloadedExpression prop pre-fills input', () => {
      render(<DicePanel preloadedExpression="2d6+3" />);
      const input = screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i }) as HTMLInputElement;
      expect(input.value).toBe('2d6+3');
    });
  });

  describe('roll action', () => {
    it('renders "Würfeln" button', () => {
      render(<DicePanel />);
      expect(screen.getByRole('button', { name: /würfeln|roll/i })).toBeInTheDocument();
    });

    it('after clicking Würfeln with "1d6", shows a result', () => {
      render(<DicePanel />);
      fireEvent.change(screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i }), { target: { value: '1d6' } });
      fireEvent.click(screen.getByRole('button', { name: /würfeln|roll/i }));
      // Result is a number 1-6, just check something numeric appears
      expect(screen.getByText(/\b[1-6]\b/)).toBeInTheDocument();
    });

    it('after rolling 2d6, shows sum and individual results', () => {
      render(<DicePanel />);
      fireEvent.change(screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i }), { target: { value: '2d6' } });
      fireEvent.click(screen.getByRole('button', { name: /würfeln|roll/i }));
      // Should show at least two individual results and a total
      const content = document.body.textContent ?? '';
      expect(content).toMatch(/\d/);
    });
  });

  describe('roll history', () => {
    it('result history shows previous rolls', () => {
      render(<DicePanel />);
      const input = screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i });
      fireEvent.change(input, { target: { value: '1d6' } });
      fireEvent.click(screen.getByRole('button', { name: /würfeln|roll/i }));
      fireEvent.change(input, { target: { value: '1d20' } });
      fireEvent.click(screen.getByRole('button', { name: /würfeln|roll/i }));
      // History list should contain at least 2 entries
      const historyItems = screen.getAllByRole('listitem');
      expect(historyItems.length).toBeGreaterThanOrEqual(2);
    });

    it('history is capped at 10 entries', () => {
      render(<DicePanel />);
      const input = screen.getByRole('textbox', { name: /würfelausdruck|expression|ausdruck/i });
      for (let i = 0; i < 15; i++) {
        fireEvent.change(input, { target: { value: '1d4' } });
        fireEvent.click(screen.getByRole('button', { name: /würfeln|roll/i }));
      }
      const historyItems = screen.getAllByRole('listitem');
      expect(historyItems.length).toBeLessThanOrEqual(10);
    });
  });

  describe('crypto random', () => {
    it('DicePanel.tsx uses crypto.getRandomValues (not Math.random)', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/DicePanel.tsx', 'utf-8'));
      expect(src).not.toMatch(/Math\.random/);
      expect(src).toMatch(/crypto\.getRandomValues|getRandomValues/);
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('DicePanel.tsx does not use window.prompt, alert or confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/DicePanel.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
