import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, Field, StatusChip, Tabs } from '../src/ui/primitives';

describe('M0-S05 UI primitive DOM behavior', () => {
  it('renders Button as an accessible local control with tone, type, disabled state, and click behavior', () => {
    const handleClick = vi.fn();

    render(
      <Button aria-label="Create workspace" disabled onClick={handleClick} tone="accent">
        Create
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Create workspace' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-tone', 'accent');
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders Tabs with tablist semantics and reports selected option changes', () => {
    const handleSelect = vi.fn();

    render(
      <Tabs
        activeId="overview"
        label="workspace sections"
        onSelect={handleSelect}
        options={[
          { id: 'overview', label: 'Overview' },
          { id: 'library', label: 'Library' },
          { id: 'review', label: 'Review' },
        ]}
      />,
    );

    const tablist = screen.getByRole('tablist', { name: 'workspace sections' });
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const library = screen.getByRole('tab', { name: 'Library' });

    expect(tablist).toContainElement(overview);
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(library).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(library);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith('library');
  });

  it('renders StatusChip as visible status text with a semantic tone marker', () => {
    render(<StatusChip tone="warning">Needs review</StatusChip>);

    expect(screen.getByText('Needs review')).toHaveAttribute('data-tone', 'warning');
  });

  it('renders Field with an accessible label, input props, and hint relationship', () => {
    render(<Field hint="Shown below the field" label="Project name" maxLength={40} name="projectName" required />);

    const input = screen.getByRole('textbox', { name: /Project name/u });
    const hint = screen.getByText('Shown below the field');

    expect(input).toHaveAttribute('name', 'projectName');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('maxlength', '40');
    expect(input).toHaveAccessibleDescription('Shown below the field');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });
});
