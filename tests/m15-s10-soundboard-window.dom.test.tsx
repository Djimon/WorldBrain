// M15-S10: Soundboard als eigenes Fenster (Tauri WebviewWindow, eigener AudioContext)
// See: https://github.com/Djimon/WorldBrain/issues/281
//
// AudioContext is mocked (jsdom has no Web Audio). openProjectDb is mocked
// so this test never touches a real Tauri SQL connection.

import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSoundboardWindow } from '../src/ui/AudioSoundboardWindow';

const fakeDb = { execute: vi.fn(async () => undefined), select: vi.fn(async () => []) };

// Auto-resolves immediately by default (every existing test). Set
// manualDbResolution=true to instead capture each call's resolve function in
// pendingDbResolves, so a test can control the ORDER in which concurrent
// openProjectDb calls (one per StrictMode pass) settle.
let manualDbResolution = false;
const pendingDbResolves: Array<(db: typeof fakeDb) => void> = [];

vi.mock('../src/services/db-init', () => ({
  openProjectDb: vi.fn(() => {
    if (!manualDbResolution) return Promise.resolve(fakeDb);
    return new Promise<typeof fakeDb>((resolve) => { pendingDbResolves.push(resolve); });
  }),
}));

let nextInitialState: 'suspended' | 'running' = 'suspended';

function fakeAudioParam() { return { value: 0 }; }
function fakeAudioNode() { return { connect: vi.fn(), disconnect: vi.fn() }; }

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  // Populated the first time createGain() is called on an instance — that
  // only happens inside `new LocalAudioEngine(audioContext)`'s constructor,
  // so this tracks which context a board ACTUALLY got bound to (ReadyBoard
  // lazily builds its engine once via a ref-guard and never rebuilds it even
  // if the audioContext prop later changes) — NOT just "the last context
  // object ever constructed", which instances.at(-1) would report even if
  // the app is actually stuck using an earlier, closed one.
  static enginesBuiltOn: FakeAudioContext[] = [];
  private gainCalls = 0;
  state: 'suspended' | 'running' | 'closed';
  resumeCalls = 0;
  closeCalls = 0;
  currentTime = 0;
  destination = fakeAudioNode();
  constructor() { this.state = nextInitialState; FakeAudioContext.instances.push(this); }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  close() { this.closeCalls += 1; this.state = 'closed'; return Promise.resolve(); }
  // Minimal Web Audio surface so LocalAudioEngine (mounted once the board is
  // ready) can construct its master gain node without a real audio backend.
  createGain() {
    this.gainCalls += 1;
    if (this.gainCalls === 1) FakeAudioContext.enginesBuiltOn.push(this);
    return { ...fakeAudioNode(), gain: fakeAudioParam() };
  }
  createStereoPanner() { return { ...fakeAudioNode(), pan: fakeAudioParam() }; }
  createBiquadFilter() { return { ...fakeAudioNode(), type: '', frequency: fakeAudioParam(), Q: fakeAudioParam(), gain: fakeAudioParam() }; }
  createBufferSource() { return { ...fakeAudioNode(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }; }
  decodeAudioData() { return Promise.resolve({}); }
}

beforeEach(() => {
  nextInitialState = 'suspended';
  FakeAudioContext.instances = [];
  FakeAudioContext.enginesBuiltOn = [];
  manualDbResolution = false;
  pendingDbResolves.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});

describe('M15-S10 soundboard window', () => {
  it('renders without throwing', async () => {
    render(<AudioSoundboardWindow dbPath="/tmp/world.db" />);
    await waitFor(() => expect(screen.queryByText('Lade…')).not.toBeInTheDocument());
  });

  it('shows a message when no project is connected', () => {
    render(<AudioSoundboardWindow dbPath={null} />);
    expect(screen.getByText('Kein Projekt verbunden.')).toBeInTheDocument();
  });

  describe('autoplay gate (AudioContext starts suspended)', () => {
    it('shows the gate overlay and does not resume the AudioContext before a gesture', async () => {
      render(<AudioSoundboardWindow dbPath="/tmp/world.db" />);
      const gateButton = await screen.findByRole('button', { name: 'Soundboard aktivieren' });
      expect(screen.getByRole('dialog', { name: 'Audiowiedergabe freigeben' })).toBeInTheDocument();
      expect(gateButton).toBeInTheDocument();
      expect(screen.queryByText('Audio-Soundboard')).not.toBeInTheDocument();
    });

    it('clicking the gate button resumes the AudioContext and reveals the board', async () => {
      render(<AudioSoundboardWindow dbPath="/tmp/world.db" />);
      const gateButton = await screen.findByRole('button', { name: 'Soundboard aktivieren' });
      fireEvent.click(gateButton);

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Audio-Soundboard' })).toBeInTheDocument());
      expect(screen.queryByRole('dialog', { name: 'Audiowiedergabe freigeben' })).not.toBeInTheDocument();
    });
  });

  describe('AudioContext starts running (no gate needed)', () => {
    it('renders the board directly, no autoplay overlay', async () => {
      nextInitialState = 'running';
      render(<AudioSoundboardWindow dbPath="/tmp/world.db" />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Audio-Soundboard' })).toBeInTheDocument());
      expect(screen.queryByRole('dialog', { name: 'Audiowiedergabe freigeben' })).not.toBeInTheDocument();
    });
  });

  describe('StrictMode double-invoke (regression: silent audio nodes on a closed context)', () => {
    // React 18 StrictMode mounts, cleans up, then mounts again in dev — the
    // cleanup used to close() the context without clearing the ref, so the
    // second mount reused the SAME (now closed) instance. Every Web Audio
    // node built on a closed context "succeeds" silently — no error, no
    // sound — exactly the reported "UI shows playing but I hear nothing" bug.
    it('the context a LocalAudioEngine actually gets built on is not closed', async () => {
      nextInitialState = 'running';
      render(
        <StrictMode>
          <AudioSoundboardWindow dbPath="/tmp/world.db" projectDir="/tmp/proj" />
        </StrictMode>,
      );
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Audio-Soundboard' })).toBeInTheDocument());
      // NOT instances.at(-1) — ReadyBoard builds its engine once (ref-guarded)
      // and never rebuilds it even if the audioContext prop changes later, so
      // "the last context object ever constructed" can look fine while the
      // app is actually stuck using an earlier, closed one. enginesBuiltOn
      // tracks which context a LocalAudioEngine was actually constructed against.
      const boundContext = FakeAudioContext.enginesBuiltOn.at(-1)!;
      expect(boundContext.state).not.toBe('closed');
    });

    // The above test alone did not catch the bug's actual reappearance: the
    // ref-nulling fix only controls which context the SECOND effect pass
    // creates. It does nothing to stop the FIRST pass's already-in-flight
    // openProjectDb() from resolving on its own schedule and calling
    // setMode() with ITS (by-then-closed) context. In practice the first
    // pass's call typically resolves before the second pass's — it had a
    // head start — so this is the realistic ordering, not an edge case.
    // Forced explicitly here instead of relying on default timing luck.
    it('the stale first-pass DB call resolving before the second pass does not leave the board bound to a closed context', async () => {
      nextInitialState = 'running';
      manualDbResolution = true;
      render(
        <StrictMode>
          <AudioSoundboardWindow dbPath="/tmp/world.db" projectDir="/tmp/proj" />
        </StrictMode>,
      );

      await waitFor(() => expect(pendingDbResolves.length).toBeGreaterThanOrEqual(2));
      const [firstPassResolve, secondPassResolve] = pendingDbResolves;

      // Stale (already-cleaned-up) first pass finishes first — its own
      // context is closed by the time this settles...
      firstPassResolve(fakeDb);
      await new Promise((resolve) => setTimeout(resolve, 0));
      // ...then the surviving second pass finishes.
      secondPassResolve(fakeDb);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Audio-Soundboard' })).toBeInTheDocument());

      const boundContext = FakeAudioContext.enginesBuiltOn.at(-1)!;
      expect(boundContext.state).not.toBe('closed');
    });
  });
});
