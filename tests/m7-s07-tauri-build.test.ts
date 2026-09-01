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

    // #400: Der Auto-Updater wurde beim Abschluss von #140 auf nach 0.1-Beta
    // verschoben (nicht ausgeliefert) — er braucht Signing-Keys + einen Release-
    // Endpoint, die es noch nicht gibt. Zusätzlich sind diese drei Assertions
    // Tauri-v1-geformt (`updater.active` existiert in Tauri v2 nicht mehr; die
    // Config läge unter `plugins.updater` mit `pubkey`/`endpoints`). Sie bleiben
    // als PENDING markiert (kein grün-frisieren, kein False-Fail), bis der Updater
    // real gebaut wird — dann für Tauri v2 neu formulieren.
    it.skip('tauri.conf.json has updater configuration (deferred post-0.1-beta, #140)', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.tauri?.updater ?? conf?.plugins?.updater ?? conf?.updater;
      expect(updater).toBeTruthy();
    });

    it.skip('updater is enabled (Tauri-v2 shape, deferred, #140)', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.plugins?.updater;
      expect(updater).toBeTruthy();
    });

    it.skip('updater has endpoints configured (deferred, #140)', () => {
      const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
      const updater = conf?.plugins?.updater ?? conf?.updater;
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
