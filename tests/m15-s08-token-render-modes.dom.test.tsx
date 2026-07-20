// #298: Token = map-local design element (NO entity link). Image-based render
// modes: 'token' (round mask + frame, pannable crop) / 'plain' (full artwork).
// See: https://github.com/Djimon/WorldBrain/issues/298
//
// AP-001: DatabaseLike, no unknown casts. AP-003: no prompt/alert/confirm
// (source scan). AP-005: ESM imports only.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';
import { MapToken } from '../src/ui/MapTokenLayer';
import { TokenEditor } from '../src/ui/TokenEditor';
import type { MapTokenRow } from '../src/services/map-token-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyMapSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}
async function getSvc() { return import('../src/services/map-token-service'); }

function makeToken(overrides: Partial<MapTokenRow> = {}): MapTokenRow {
  return {
    id: 'token_1', layer_id: 'lyr_1', map_id: 'map-1',
    art_asset_id: null, render_style: 'token', art_offset_x: 0, art_offset_y: 0,
    label: 'Ork', x: 10, y: 10, ring_color: '#ff0000',
    counter_label: null, counter_value: null, status_chips: [],
    session_id: null, created_at: '',
    ...overrides,
  };
}

describe('#298 (schema/service): image-based tokens, no entity link', () => {
  it('map_tokens has art columns and no entity_id', () => {
    const { db } = createDatabase();
    try {
      const cols = (db.prepare('PRAGMA table_info(map_tokens)').all() as Array<{ name: string }>).map((c) => c.name);
      expect(cols).toContain('art_asset_id');
      expect(cols).toContain('render_style');
      expect(cols).toContain('art_offset_x');
      expect(cols).toContain('art_offset_y');
      expect(cols).not.toContain('entity_id');
    } finally { db.close(); }
  });

  it('createToken stores art_asset_id + render_style; updateToken persists art_offset', async () => {
    const { db, asyncDb } = createDatabase();
    const { createToken, updateToken, listTokens } = await getSvc();
    try {
      const { id } = await createToken(asyncDb, { map_id: 'map-1', x: 0, y: 0, art_asset_id: 'assets/maps/token-a.png', render_style: 'plain' });
      await updateToken(asyncDb, id, { art_offset_x: 12, art_offset_y: -8 });
      const tk = (await listTokens(asyncDb, 'map-1')).find((t) => t.id === id);
      expect(tk?.art_asset_id).toBe('assets/maps/token-a.png');
      expect(tk?.render_style).toBe('plain');
      expect(tk?.art_offset_x).toBe(12);
      expect(tk?.art_offset_y).toBe(-8);
    } finally { db.close(); }
  });
});

describe('#298 (component): MapToken render modes', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof MapToken>> = {}) {
    return { token: makeToken(), scale: 1, resolveAssetUrl: (a: string) => `/assets/${a}`, ...overrides };
  }

  it('token mode with art renders a masked image inside the ring', () => {
    render(<MapToken {...baseProps({ token: makeToken({ art_asset_id: 'a.png', render_style: 'token', art_offset_x: 10, art_offset_y: -5 }) })} />);
    const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement;
    expect(el.querySelector('.map-token__ring .map-token__art')).toBeInTheDocument();
    const img = el.querySelector('.map-token__art') as HTMLElement;
    expect(img.style.objectPosition).toBe('60% 45%');
  });

  it('token mode without art renders the initial placeholder', () => {
    render(<MapToken {...baseProps({ token: makeToken({ art_asset_id: null, render_style: 'token' }) })} />);
    const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement;
    expect(el.querySelector('.map-token__portrait')).toBeInTheDocument();
    expect(el.querySelector('.map-token__art')).not.toBeInTheDocument();
  });

  it('plain mode with art renders the full artwork without a ring', () => {
    render(<MapToken {...baseProps({ token: makeToken({ art_asset_id: 'a.png', render_style: 'plain' }) })} />);
    const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement;
    expect(el.querySelector('.map-token__art-plain')).toBeInTheDocument();
    expect(el.querySelector('.map-token__ring')).not.toBeInTheDocument();
  });
});

describe('#298 (component): TokenEditor art/mode/crop, no entity picker', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof TokenEditor>> = {}) {
    return {
      token: makeToken(),
      onPickArt: vi.fn(async () => 'assets/maps/token-x.png'),
      resolveAssetUrl: (a: string) => `/assets/${a}`,
      onSave: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
  }

  it('has no entity picker (token is map-local)', () => {
    render(<TokenEditor {...baseProps()} />);
    expect(screen.queryByText(/entität/i)).not.toBeInTheDocument();
  });

  it('renders mode toggle + upload button', () => {
    render(<TokenEditor {...baseProps()} />);
    expect(screen.getByRole('button', { name: /token \(kreis\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plain \(ganzes bild\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bild hochladen/i })).toBeInTheDocument();
  });

  it('upload calls onPickArt', () => {
    const onPickArt = vi.fn(async () => 'assets/maps/token-x.png');
    render(<TokenEditor {...baseProps({ onPickArt })} />);
    fireEvent.click(screen.getByRole('button', { name: /bild hochladen/i }));
    expect(onPickArt).toHaveBeenCalled();
  });

  it('save hands a patch with render_style + art fields', () => {
    const onSave = vi.fn();
    render(<TokenEditor {...baseProps({ token: makeToken({ art_asset_id: 'a.png' }), onSave })} />);
    fireEvent.click(screen.getByRole('button', { name: /plain \(ganzes bild\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ render_style: 'plain', art_asset_id: 'a.png' }));
  });

  it('crop drag (token mode) changes the persisted art offset', () => {
    const onSave = vi.fn();
    render(<TokenEditor {...baseProps({ token: makeToken({ art_asset_id: 'a.png', render_style: 'token' }), onSave })} />);
    const crop = document.querySelector('.token-editor__crop') as HTMLElement;
    expect(crop).toBeInTheDocument();
    fireEvent.pointerDown(crop, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(crop, { clientX: 35, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(crop, { clientX: 35, clientY: 0, pointerId: 1 });
    fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));
    const patch = onSave.mock.calls[0][0];
    expect(patch.art_offset_x).not.toBe(0);
  });
});

describe('no prompt()/alert()/confirm() (AP-003)', () => {
  it('TokenEditor.tsx does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/ui/TokenEditor.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
});
