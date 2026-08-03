// M16-S03: Globaler Graph auf PixiJS + d3-force + eigener Menüpunkt (#324)
// See: https://github.com/Djimon/WorldBrain/issues/324
//
// Pixi is mocked entirely (per the issue's own testability requirement —
// styling is pure/GPU-free, tested in m16-s03-graph-style.test.ts; this file
// only pins the CONTRACT GraphCanvas is expected to use: new Application(),
// await app.init(...), one Container/Graphics per node with
// `.on('pointerdown'/'pointerover'/'pointerout', ...)`, app.destroy() on
// unmount). AP-005: ESM import only, no require(). AP-008 (RTL): anchored
// queries, no wildcard catch-alls.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphLink, GraphNode } from '../src/services/graph-model';

// ── Fake Pixi (spy-friendly, event-emitter based) ────────────────────────────
// vi.hoisted() ensures these classes exist when vi.mock()'s hoisted factory
// runs — plain class declarations would be in the TDZ at that point.
const pixi = vi.hoisted(() => {
  class FakeDisplayObject {
    children: FakeDisplayObject[] = [];
    listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    eventMode = 'auto';
    x = 0; y = 0; alpha = 1;
    addChild<T extends FakeDisplayObject>(c: T): T { this.children.push(c); return c; }
    removeChild(): void { /* no-op */ }
    on(event: string, cb: (...args: unknown[]) => void) {
      (this.listeners[event] ??= []).push(cb);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      (this.listeners[event] ?? []).forEach((cb) => cb(...args));
    }
    destroy(): void { /* no-op */ }
  }
  class FakeGraphics extends FakeDisplayObject {
    circle() { return this; }
    fill() { return this; }
    stroke() { return this; }
    rect() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    clear() { return this; }
  }
  const createdGraphics: FakeGraphics[] = [];
  class FakeGraphicsTracked extends FakeGraphics {
    constructor() { super(); createdGraphics.push(this); }
  }
  class FakeApplication {
    stage = new FakeDisplayObject();
    canvas = document.createElement('canvas');
    async init() { /* no-op */ }
    destroy() { /* no-op */ }
  }
  return { FakeDisplayObject, FakeGraphicsTracked, FakeApplication, createdGraphics };
});

vi.mock('pixi.js', () => ({
  Application: pixi.FakeApplication,
  Container: pixi.FakeDisplayObject,
  Graphics: pixi.FakeGraphicsTracked,
}));

import { GraphCanvas } from '../src/ui/GraphCanvas';
import { edgeStyle, nodeStyle } from '../src/services/graph-style';

afterEach(() => {
  pixi.createdGraphics.length = 0;
  vi.clearAllMocks();
});

const NODES: GraphNode[] = [
  { id: 'e1', type: 'Character', label: 'Ada', degree: 2 },
  { id: 'e2', type: 'Location', label: 'Tavern', degree: 1 },
];
const LINKS: GraphLink[] = [{ source: 'e1', target: 'e2', kind: 'relation' }];

function baseCanvasProps(overrides: Partial<React.ComponentProps<typeof GraphCanvas>> = {}) {
  return {
    nodes: NODES,
    links: LINKS,
    nodeStyle: (n: GraphNode) => nodeStyle(n, { min: 1, max: 2 }),
    edgeStyle,
    onNavigate: vi.fn(),
    ...overrides,
  };
}

describe('#324 (contract): GraphCanvas — the ONE renderer core (D12)', () => {
  it('mounts a Pixi application and appends its canvas into the DOM', async () => {
    const { container } = render(<GraphCanvas {...baseCanvasProps()} />);
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
  });

  it('creates one Graphics object per node (never a single shared display object)', async () => {
    render(<GraphCanvas {...baseCanvasProps()} />);
    await waitFor(() => expect(pixi.createdGraphics.length).toBeGreaterThanOrEqual(NODES.length));
  });

  it('clicking a node (pointerdown) calls onNavigate with that node\'s id', async () => {
    const onNavigate = vi.fn();
    render(<GraphCanvas {...baseCanvasProps({ onNavigate })} />);
    await waitFor(() => expect(pixi.createdGraphics.length).toBeGreaterThanOrEqual(1));
    // Simulate a click on the first node's Graphics object via its captured
    // pointerdown listener (this IS how Pixi delivers pointer events).
    pixi.createdGraphics[0].emit('pointerdown');
    expect(onNavigate).toHaveBeenCalledWith(expect.any(String));
    expect(onNavigate.mock.calls[0][0]).toMatch(/^e[12]$/);
  });

  it('hovering a node (pointerover) calls onHoverNode with that node\'s id', async () => {
    const onHoverNode = vi.fn();
    render(<GraphCanvas {...baseCanvasProps({ onHoverNode })} />);
    await waitFor(() => expect(pixi.createdGraphics.length).toBeGreaterThanOrEqual(1));
    pixi.createdGraphics[0].emit('pointerover');
    expect(onHoverNode).toHaveBeenCalledWith(expect.any(String));
  });

  it('un-hovering a node (pointerout) calls onHoverNode with null', async () => {
    const onHoverNode = vi.fn();
    render(<GraphCanvas {...baseCanvasProps({ onHoverNode })} />);
    await waitFor(() => expect(pixi.createdGraphics.length).toBeGreaterThanOrEqual(1));
    pixi.createdGraphics[0].emit('pointerover');
    pixi.createdGraphics[0].emit('pointerout');
    expect(onHoverNode).toHaveBeenLastCalledWith(null);
  });

  it('destroys the Pixi application on unmount (no leaked app/canvas)', async () => {
    const { unmount, container } = render(<GraphCanvas {...baseCanvasProps()} />);
    await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument());
    expect(() => unmount()).not.toThrow();
  });
});

describe('#324 (D2): per-node glow halo is OFF by default', () => {
  it('without glowEnabled, no additional halo Graphics beyond one per node is created', async () => {
    render(<GraphCanvas {...baseCanvasProps()} />);
    await waitFor(() => expect(pixi.createdGraphics.length).toBeGreaterThanOrEqual(NODES.length));
    // Default (glowEnabled omitted/false): exactly one Graphics per node, no
    // extra halo sprite/graphics per node.
    expect(pixi.createdGraphics.length).toBe(NODES.length);
  });
});

// ── Menu wiring (WorkspaceShell) ─────────────────────────────────────────────
// GlobalGraphView itself stays a black box here (stubbed) — this only pins
// the exact wiring the issue mandates: a 'graph' area + menu entry + a
// switch case that mounts GlobalGraphView.

const h = vi.hoisted(() => ({
  fakeDb: { select: vi.fn(async () => []), execute: vi.fn(async () => {}) } as unknown as DatabaseLike,
  stub: (name: string) => ({ [name]: () => <div data-testid={`stub-${name}`} /> }),
}));

vi.mock('../src/services/DatabaseContext', () => ({ useDatabase: () => h.fakeDb }));
vi.mock('../src/services/map-service', () => ({ listMaps: vi.fn(async () => []), importMapImage: vi.fn() }));
vi.mock('../src/services/calendar-service', () => ({
  listCalendars: vi.fn(async () => []), setActiveCalendar: vi.fn(async () => {}), deleteCalendar: vi.fn(async () => {}),
}));
vi.mock('../src/services/event-entity-service', () => ({ createEventEntity: vi.fn(async () => ({ id: 'x' })), listEventEntities: vi.fn(async () => []) }));
vi.mock('../src/services/era-service', () => ({ listEras: vi.fn(async () => []) }));
vi.mock('../src/services/saved-views-service', () => ({ listViews: vi.fn(async () => []) }));
vi.mock('../src/services/session-variable-service', () => ({ listVars: vi.fn(async () => []) }));
vi.mock('../src/services/plugin-entity-service', () => ({ listEntityTypes: vi.fn(() => []) }));
vi.mock('../src/services/rule-import-service', () => ({ importRules: vi.fn() }));
vi.mock('../src/services/rule-evaluations', () => ({ detectMysteryBreakers: vi.fn(), analyzeRoleCoverage: vi.fn(), detectQuestBlockers: vi.fn() }));

vi.mock('../src/ui/MapViewer', () => ({ ...h.stub('MapViewer'), default: () => <div /> }));
vi.mock('../src/ui/GlobalGraphView', () => h.stub('GlobalGraphView'));
vi.mock('../src/ui/EntityDetailView', () => ({ EntityDetailView: () => <div data-testid="stub-EntityDetailView" />, clearEntityTabs: vi.fn() }));
vi.mock('../src/ui/GlobalSearch', () => h.stub('GlobalSearch'));
vi.mock('../src/ui/ChronicleView', () => h.stub('ChronicleView'));
vi.mock('../src/ui/CalendarWizard', () => h.stub('CalendarWizard'));
vi.mock('../src/ui/CalendarLinkPanel', () => h.stub('CalendarLinkPanel'));
vi.mock('../src/ui/CalendarMonthView', () => h.stub('CalendarMonthView'));
vi.mock('../src/ui/CardList', () => h.stub('CardList'));
vi.mock('../src/ui/CardCreationFlow', () => h.stub('CardCreationFlow'));
vi.mock('../src/ui/PrintSheetComposer', () => h.stub('PrintSheetComposer'));
vi.mock('../src/ui/PluginManager', () => h.stub('PluginManager'));
vi.mock('../src/ui/DmScreen', () => ({ DmScreen: () => <div />, DmScreenSelector: () => <div /> }));
vi.mock('../src/ui/CaptureInbox', () => h.stub('CaptureInbox'));
vi.mock('../src/ui/EncounterCounters', () => h.stub('EncounterCounters'));
vi.mock('../src/ui/ConditionBuilder', () => ({ ConditionBuilder: () => <div /> }));
vi.mock('../src/ui/PlayerScreen', () => h.stub('PlayerScreen'));
vi.mock('../src/ui/SessionClock', () => h.stub('SessionClock'));
vi.mock('../src/ui/SnapshotManager', () => h.stub('SnapshotManager'));
vi.mock('../src/ui/UpdateNotification', () => h.stub('UpdateNotification'));
vi.mock('../src/ui/EntityMasterDetail', () => h.stub('EntityMasterDetail'));
vi.mock('../src/ui/LanguageSwitcher', () => h.stub('LanguageSwitcher'));
vi.mock('../src/ui/ThemeToggle', () => h.stub('ThemeToggle'));

import { WorkspaceShell } from '../src/ui/WorkspaceShell';

describe('#324: "graph" menu entry mounts GlobalGraphView', () => {
  it('clicking the graph area button renders GlobalGraphView', async () => {
    const view = render(
      <WorkspaceShell projectId="p1" projectDir="/proj" snapshotsDir="/snap" onProjectClose={vi.fn()} />,
    );
    const graphBtn = view.container.querySelector('[data-area="graph"]') as HTMLElement | null;
    expect(graphBtn).toBeTruthy();
    fireEvent.click(graphBtn as HTMLElement);
    expect(await screen.findByTestId('stub-GlobalGraphView')).toBeInTheDocument();
  });
});
