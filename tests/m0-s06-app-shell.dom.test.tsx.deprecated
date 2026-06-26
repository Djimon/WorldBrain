import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('M0-S06 app shell DOM behavior', () => {
  it('renders the visible shell regions without domain workflow behavior', () => {
    render(<App />);

    const header = screen.getByRole('banner');
    const navigation = screen.getByRole('complementary', { name: 'primary navigation' });
    const workspace = screen.getByRole('main');
    const status = screen.getByRole('status');

    expect(within(header).getByText('WorldBuilderX')).toBeVisible();
    expect(within(header).getByRole('button', { name: 'New project' })).toHaveAttribute('data-tone', 'accent');
    expect(within(navigation).getByRole('tablist', { name: 'primary workspace navigation' })).toBeVisible();
    expect(within(workspace).getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
    expect(status).toHaveTextContent('React, Tauri, and M0 build surfaces are wired.');
  });

  it('switches active workspace content when at least two navigation entries are clicked', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Library' }));

    expect(screen.getByRole('heading', { name: 'Library surface' })).toBeVisible();
    expect(screen.getByText('Reserved for list, table, and inspector surfaces.')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Review' }));

    expect(screen.getByRole('heading', { name: 'Review surface' })).toBeVisible();
    expect(screen.getByText('Reserved for compact status panels.')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Review' })).toHaveAttribute('aria-selected', 'true');
  });
});
