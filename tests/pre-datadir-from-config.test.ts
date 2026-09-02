// @vitest-environment node
// pre-release follow-up (#406): the user data root must be a SINGLE source of truth.
// Hardcoding `Documents\WorldsAndBeyond` in several services means the displayed path
// and the actually-used path can diverge ("kann überall knallen"). Instead userDataDir()
// resolves from app-config.json (`data_dir`), falling back to the platform default.
// The config file itself always lives in appDataDir (bootstrap) — only the DATA location
// is configurable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readTextFileMock = vi.fn<(p: string) => Promise<string>>();
const writeTextFileMock = vi.fn<(p: string, c: string) => Promise<void>>();

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (p: string) => readTextFileMock(p),
  writeTextFile: (p: string, c: string) => writeTextFileMock(p, c),
  exists: vi.fn(async () => true),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
}));
vi.mock('@tauri-apps/api/path', () => ({
  documentDir: async () => '/docs',
  appDataDir: async () => '/appdata',
  resourceDir: async () => '/res',
  join: async (...parts: string[]) => parts.join('/'),
}));

// eslint-disable-next-line import/first
import { userDataDir, userProjectsDir, userThemesDir, defaultUserDataDir, ensureUserDataDirs } from '../src/services/user-data-dir';

beforeEach(() => { readTextFileMock.mockReset(); writeTextFileMock.mockReset(); });
afterEach(() => vi.clearAllMocks());

describe('#406 follow-up — data dir resolves from config', () => {
  it('uses data_dir from app-config.json when set (all subdirs follow it)', async () => {
    readTextFileMock.mockResolvedValue(JSON.stringify({ data_dir: '/custom/place', projects: [] }));
    expect(await userDataDir()).toBe('/custom/place');
    expect(await userProjectsDir()).toBe('/custom/place/projects');
    expect(await userThemesDir()).toBe('/custom/place/themes');
  });

  it('reads the config from appDataDir\\app-config.json (bootstrap location)', async () => {
    readTextFileMock.mockResolvedValue(JSON.stringify({ data_dir: '/custom', projects: [] }));
    await userDataDir();
    expect(readTextFileMock).toHaveBeenCalledWith('/appdata/app-config.json');
  });

  it('falls back to the platform default (Documents) when config has no data_dir', async () => {
    readTextFileMock.mockResolvedValue(JSON.stringify({ projects: [] }));
    expect(await userDataDir()).toBe('/docs/WorldsAndBeyond');
  });

  it('falls back to the platform default when the config is missing/unparseable', async () => {
    readTextFileMock.mockResolvedValue('{ not valid json');
    expect(await userDataDir()).toBe('/docs/WorldsAndBeyond');
  });

  it('defaultUserDataDir() is the Documents location regardless of config', async () => {
    expect(await defaultUserDataDir()).toBe('/docs/WorldsAndBeyond');
  });
});

describe('#406 follow-up — first run persists the default data_dir', () => {
  it('writes the resolved default into app-config.json when data_dir is unset', async () => {
    readTextFileMock.mockResolvedValue(JSON.stringify({ projects: [] }));
    await ensureUserDataDirs();
    expect(writeTextFileMock).toHaveBeenCalledTimes(1);
    const [path, content] = writeTextFileMock.mock.calls[0];
    expect(path).toBe('/appdata/app-config.json');
    expect(JSON.parse(content).data_dir).toBe('/docs/WorldsAndBeyond');
  });

  it('does NOT overwrite an existing data_dir (never clobbers a user choice)', async () => {
    readTextFileMock.mockResolvedValue(JSON.stringify({ data_dir: '/custom/place', projects: [] }));
    await ensureUserDataDirs();
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });
});
