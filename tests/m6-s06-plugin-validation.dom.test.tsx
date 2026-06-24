// M6-S06: Plugin validation, conflicts & load reporting — plugin manager UI.
// See: https://github.com/Djimon/WorldBrain/issues/96

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/plugin-loader', () => ({
  scanPlugins: vi.fn(),
  getPluginRegistry: vi.fn(() => ({
    'good-plugin': { manifest: { id: 'good-plugin', label: 'Good Plugin', version: '1.0.0', entity_types: ['Dragon'] }, status: 'loaded' },
    'bad-plugin':  { manifest: { id: 'bad-plugin',  label: 'Bad Plugin',  version: '0.5.0', entity_types: [] }, status: 'failed', errors: ['Invalid manifest: missing compatibility field'] },
    'conflict-plugin': { manifest: { id: 'conflict-plugin', label: 'Conflict Plugin', version: '2.0.0', entity_types: ['Dragon'] }, status: 'conflict', errors: ['Conflict: entity type "Dragon" already registered by good-plugin'] },
    'outdated-plugin': { manifest: { id: 'outdated-plugin', label: 'Old Plugin', version: '0.1.0', entity_types: [] }, status: 'outdated' },
  })),
}));

import { PluginManager } from '../src/ui/PluginManager';

describe('M6-S06 plugin validation & load reporting', () => {
  describe('PluginManager rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<PluginManager />)).not.toThrow();
    });

    it('lists all installed plugins', () => {
      render(<PluginManager />);
      expect(screen.getByText('Good Plugin')).toBeInTheDocument();
      expect(screen.getByText('Bad Plugin')).toBeInTheDocument();
      expect(screen.getByText('Conflict Plugin')).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it('loaded plugin shows "loaded" badge', () => {
      render(<PluginManager />);
      expect(screen.getByText(/loaded/i)).toBeInTheDocument();
    });

    it('failed plugin shows "failed" badge', () => {
      render(<PluginManager />);
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });

    it('conflict plugin shows "conflict" badge', () => {
      render(<PluginManager />);
      expect(screen.getByText(/conflict/i)).toBeInTheDocument();
    });

    it('outdated plugin shows "outdated" badge', () => {
      render(<PluginManager />);
      expect(screen.getByText(/outdated/i)).toBeInTheDocument();
    });
  });

  describe('error detail', () => {
    it('failed plugin shows error message', () => {
      render(<PluginManager />);
      expect(screen.getByText(/Invalid manifest|missing compatibility/i)).toBeInTheDocument();
    });

    it('conflict plugin shows conflict message', () => {
      render(<PluginManager />);
      expect(screen.getByText(/conflict.*Dragon|Dragon.*already registered/i)).toBeInTheDocument();
    });
  });

  describe('version display', () => {
    it('shows plugin version', () => {
      render(<PluginManager />);
      expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument();
    });
  });

  describe('contributed types count', () => {
    it('shows number of contributed entity types', () => {
      render(<PluginManager />);
      // good-plugin has 1 entity type (Dragon)
      expect(screen.getByText(/1.*type|1 entity/i)).toBeInTheDocument();
    });
  });

  describe('no crash on bad plugin', () => {
    it('PluginManager renders even with failed plugins', () => {
      expect(() => render(<PluginManager />)).not.toThrow();
      expect(screen.getByText('Good Plugin')).toBeInTheDocument();
    });
  });
});
