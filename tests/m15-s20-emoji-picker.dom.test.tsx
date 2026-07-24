// M15-S20: zentrale, wiederverwendbare Emoji-Picker-Komponente (#310)
// See: https://github.com/Djimon/WorldBrain/issues/310
//
// Design entschieden (Interview 2026-07-22):
// D-A Datenquelle = emojibase-data (reines JSON, offline, kein UI).
// D-B UI-Muster = Kategorie-Reiter + Grid, analog IconPicker.tsx (#300).
// D-C Suche ist Pflicht (nicht optional) bei ~1900 Emojis.
// D-D Einsatz V1 = nur ClipEditor, Komponente selbst strikt audio-frei.
//
// AP-005: ESM import only, no require(). AP-008 (RTL): Emoji-/Kategorie-
// Buttons sind vielfach vorhanden — Queries innerhalb der Komponente
// scopen/anankern statt bare getBy*.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmojiPicker } from '../src/ui/EmojiPicker';

function renderPicker(overrides: Partial<Parameters<typeof EmojiPicker>[0]> = {}) {
  return render(<EmojiPicker value={null} onSelect={vi.fn()} {...overrides} />);
}

describe('#310 EmojiPicker (grid popover, volle emojibase-data-Bibliothek)', () => {
  it('renders far more than the old hardcoded 12-emoji set (AC 2/4)', () => {
    renderPicker();
    const grid = document.querySelector('.emoji-picker__groups') as HTMLElement;
    const emojiButtons = within(grid).getAllByRole('button');
    expect(emojiButtons.length).toBeGreaterThan(500);
  });

  it('renders a category-tab jump-anchor per emojibase-data group (D-B, analog IconPicker)', () => {
    renderPicker();
    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    // emojibase-data messages.json has 10 groups (smileys-emotion .. flags);
    // "component" (skin-tone modifiers) may reasonably be excluded from a
    // free-standing emoji grid, so allow 9 or 10.
    expect(tabs.length).toBeGreaterThanOrEqual(9);
  });

  it('renders each category as a labelled group section in the grid (D-B)', () => {
    renderPicker();
    const groups = document.querySelectorAll('.emoji-picker__group');
    expect(groups.length).toBeGreaterThanOrEqual(9);
    for (const group of Array.from(groups)) {
      expect(group.querySelector('h3, [role="heading"]')).toBeTruthy();
    }
  });

  it('a search field is present and required, not a nice-to-have (D-C)', () => {
    renderPicker();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('typing a search term drastically reduces the visible emoji grid (D-C)', () => {
    renderPicker();
    const grid = document.querySelector('.emoji-picker__groups') as HTMLElement;
    const before = within(grid).getAllByRole('button').length;
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grinning' } });
    const after = within(grid).getAllByRole('button').length;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before / 10);
  });

  it('an empty/no-match search shows zero results, not the full grid (search actually filters)', () => {
    renderPicker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyznonexistentquery' } });
    const grid = document.querySelector('.emoji-picker__groups') as HTMLElement;
    expect(within(grid).queryAllByRole('button')).toHaveLength(0);
  });

  it('clicking an emoji calls onSelect with the raw emoji character (AC 5)', () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grinning face' } });
    const grid = document.querySelector('.emoji-picker__groups') as HTMLElement;
    fireEvent.click(within(grid).getByRole('button', { name: /grinning face/i }));
    expect(onSelect).toHaveBeenCalledWith('😀');
  });

  it('the currently selected emoji (value) is marked as pressed', () => {
    renderPicker({ value: '😀' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grinning face' } });
    const grid = document.querySelector('.emoji-picker__groups') as HTMLElement;
    expect(within(grid).getByRole('button', { name: /grinning face/i })).toHaveAttribute('aria-pressed', 'true');
  });

  describe('AC 1/3: component is audio-free and reusable (source scan)', () => {
    it('EmojiPicker.tsx contains no audio-specific imports/logic', () => {
      const src = readFileSync('src/ui/EmojiPicker.tsx', 'utf-8');
      expect(src).not.toMatch(/audio-service|ClipEditor|SceneSwitcher/);
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('EmojiPicker.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/EmojiPicker.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});

describe('#310 ClipEditor consumes EmojiPicker instead of the hardcoded EMOJI_CHOICES array', () => {
  it('ClipEditor.tsx no longer hardcodes an EMOJI_CHOICES array', () => {
    const src = readFileSync('src/ui/ClipEditor.tsx', 'utf-8');
    expect(src).not.toMatch(/EMOJI_CHOICES/);
  });

  it('ClipEditor.tsx imports and mounts EmojiPicker', () => {
    const src = readFileSync('src/ui/ClipEditor.tsx', 'utf-8');
    expect(src).toMatch(/EmojiPicker/);
  });
});
