// Token: Status-Chip-Editor mit Icon-Picker — Grid-Popover (#300)
// See: https://github.com/Djimon/WorldBrain/issues/300
//
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored queries; getAllBy*/within where icon keys could
// collide across groups.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconPicker } from '../src/ui/IconPicker';

const CORE_SET = { id: 'core', label: 'Core', icons: [{ key: 'poisoned', label: 'Poisoned', glyph: '☠' }, { key: 'asleep', label: 'Asleep', glyph: '💤' }] };
const PLUGIN_SET = { id: 'dnd_conditions', label: 'D&D Conditions', icons: [{ key: 'prone', label: 'Prone', glyph: '⬇' }] };

vi.mock('../src/services/icon-set-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/icon-set-registry')>();
  return { ...actual, listIconSets: vi.fn(() => [CORE_SET, PLUGIN_SET]) };
});

describe('#300 IconPicker (grid popover)', () => {
  it('renders a group separator per registered set, "Core" first', () => {
    render(<IconPicker value={null} onSelect={vi.fn()} />);
    const groups = screen.getAllByRole('heading');
    expect(groups.map((g) => g.textContent)).toEqual(['Core', 'D&D Conditions']);
  });

  it('renders every icon of every group', () => {
    render(<IconPicker value={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^poisoned$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^asleep$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^prone$/i })).toBeInTheDocument();
  });

  it('clicking an icon calls onSelect with "set_id:icon_key"', () => {
    const onSelect = vi.fn();
    render(<IconPicker value={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /^poisoned$/i }));
    expect(onSelect).toHaveBeenCalledWith('core:poisoned');
  });

  it('renders jump-anchor tabs for each group (scroll-to-group)', () => {
    render(<IconPicker value={null} onSelect={vi.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: /^core$/i })).toBeInTheDocument();
    expect(within(tablist).getByRole('tab', { name: /^d&d conditions$/i })).toBeInTheDocument();
  });

  it('the currently selected icon (value) is marked as pressed', () => {
    render(<IconPicker value="core:asleep" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^asleep$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^poisoned$/i })).toHaveAttribute('aria-pressed', 'false');
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('IconPicker.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/IconPicker.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
