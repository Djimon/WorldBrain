// M6-S09: DM Screen dashboard — configurable panels, 4 source types, multiple screens.
// See: https://github.com/Djimon/WorldBrain/issues/99

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/dm-screen-service', () => ({
  listScreens: vi.fn(() => [
    { id: 'screen-combat', title: 'Combat Screen', layout: { columns: 2 }, panels: [
      { id: 'p1', title: 'Conditions', source: 'rule_table', config: { tag: 'condition' }, display: 'list' },
      { id: 'p2', title: 'Party', source: 'entity_type', config: { entity_type: 'Character' }, display: 'card' },
    ]},
    { id: 'screen-travel', title: 'Travel Screen', layout: { columns: 1 }, panels: [] },
  ]),
  saveScreen: vi.fn(() => ({ id: 'screen-new' })),
  getScreen: vi.fn(() => ({
    id: 'screen-combat', title: 'Combat Screen', layout: { columns: 2 }, panels: [
      { id: 'p1', title: 'Conditions', source: 'rule_table', config: { tag: 'condition' }, display: 'list' },
    ],
  })),
}));

vi.mock('../src/services/rule-import-service', () => ({
  listRuleEntities: vi.fn(() => [
    { id: 'cond-blinded', type: 'condition', title: 'Blinded', reference_summary: 'Cannot see' },
  ]),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(() => [{ id: 'char-ada', type: 'Character', title: 'Ada Thorn' }]),
}));

import { DmScreen } from '../src/ui/DmScreen';
import { DmScreenSelector } from '../src/ui/DmScreen';

const mockDb = {};

describe('M6-S09 DM screen dashboard', () => {
  describe('DmScreenSelector', () => {
    it('renders without throwing', () => {
      expect(() => render(<DmScreenSelector database={mockDb as never} onSelectScreen={vi.fn()} />)).not.toThrow();
    });

    it('shows all saved screens', () => {
      render(<DmScreenSelector database={mockDb as never} onSelectScreen={vi.fn()} />);
      expect(screen.getByText('Combat Screen')).toBeInTheDocument();
      expect(screen.getByText('Travel Screen')).toBeInTheDocument();
    });

    it('clicking a screen calls onSelectScreen with screenId', () => {
      const onSelect = vi.fn();
      render(<DmScreenSelector database={mockDb as never} onSelectScreen={onSelect} />);
      fireEvent.click(screen.getByText('Combat Screen'));
      expect(onSelect).toHaveBeenCalledWith('screen-combat');
    });
  });

  describe('DmScreen panels', () => {
    it('renders panels for the selected screen', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.getByText('Conditions')).toBeInTheDocument();
    });

    it('rule_table panel renders rule entities', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.getByText(/Blinded/i)).toBeInTheDocument();
    });

    it('entity_type panel renders entities of that type', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.getByText(/Ada Thorn/i)).toBeInTheDocument();
    });

    it('panels are read-only (no edit buttons on panel content)', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.queryByRole('button', { name: /edit entity|edit rule/i })).not.toBeInTheDocument();
    });
  });

  describe('panel management', () => {
    it('has Add Panel button', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /add panel/i })).toBeInTheDocument();
    });

    it('panels have remove/delete control', () => {
      render(<DmScreen screenId="screen-combat" database={mockDb as never} />);
      expect(screen.getAllByRole('button', { name: /remove panel|delete panel|×/i }).length).toBeGreaterThan(0);
    });
  });

  describe('multiple screens', () => {
    it('creating a new screen shows name input', () => {
      render(<DmScreenSelector database={mockDb as never} onSelectScreen={vi.fn()} />);
      const newBtn = screen.getByRole('button', { name: /new screen|create screen/i });
      fireEvent.click(newBtn);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
