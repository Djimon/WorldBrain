// M4-S09: In-app player screen (presentation mode) — second Tauri window, live projection.
// See: https://github.com/Djimon/WorldBrain/issues/57

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerScreenLauncher } from '../src/ui/PlayerScreen';

// Mock Tauri window API — not available in test environment
vi.mock('@tauri-apps/api/window', () => ({
  WebviewWindow: vi.fn().mockImplementation(() => ({
    once: vi.fn(),
    listen: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
  })),
  getCurrent: vi.fn(() => ({ emit: vi.fn(), listen: vi.fn() })),
}));

vi.mock('../src/services/visibility-service', () => ({
  resolveVisibility: vi.fn((item: { visibility: string }) => {
    if (item.visibility === 'gm_only') return 'hidden';
    return 'visible';
  }),
}));

vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => ({
    found: true, entityId,
    entity: {
      id: entityId, type: 'Character', title: 'Ada Thorn', summary: 'Archivist.',
      aliases: [], properties: {},
      body: { format: 'portable_blocks_v1', blocks: [
        { type: 'paragraph', text: 'Public content.', visibility: 'public' },
        { type: 'paragraph', text: 'GM secret.', visibility: 'gm_only' },
      ]},
      visibility: 'public', created_at: '', updated_at: '',
    },
    baseEntity: null, overriddenFields: [], orphanedOverrideCount: 0,
  })),
}));

import { PlayerScreen } from '../src/ui/PlayerScreen';

const playerContext = { audience: 'player' as const, vars: {}, globals: {}, flags: {}, knownEntities: new Set<string>() };

describe('M4-S09 in-app player screen', () => {
  describe('PlayerScreen component', () => {
    it('renders without throwing', () => {
      expect(() => render(<PlayerScreen context={playerContext} />)).not.toThrow();
    });

    it('renders in read-only mode — no editor toolbar', () => {
      render(<PlayerScreen context={playerContext} entityId="char-ada" />);
      expect(screen.queryByRole('button', { name: /bold/i })).not.toBeInTheDocument();
    });

    it('renders in read-only mode — no edit controls', () => {
      render(<PlayerScreen context={playerContext} entityId="char-ada" />);
      expect(screen.queryByRole('button', { name: /edit|save/i })).not.toBeInTheDocument();
    });
  });

  describe('visibility projection', () => {
    it('shows public content', () => {
      render(<PlayerScreen context={playerContext} entityId="char-ada" />);
      expect(screen.getByText('Public content.')).toBeInTheDocument();
    });

    it('hides gm_only content from player screen', () => {
      render(<PlayerScreen context={playerContext} entityId="char-ada" />);
      expect(screen.queryByText('GM secret.')).not.toBeInTheDocument();
    });
  });

  describe('GM main window controls', () => {
    it('GM main window has a "Open Player Screen" button', () => {
      render(<PlayerScreenLauncher />);
      expect(screen.getByRole('button', { name: /open player screen|presentation/i })).toBeInTheDocument();
    });

    it('clicking Open Player Screen calls Tauri window API', async () => {
      const { WebviewWindow } = await import('@tauri-apps/api/window');
      render(<PlayerScreenLauncher />);

      fireEvent.click(screen.getByRole('button', { name: /open player screen|presentation/i }));

      expect(WebviewWindow).toHaveBeenCalled();
    });
  });

  describe('live updates', () => {
    it('PlayerScreen accepts an onReveal callback for GM-triggered reveals', () => {
      expect(() => render(<PlayerScreen context={playerContext} onReveal={vi.fn()} />)).not.toThrow();
    });

    it('PlayerScreen accepts an entityId prop for GM navigation', () => {
      expect(() => render(<PlayerScreen context={playerContext} entityId="char-ada" />)).not.toThrow();
    });
  });
});
