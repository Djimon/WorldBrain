// @vitest-environment node
// pre-release follow-up: project discovery is filesystem-driven, not registry-based. The
// user drops a project folder into <data_dir>\projects and the app picks it up. scanProjects()
// reads project.json from each subfolder; findProjectById() locates one by id via that scan.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const existsSet = new Set<string>();
const files = new Map<string, string>();
const dirents = new Map<string, { name: string; isDirectory: boolean }[]>();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (p: string) => existsSet.has(p),
  readDir: async (p: string) => dirents.get(p) ?? [],
  readTextFile: async (p: string) => {
    const c = files.get(p);
    if (c === undefined) throw new Error(`ENOENT ${p}`);
    return c;
  },
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.join('/'),
  appDataDir: async () => '/appdata',
  documentDir: async () => '/docs',
}));

// eslint-disable-next-line import/first
import { scanProjects, findProjectById } from '../src/services/project-discovery';

const PROJECTS = '/docs/WAB/projects';

function projectFolder(name: string, meta: { id: string; title?: string }) {
  existsSet.add(`${PROJECTS}/${name}`);
  existsSet.add(`${PROJECTS}/${name}/project.json`);
  files.set(`${PROJECTS}/${name}/project.json`, JSON.stringify(meta));
}

beforeEach(() => {
  existsSet.clear();
  files.clear();
  dirents.clear();
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
    existsSet.add(`${PROJECTS}/empty`);
    existsSet.add(`${PROJECTS}/broken`);
    existsSet.add(`${PROJECTS}/broken/project.json`);
    files.set(`${PROJECTS}/broken/project.json`, '{ not json');
    projectFolder('noid', { id: '' });
    files.set(`${PROJECTS}/noid/project.json`, JSON.stringify({ title: 'No Id' }));
    projectFolder('good', { id: 'p-good', title: 'Good' });

    const found = await scanProjects(PROJECTS);
    expect(found).toEqual([{ id: 'p-good', title: 'Good', path: `${PROJECTS}/good` }]);
  });

  it('returns [] when the projects folder does not exist', async () => {
    expect(await scanProjects(PROJECTS)).toEqual([]);
  });
});

describe('findProjectById — locate one project by id via the scan', () => {
  beforeEach(() => {
    existsSet.add(PROJECTS);
    dirents.set(PROJECTS, [
      { name: 'a', isDirectory: true },
      { name: 'b', isDirectory: true },
    ]);
    projectFolder('a', { id: 'p-a', title: 'Alpha' });
    projectFolder('b', { id: 'p-b', title: 'Beta' });
  });

  it('returns the matching entry (real on-disk path)', async () => {
    expect(await findProjectById('p-b', PROJECTS)).toEqual({ id: 'p-b', title: 'Beta', path: `${PROJECTS}/b` });
  });

  it('returns null when no folder carries that id', async () => {
    expect(await findProjectById('p-missing', PROJECTS)).toBeNull();
  });

  it('returns null when the projects folder does not exist', async () => {
    existsSet.delete(PROJECTS);
    expect(await findProjectById('p-a', PROJECTS)).toBeNull();
  });
});
