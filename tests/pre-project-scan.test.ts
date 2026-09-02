// @vitest-environment node
// pre-release follow-up: project discovery must be filesystem-driven, not only registry.
// The user wants to drop a foreign project folder into <data_dir>\projects and have the
// app pick it up on start. scanProjects() reads project.json from each subfolder;
// reconcileProjects() merges the scan into app-config.json (fresh scan wins → adds drops
// and heals moved paths; entries whose folder is gone are pruned).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSet = new Set<string>();
const files = new Map<string, string>();
const dirents = new Map<string, { name: string; isDirectory: boolean }[]>();
const writeTextFileMock = vi.fn<(p: string, c: string) => Promise<void>>();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (p: string) => existsSet.has(p),
  readDir: async (p: string) => dirents.get(p) ?? [],
  readTextFile: async (p: string) => {
    const c = files.get(p);
    if (c === undefined) throw new Error(`ENOENT ${p}`);
    return c;
  },
  writeTextFile: (p: string, c: string) => writeTextFileMock(p, c),
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/'),
  appDataDir: async () => '/appdata',
  documentDir: async () => '/docs',
}));

// eslint-disable-next-line import/first
import { scanProjects, reconcileProjects } from '../src/services/project-discovery';

const PROJECTS = '/docs/WAB/projects';
const CONFIG = '/appdata/app-config.json';

function projectFolder(name: string, meta: { id: string; title?: string }) {
  existsSet.add(`${PROJECTS}/${name}`);
  existsSet.add(`${PROJECTS}/${name}/project.json`);
  files.set(`${PROJECTS}/${name}/project.json`, JSON.stringify(meta));
}

beforeEach(() => {
  existsSet.clear();
  files.clear();
  dirents.clear();
  writeTextFileMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe('scanProjects — read projects from the folder', () => {
  it('returns an entry per subfolder that has a valid project.json', async () => {
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [
      { name: 'test', isDirectory: true },
      { name: 'faerun', isDirectory: true },
    ]);
    projectFolder('test', { id: 'p-test', title: 'Test' });
    projectFolder('faerun', { id: 'p-faerun', title: 'Faerûn' });

    const found = await scanProjects(PROJECTS);
    expect(found).toEqual([
      { id: 'p-test', title: 'Test', path: `${PROJECTS}/test` },
      { id: 'p-faerun', title: 'Faerûn', path: `${PROJECTS}/faerun` },
    ]);
  });

  it('skips non-directories, folders without project.json, and unreadable/id-less meta', async () => {
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [
      { name: 'readme.txt', isDirectory: false },
      { name: 'empty', isDirectory: true },
      { name: 'broken', isDirectory: true },
      { name: 'noid', isDirectory: true },
      { name: 'good', isDirectory: true },
    ]);
    // empty: no project.json at all
    existsSet.add(`${PROJECTS}/empty`);
    // broken: has project.json but invalid JSON
    existsSet.add(`${PROJECTS}/broken`);
    existsSet.add(`${PROJECTS}/broken/project.json`);
    files.set(`${PROJECTS}/broken/project.json`, '{ not json');
    // noid: valid JSON but no id
    projectFolder('noid', { id: '' });
    files.set(`${PROJECTS}/noid/project.json`, JSON.stringify({ title: 'No Id' }));
    // good: valid
    projectFolder('good', { id: 'p-good', title: 'Good' });

    const found = await scanProjects(PROJECTS);
    expect(found).toEqual([{ id: 'p-good', title: 'Good', path: `${PROJECTS}/good` }]);
  });

  it('returns [] when the projects folder does not exist', async () => {
    expect(await scanProjects(PROJECTS)).toEqual([]);
  });
});

describe('reconcileProjects — merge the scan into the registry', () => {
  it('adds a newly dropped-in project and persists it', async () => {
    files.set(CONFIG, JSON.stringify({ last_opened_project_id: null, projects: [], data_dir: '/docs/WAB' }));
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [{ name: 'dropped', isDirectory: true }]);
    projectFolder('dropped', { id: 'p-drop', title: 'Dropped In' });

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toContainEqual({ id: 'p-drop', title: 'Dropped In', path: `${PROJECTS}/dropped` });
    expect(writeTextFileMock).toHaveBeenCalledTimes(1);
    const [, content] = writeTextFileMock.mock.calls[0];
    expect(JSON.parse(content).projects).toContainEqual({ id: 'p-drop', title: 'Dropped In', path: `${PROJECTS}/dropped` });
  });

  it('heals a moved project: registry path (gone) is replaced by the scanned path', async () => {
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: 'p-test',
      projects: [{ id: 'p-test', title: 'Test', path: '/appdata/old/test' }],
      data_dir: '/docs/WAB',
    }));
    // old path does NOT exist (moved); scan finds it in the new location
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [{ name: 'test', isDirectory: true }]);
    projectFolder('test', { id: 'p-test', title: 'Test' });

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toEqual([{ id: 'p-test', title: 'Test', path: `${PROJECTS}/test` }]);
    expect(cfg.last_opened_project_id).toBe('p-test');
  });

  it('keeps a registry entry outside data_dir whose folder still exists', async () => {
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: null,
      projects: [{ id: 'p-ext', title: 'External', path: '/somewhere/else/ext' }],
      data_dir: '/docs/WAB',
    }));
    existsSet.add('/somewhere/else/ext'); // still on disk
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, []);

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toEqual([{ id: 'p-ext', title: 'External', path: '/somewhere/else/ext' }]);
  });

  it('prunes a registry entry whose folder is verifiably gone and is not rediscovered', async () => {
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: 'p-dead',
      projects: [{ id: 'p-dead', title: 'Dead', path: '/appdata/old/dead' }],
      data_dir: '/docs/WAB',
    }));
    // /appdata/old/dead is NOT in existsSet → exists() returns false → pruned
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, []);

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toEqual([]);
    // last_opened is left as-is on purpose → welcome screen shows the "missing" hint
    expect(cfg.last_opened_project_id).toBe('p-dead');
  });

  it('drops a stale registry entry that points at a folder the scan claims for another id', async () => {
    // Real folder on disk belongs to p-real ("Test Welt"); a stale entry p-ghost ("Test")
    // points at the SAME path with a different id → must be pruned (no path duplicates).
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: null,
      projects: [
        { id: 'p-ghost', title: 'Test', path: `${PROJECTS}/test` },
        { id: 'p-real', title: 'Test Welt', path: `${PROJECTS}/test` },
      ],
      data_dir: '/docs/WAB',
    }));
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [{ name: 'test', isDirectory: true }]);
    projectFolder('test', { id: 'p-real', title: 'Test Welt' });

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toEqual([{ id: 'p-real', title: 'Test Welt', path: `${PROJECTS}/test` }]);
  });

  it('does not keep two registry entries for the same folder (path is unique)', async () => {
    // Same path, two ids, and NO scan (folder not under data_dir scan) → still only one wins.
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: null,
      projects: [
        { id: 'p-a', title: 'A', path: '/ext/shared' },
        { id: 'p-b', title: 'B', path: '/ext/shared' },
      ],
      data_dir: '/docs/WAB',
    }));
    existsSet.add('/ext/shared');
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, []);

    const cfg = await reconcileProjects(CONFIG, PROJECTS);
    expect(cfg.projects).toEqual([{ id: 'p-a', title: 'A', path: '/ext/shared' }]);
  });

  it('does not rewrite the config when nothing changed', async () => {
    files.set(CONFIG, JSON.stringify({
      last_opened_project_id: 'p-test',
      projects: [{ id: 'p-test', title: 'Test', path: `${PROJECTS}/test` }],
      data_dir: '/docs/WAB',
    }));
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [{ name: 'test', isDirectory: true }]);
    projectFolder('test', { id: 'p-test', title: 'Test' });

    await reconcileProjects(CONFIG, PROJECTS);
    expect(writeTextFileMock).not.toHaveBeenCalled();
  });
});
