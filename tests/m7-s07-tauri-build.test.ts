// M7-S07: Tauri Build & Auto-Updater
// See: https://github.com/Djimon/WorldBrain/issues/140

import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('M7-S07 tauri build & auto-updater', () => {
  describe('package.json build:desktop script', () => {
    it('package.json has build:desktop script', () => {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(pkg.scripts).toHaveProperty('build:desktop');
    });

    it('build:desktop script invokes tauri build', () => {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(pkg.scripts['build:desktop']).toMatch(/tauri build/i);
    });
  });

  describe('tauri.conf.json auto-updater', () => {
    it('tauri.conf.json exists', () => {
      expect(() => readFileSync('src-tauri/tauri.conf.json', 'utf-8')).not.toThrow();
    });

    it('tauri.conf.json has updater configuration', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.tauri?.updater ?? conf?.plugins?.updater ?? conf?.updater;
      expect(updater).toBeTruthy();
    });

    it('updater.active is true', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.tauri?.updater ?? conf?.plugins?.updater ?? conf?.updater;
      expect(updater?.active).toBe(true);
    });

    it('updater has endpoints configured (placeholder is acceptable)', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.tauri?.updater ?? conf?.plugins?.updater ?? conf?.updater;
      expect(updater?.endpoints ?? updater?.endpoint).toBeTruthy();
    });
  });

  describe('update UI', () => {
    it('UpdateNotification component exists', () => {
      expect(() => readFileSync('src/ui/UpdateNotification.tsx', 'utf-8')).not.toThrow();
    });

    it('UpdateNotification has a dismiss/close button', async () => {
      const src = readFileSync('src/ui/UpdateNotification.tsx', 'utf-8');
      expect(src).toMatch(/schließen|dismiss|close|später|later/i);
    });

    it('update check does not auto-download without user confirmation', () => {
      const src = readFileSync('src/ui/UpdateNotification.tsx', 'utf-8');
      // Must have an explicit install/download button — no auto-call to installUpdate without user action
      expect(src).toMatch(/installieren|install|herunterladen|download/i);
      // Should not auto-trigger install on mount (no installUpdate in useEffect without user gesture)
      expect(src).not.toMatch(/useEffect[^}]+installUpdate/s);
    });
  });
});
