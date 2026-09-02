// @vitest-environment node
// pre-release S4 (#406): user data lives in Documents\WorldsAndBeyond\ (visible,
// user-writable) — NOT the read-only install folder and NOT hidden %AppData%.
// This tests the first-run bootstrap (idempotent dir creation + best-effort theme-tester
// seed) with the Tauri path/fs APIs mocked. Issue #406 / Epic D7.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsMock = vi.fn<(p: string) => Promise<boolean>>();
const mkdirMock = vi.fn<(p: string, o?: unknown) => Promise<void>>();
const copyFileMock = vi.fn<(from: string, to: string) => Promise<void>>();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: (p: string) => existsMock(p),
  mkdir: (p: string, o?: unknown) => mkdirMock(p, o),
  copyFile: (from: string, to: string) => copyFileMock(from, to),
}));
vi.mock('@tauri-apps/api/path', () => ({
  documentDir: async () => '/docs',
  resourceDir: async () => '/res',
  join: async (...parts: string[]) => parts.join('/'),
}));

// eslint-disable-next-line import/first
import { ensureUserDataDirs, userDataDir, userProjectsDir, userThemesDir } from '../src/services/user-data-dir';

beforeEach(() => {
  existsMock.mockReset();
  mkdirMock.mockReset();
  copyFileMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('#406 — user data dir location', () => {
  it('resolves under Documents (documentDir), not %AppData% / Program Files', async () => {
    expect(await userDataDir()).toBe('/docs/WorldsAndBeyond');
    expect(await userProjectsDir()).toBe('/docs/WorldsAndBeyond/projects');
    expect(await userThemesDir()).toBe('/docs/WorldsAndBeyond/themes');
  });

  it('no path targets the install folder / Program Files (AC4)', async () => {
    for (const p of [await userDataDir(), await userProjectsDir(), await userThemesDir()]) {
      expect(p).not.toMatch(/Program Files/i);
      expect(p).not.toMatch(/AppData/i);
      expect(p.startsWith('/docs/')).toBe(true);
    }
  });
});

describe('#406 — ensureUserDataDirs first-run bootstrap', () => {
  it('creates projects/plugins/themes when they do not exist', async () => {
    existsMock.mockResolvedValue(false); // nothing exists yet
    await ensureUserDataDirs();
    const made = mkdirMock.mock.calls.map((c) => c[0]);
    expect(made).toContain('/docs/WorldsAndBeyond/projects');
    expect(made).toContain('/docs/WorldsAndBeyond/plugins');
    expect(made).toContain('/docs/WorldsAndBeyond/themes');
    for (const call of mkdirMock.mock.calls) {
      expect(call[1]).toEqual({ recursive: true });
    }
  });

  it('is idempotent — does not re-create existing dirs', async () => {
    existsMock.mockResolvedValue(true); // everything already there
    await ensureUserDataDirs();
    expect(mkdirMock).not.toHaveBeenCalled();
    expect(copyFileMock).not.toHaveBeenCalled(); // theme-tester dest exists → no overwrite
  });

  it('seeds theme-tester.html only when the dest is missing and the resource exists', async () => {
    // dirs missing, theme-tester dest missing, resource present
    existsMock.mockImplementation(async (p: string) => p === '/res/theme-tester.html');
    await ensureUserDataDirs();
    expect(copyFileMock).toHaveBeenCalledWith(
      '/res/theme-tester.html',
      '/docs/WorldsAndBeyond/themes/theme-tester.html',
    );
  });

  it('does not overwrite an existing theme-tester copy', async () => {
    // dest exists (true), so copy is skipped regardless of resource
    existsMock.mockImplementation(async (p: string) => p === '/docs/WorldsAndBeyond/themes/theme-tester.html');
    await ensureUserDataDirs();
    expect(copyFileMock).not.toHaveBeenCalled();
  });
});
