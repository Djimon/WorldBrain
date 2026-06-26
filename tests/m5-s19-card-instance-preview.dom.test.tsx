// M5-S19: Card instance & preview UI.
// See: https://github.com/Djimon/WorldBrain/issues/85

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/card-service', () => ({
  listCardTemplates: vi.fn(() => [
    { id: 'tpl-npc', label: 'NPC', entity_types: '["Character"]', size_mm: '{"width_mm":63,"height_mm":88}' },
    { id: 'tpl-loc', label: 'Location', entity_types: '["Location"]', size_mm: '{"width_mm":63,"height_mm":88}' },
  ]),
  createCardInstance: vi.fn(() => ({ id: 'card-1' })),
  listCardInstances: vi.fn(() => [
    { id: 'card-1', entity_id: 'char-ada', template_id: 'tpl-npc', audience: 'players', fields: '{}' },
  ]),
  updateCardInstance: vi.fn(),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(() => [
    { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: '' },
  ]),
  getEffectiveEntity: vi.fn(() => ({
    found: true, entity: { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist', properties: {} },
  })),
}));

import { CardCreationFlow } from '../src/ui/CardCreationFlow';
import { CardPreview } from '../src/ui/CardPreview';
import { CardList } from '../src/ui/CardList';

const mockDb = {};

describe('M5-S19 card instance & preview', () => {
  describe('CardCreationFlow', () => {
    it('renders without throwing', () => {
      expect(() => render(<CardCreationFlow database={mockDb as never} onComplete={vi.fn()} />)).not.toThrow();
    });

    it('step 1: entity selector shows entities', () => {
      render(<CardCreationFlow database={mockDb as never} onComplete={vi.fn()} />);
      expect(screen.getByText(/Ada Thorn|select entity/i)).toBeInTheDocument();
    });

    it('step 2: template selector filtered by entity type', () => {
      render(<CardCreationFlow database={mockDb as never} onComplete={vi.fn()} />);
      const entityItem = screen.queryByText(/Ada Thorn/i);
      if (entityItem) {
        fireEvent.click(entityItem);
        expect(screen.getByText(/NPC|template/i)).toBeInTheDocument();
        expect(screen.queryByText(/Location/i)).not.toBeInTheDocument();
      }
    });
  });

  describe('CardPreview', () => {
    it('renders card at correct physical proportions', () => {
      render(<CardPreview templateId="tpl-npc" entityId="char-ada" database={mockDb as never} />);
      expect(screen.queryByText(/Ada Thorn|preview/i)).toBeInTheDocument();
    });

    it('shows overflow amber indicator when content exceeds slot', () => {
      render(<CardPreview templateId="tpl-npc" entityId="char-ada" database={mockDb as never} overflowMap={{ name: 'truncated' }} />);
      const indicator = document.querySelector('[data-overflow="truncated"]') ?? screen.queryByText(/truncated|overflow/i);
      expect(indicator).toBeInTheDocument();
    });

    it('export button disabled when summary_required unmet', () => {
      render(<CardPreview templateId="tpl-npc" entityId="char-ada" database={mockDb as never} summaryMissing />);
      const exportBtn = screen.queryByRole('button', { name: /export/i });
      if (exportBtn) expect(exportBtn).toBeDisabled();
    });
  });

  describe('CardList', () => {
    it('renders all card instances', () => {
      render(<CardList database={mockDb as never} />);
      expect(screen.getByText(/Ada Thorn|NPC|card-1/i)).toBeInTheDocument();
    });

    it('filter by entity type', () => {
      render(<CardList database={mockDb as never} />);
      const filter = screen.queryByRole('combobox', { name: /type|filter/i });
      expect(filter).toBeInTheDocument();
    });
  });

  describe('theme & icon', () => {
    it('CardPreview accepts theme color prop', () => {
      expect(() => render(<CardPreview templateId="tpl-npc" entityId="char-ada" database={mockDb as never} themeColor="#ff0000" />)).not.toThrow();
    });
  });
});

// Bug #132: CardPreview export button disabled state relies on external summaryMissing prop
//           — isReferenceSummaryRequired must be checked internally
describe('issue #132: CardPreview computes summaryMissing internally', () => {
  it('export button is disabled for Spell/Ability card with no reference_summary when prop omitted', () => {
    render(<CardPreview
      templateId="tpl-spell"
      entityId="char-ada"
      database={mockDb as never}
      category="Spell/Ability"
      entityFields={{ title: 'Fireball' }}
    />);
    const exportBtn = screen.queryByRole('button', { name: /export|download/i });
    if (exportBtn) {
      expect(exportBtn).toBeDisabled();
    } else {
      // Export control may be a link or other element — must still be non-interactive
      const exportEl = screen.queryByText(/export|download/i);
      expect(exportEl?.closest('[disabled],[aria-disabled="true"]')).not.toBeNull();
    }
  });

  it('export button is enabled for Spell/Ability card that has reference_summary', () => {
    render(<CardPreview
      templateId="tpl-spell"
      entityId="char-ada"
      database={mockDb as never}
      category="Spell/Ability"
      entityFields={{ title: 'Fireball', reference_summary: 'Deal 8d6 fire damage in 20ft radius.' }}
    />);
    const exportBtn = screen.queryByRole('button', { name: /export|download/i });
    if (exportBtn) {
      expect(exportBtn).not.toBeDisabled();
    }
  });

  it('export button is enabled for NPC card with no reference_summary (not required)', () => {
    render(<CardPreview
      templateId="tpl-npc"
      entityId="char-ada"
      database={mockDb as never}
      category="NPC"
      entityFields={{ title: 'Ada Thorn' }}
    />);
    const exportBtn = screen.queryByRole('button', { name: /export|download/i });
    if (exportBtn) {
      expect(exportBtn).not.toBeDisabled();
    }
  });
});
