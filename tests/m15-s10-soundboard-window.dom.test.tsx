// M15-S10: Soundboard als eigenes Fenster (Tauri WebviewWindow, eigener AudioContext)
// See: https://github.com/Djimon/WorldBrain/issues/281
//
// AudioContext is mocked (jsdom has no Web Audio). openProjectDb is mocked
// so this test never touches a real Tauri SQL connection.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioSoundboardWindow } from '../src/ui/AudioSoundboardWindow';

const fakeDb = { execute: vi.fn(async () => undefined), select: vi.fn(async () => []) };

vi.mock('../src/services/db-init', () => ({
  openProjectDb: vi.fn(() => Promise.resolve(fakeDb)),
}));

let nextInitialState: 'suspended' | 'running' = 'suspended';

function fakeAudioParam() { return { value: 0 }; }
function fakeAudioNode() { return { connect: vi.fn(), disconnect: vi.fn() }; }

class FakeAudioContext {
  state: 'suspended' | 'running' | 'closed';
  resumeCalls = 0;
  closeCalls = 0;
  currentTime = 0;
  destination = fakeAudioNode();
  constructor() { this.state = nextInitialState; }
  resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  close() { this.closeCalls += 1; this.state = 'closed'; return Promise.resolve(); }
  // Minimal Web Audio surface so LocalAudioEngine (mounted once the board is
  // ready) can construct its master gain node without a real audio backend.
  createGain() { return { ...fakeAudioNode(), gain: fakeAudioParam() }; }
  createStereoPanner() { return { ...fakeAudioNode(), pan: fakeAudioParam() }; }
  createBiquadFilter() { return { ...fakeAudioNode(), type: '', frequency: fakeAudioParam(), Q: fakeAudioParam(), gain: fakeAudioParam() }; }
  createBufferSource() { return { ...fakeAudioNode(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }; }
  decodeAudioData() { return Promise.resolve({}); }
}

beforeEach(() => {
  nextInitialState = 'suspended';
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
});
