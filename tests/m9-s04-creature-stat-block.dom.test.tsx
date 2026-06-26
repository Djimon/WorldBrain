// M9-S04: Creature / Enemy Stat Block Schema & UI
// See: https://github.com/Djimon/WorldBrain/issues/167

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreatureStatBlock } from '../src/ui/CreatureStatBlock';

const MOCK_CREATURE = {
  id: 'goblin-1',
  name: 'Goblin',
  type: 'humanoid',
  ac: 15,
  hp_expression: '2d6',
  speed: '30 ft',
  str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
  saving_throws: [],
  skills: ['Stealth'],
  immunities: [],
  resistances: [],
  senses: 'Darkvision 60 ft',
  languages: ['Common', 'Goblin'],
  cr: '1/4',
  xp: 50,
  traits: 'Nimble Escape: bonus action Disengage or Hide',
  actions: 'Scimitar: +4 to hit, 1d6+2 slashing',
  legendary_actions: '',
  mythic_actions: '',
  lair_actions: '',
  special: '',
  description: 'Small, green-skinned creature',
};

describe('M9-S04 creature stat block', () => {
  describe('required stat block fields', () => {
    it('shows creature name', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/Goblin/i)).toBeInTheDocument();
    });

    it('shows AC', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/15/)).toBeInTheDocument();
      expect(screen.getByText(/AC|Rüstungsklasse/i)).toBeInTheDocument();
    });

    it('shows HP expression', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/2d6/)).toBeInTheDocument();
    });

    it('shows Speed', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/30 ft/i)).toBeInTheDocument();
    });

    it('shows ability scores (STR, DEX, CON, INT, WIS, CHA)', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/STR|Stärke/i)).toBeInTheDocument();
      expect(screen.getByText(/DEX|Geschicklichkeit/i)).toBeInTheDocument();
    });

    it('shows CR and XP', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/1\/4/)).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });

    it('shows Traits section', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/Nimble Escape/i)).toBeInTheDocument();
    });

    it('shows Actions section', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.getByText(/Scimitar/i)).toBeInTheDocument();
    });
  });

  describe('HTML escaping', () => {
    it('HTML-escapes creature description before rendering', () => {
      const xssCreature = { ...MOCK_CREATURE, description: '<script>alert("xss")</script>' };
      render(<CreatureStatBlock creature={xssCreature} inPlayMode={false} />);
      expect(document.querySelector('script')).toBeNull();
      expect(document.body.innerHTML).not.toContain('<script>alert');
    });
  });

  describe('play mode HP tracking', () => {
    it('in play mode, shows current HP tracker (editable)', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={true} sessionId="s1" />);
      expect(screen.getByRole('spinbutton', { name: /aktuell.*hp|current.*hp|hp/i })).toBeInTheDocument();
    });

    it('in create mode, HP tracker is not shown', () => {
      render(<CreatureStatBlock creature={MOCK_CREATURE} inPlayMode={false} />);
      expect(screen.queryByRole('spinbutton', { name: /aktuell.*hp|current.*hp/i })).not.toBeInTheDocument();
    });
  });
});
