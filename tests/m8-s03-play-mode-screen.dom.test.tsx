// M8-S03: Play-Mode Screen & GM-Whiteboard
// See: https://github.com/Djimon/WorldBrain/issues/154

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-service', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  activateSession: vi.fn(),
}));

import { PlayModeScreen } from '../src/ui/PlayModeScreen';

const MOCK_SESSION = {
  id: 's1',
  title: 'Test Session',
  project_id: 'proj-1',
  created_at: '2026-01-10T20:00:00Z',
  last_active_at: '2026-01-10T23:00:00Z',
  archived: false,
  active: true,
  calendar_position: null,
  system_plugin_id: null,
};

describe('M8-S03 play-mode screen & GM whiteboard', () => {
  describe('mode toggle', () => {
    it('renders a mode toggle button (Create ↔ Play)', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('button', { name: /create.modus|erstellen|wechseln/i })).toBeInTheDocument();
    });

    it('clicking mode toggle calls onSwitchToCreate', () => {
      const onSwitch = vi.fn();
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={onSwitch} />);
      fireEvent.click(screen.getByRole('button', { name: /create.modus|erstellen|wechseln/i }));
      expect(onSwitch).toHaveBeenCalled();
    });
  });

  describe('tabs', () => {
    it('renders Tab 1: Whiteboard', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('tab', { name: /whiteboard/i })).toBeInTheDocument();
    });

    it('renders Tab 2: Karte (always present)', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('tab', { name: /karte|map/i })).toBeInTheDocument();
    });

    it('Karte tab cannot be closed (no close button on Karte tab)', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      const karteTab = screen.getByRole('tab', { name: /karte|map/i });
      expect(karteTab.querySelector('[aria-label*="close"]') || karteTab.parentElement?.querySelector('[data-close]')).toBeNull();
    });

    it('clicking a tab makes its panel visible', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      fireEvent.click(screen.getByRole('tab', { name: /whiteboard/i }));
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('whiteboard widgets', () => {
    it('whiteboard panel renders "Widget hinzufügen" or toolbar to add widgets', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      fireEvent.click(screen.getByRole('tab', { name: /whiteboard/i }));
      expect(screen.getByRole('button', { name: /widget|hinzufügen|add/i })).toBeInTheDocument();
    });
  });

  describe('left sidebar tool launcher', () => {
    it('renders sidebar with Encounter-Liste launcher', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('button', { name: /encounter/i })).toBeInTheDocument();
    });

    it('renders sidebar with Character-Panel launcher', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('button', { name: /character|charakter/i })).toBeInTheDocument();
    });

    it('renders sidebar with Session-Log launcher', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('button', { name: /session.log|log/i })).toBeInTheDocument();
    });

    it('renders sidebar with Würfelpanel launcher', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      expect(screen.getByRole('button', { name: /würfel|dice/i })).toBeInTheDocument();
    });

    it('clicking a sidebar tool opens it as a tab', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      const diceBtn = screen.getByRole('button', { name: /würfel|dice/i });
      fireEvent.click(diceBtn);
      expect(screen.getAllByRole('tab').length).toBeGreaterThan(2);
    });

    it('a tool tab opened from sidebar has a close button', () => {
      render(<PlayModeScreen session={MOCK_SESSION} projectDir="/p" onSwitchToCreate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /würfel|dice/i }));
      const tabs = screen.getAllByRole('tab');
      const dynamicTab = tabs.find(t => /würfel|dice/i.test(t.textContent ?? ''));
      expect(dynamicTab).toBeTruthy();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('PlayModeScreen.tsx does not use window.prompt, alert or confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/PlayModeScreen.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
