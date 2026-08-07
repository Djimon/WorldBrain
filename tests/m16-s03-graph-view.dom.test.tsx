// M16-S03: Globaler Graph auf three.js + d3-force-3d + eigener Menüpunkt (#324)
// See: https://github.com/Djimon/WorldBrain/issues/324
//
// Renderer = three.js (bench #326). three's WebGLRenderer + OrbitControls +
// postprocessing are mocked (jsdom has NO WebGL, and picking/bloom are GPU —
// verified in-app, not here). This file pins the renderer-AGNOSTIC contract:
// GraphCanvas mounts a canvas, calls nodeStyle once per node + edgeStyle,
// builds NO bloom composer unless glowEnabled (D2 default-off), and disposes
// cleanly on unmount. Node styling itself is pure/tested in
// m16-s03-graph-style.test.ts. AP-005: ESM import only. AP-008 (RTL): anchored.

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphLink, GraphNode } from '../src/services/graph-model';

// ── Mock three's GPU/DOM-heavy pieces; keep the pure-JS math/scene classes ───
const composerCtor = vi.hoisted(() => vi.fn());

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    domElement = document.createElement('canvas');
    setPixelRatio(): void { /* no-op */ }
    setSize(): void { /* no-op */ }
    render(): void { /* no-op */ }
    dispose(): void { /* no-op */ }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class { enableDamping = false; update(): void {} dispose(): void {} },
}));
vi.mock('three/examples/jsm/postprocessing/EffectComposer.js', () => ({
  EffectComposer: class {
    renderToScreen = false;
    renderTarget2 = { texture: {} };
    constructor() { composerCtor(); }
    addPass(): void {}
    render(): void {}
    dispose(): void {}
    setSize(): void {}
  },
}));
vi.mock('three/examples/jsm/postprocessing/RenderPass.js', () => ({ RenderPass: class {} }));
vi.mock('three/examples/jsm/postprocessing/ShaderPass.js', () => ({ ShaderPass: class { needsSwap = false; uniforms = {}; } }));
vi.mock('three/examples/jsm/postprocessing/UnrealBloomPass.js', () => ({ UnrealBloomPass: class {} }));
vi.mock('three/examples/jsm/postprocessing/OutputPass.js', () => ({ OutputPass: class {} }));

import { GraphCanvas } from '../src/ui/GraphCanvas';
import { edgeStyle, nodeStyle } from '../src/services/graph-style';

afterEach(() => {
  composerCtor.mockClear();
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

describe('#324 (contract): GraphCanvas — the ONE renderer core (D12, three.js)', () => {
  it('mounts a three.js renderer and appends its canvas into the DOM', () => {
    const { container } = render(<GraphCanvas {...baseCanvasProps()} />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('resolves a style for every node (one nodeStyle call per node) + edges', () => {
    const nodeStyleSpy = vi.fn((n: GraphNode) => nodeStyle(n, { min: 1, max: 2 }));
    const edgeStyleSpy = vi.fn(edgeStyle);
    render(<GraphCanvas {...baseCanvasProps({ nodeStyle: nodeStyleSpy, edgeStyle: edgeStyleSpy })} />);
    expect(nodeStyleSpy).toHaveBeenCalledTimes(NODES.length);
    expect(edgeStyleSpy).toHaveBeenCalled();
  });

  it('destroys the renderer on unmount (no leaked canvas, no throw)', () => {
    const { unmount, container } = render(<GraphCanvas {...baseCanvasProps()} />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });
});

describe('#324 (D2): bloom glow is OFF by default', () => {
  it('without glowEnabled, no bloom EffectComposer is constructed', () => {
    render(<GraphCanvas {...baseCanvasProps()} />);
    expect(composerCtor).not.toHaveBeenCalled();
  });

  it('with glowEnabled, a bloom EffectComposer IS constructed', () => {
    render(<GraphCanvas {...baseCanvasProps({ glowEnabled: true })} />);
    expect(composerCtor).toHaveBeenCalled();
  });
});

// ── Menu wiring (WorkspaceShell) ─────────────────────────────────────────────
// GlobalGraphView itself stays a black box here (stubbed) — this only pins the
// exact wiring the issue mandates: a 'graph' area + menu entry + a switch case
// that mounts GlobalGraphView.

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
