// @vitest-environment jsdom
// M17-S06 (#388-Follow-up): „Themes-Ordner öffnen"-Button im ThemePicker öffnet den
// Themes-Ordner im OS-Dateimanager. #406: der Ort ist jetzt Documents\WorldsAndBeyond\themes.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openPath, revealItemInDir, mkdir } = vi.hoisted(() => ({
  openPath: vi.fn(() => Promise.resolve()),
  revealItemInDir: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: { language: 'de' } }),
}));
vi.mock('@tauri-apps/api/path', () => ({
  documentDir: vi.fn(() => Promise.resolve('/docs')),
  resourceDir: vi.fn(() => Promise.resolve('/res')),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ mkdir, exists: vi.fn(() => Promise.resolve(false)), copyFile: vi.fn(() => Promise.resolve()) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath, revealItemInDir }));

const THEMES = '/docs/WorldsAndBeyond/themes';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('M17-S06 themes-folder button', () => {
  it('renders the button and opens the themes folder on click', async () => {
    const { ThemePicker } = await import('../src/ui/ThemePicker');
    render(React.createElement(ThemePicker));
    const btn = screen.getByRole('button', { name: /Themes-Ordner öffnen/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mkdir).toHaveBeenCalledWith(THEMES, { recursive: true }));
    await waitFor(() => expect(openPath).toHaveBeenCalledWith(THEMES));
    expect(revealItemInDir).not.toHaveBeenCalled(); // openPath erfolgreich → kein Fallback
  });

  it('falls back to revealItemInDir when openPath is not permitted', async () => {
    openPath.mockRejectedValueOnce(new Error('not allowed'));
    const { ThemePicker } = await import('../src/ui/ThemePicker');
    render(React.createElement(ThemePicker));
    fireEvent.click(screen.getByRole('button', { name: /Themes-Ordner öffnen/i }));
    await waitFor(() => expect(revealItemInDir).toHaveBeenCalledWith(THEMES));
  });
});
