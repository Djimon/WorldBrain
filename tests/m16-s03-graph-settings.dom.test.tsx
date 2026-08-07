// M16-S03 (#324): the gear settings panel (GraphSettingsPanel). Controlled
// component — asserts it opens on the gear click and reports changes via
// onChange. react-i18next needs no provider here (inline German defaults in
// t(key, default) are returned as-is). AP-005 ESM import; AP-008 anchored RTL.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GraphSettingsPanel } from '../src/ui/GraphSettingsPanel';
import type { GraphSettings } from '../src/ui/GraphSettingsPanel';

const BASE: GraphSettings = {
  layoutMode: 'galaxy',
  colorMode: 'entity',
  glow: false,
  showAllEdges: false,
  showMentions: true,
  mentionColorLight: '#d11a0f',
  mentionColorDark: '#ff3b30',
  relationColorLight: '#555555',
  relationColorDark: '#d0d0d0',
  mentionForm: 'solid',
  relationForm: 'solid',
  hiddenRelationTypes: [],
};

describe('#324: graph settings gear panel', () => {
  it('is collapsed until the gear is clicked, then shows the controls', () => {
    render(<GraphSettingsPanel value={BASE} onChange={vi.fn()} theme="dark" />);
    expect(screen.queryByRole('group', { name: 'Graph-Einstellungen' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Graph-Einstellungen' }));
    expect(screen.getByRole('group', { name: 'Graph-Einstellungen' })).toBeInTheDocument();
  });

  it('toggling Glow reports onChange({ glow: true })', () => {
    const onChange = vi.fn();
    render(<GraphSettingsPanel value={BASE} onChange={onChange} theme="dark" />);
    fireEvent.click(screen.getByRole('button', { name: 'Graph-Einstellungen' }));
    fireEvent.click(screen.getByLabelText('Glow'));
    expect(onChange).toHaveBeenCalledWith({ glow: true });
  });

  it('choosing color mode "nach Cluster" reports onChange({ colorMode: "cluster" })', () => {
    const onChange = vi.fn();
    render(<GraphSettingsPanel value={BASE} onChange={onChange} theme="dark" />);
    fireEvent.click(screen.getByRole('button', { name: 'Graph-Einstellungen' }));
    fireEvent.click(screen.getByRole('button', { name: 'nach Cluster' }));
    expect(onChange).toHaveBeenCalledWith({ colorMode: 'cluster' });
  });

  it('changing mention form reports onChange({ mentionForm })', () => {
    const onChange = vi.fn();
    render(<GraphSettingsPanel value={BASE} onChange={onChange} theme="dark" />);
    fireEvent.click(screen.getByRole('button', { name: 'Graph-Einstellungen' }));
    fireEvent.change(screen.getByLabelText('Mention-Form'), { target: { value: 'animated' } });
    expect(onChange).toHaveBeenCalledWith({ mentionForm: 'animated' });
  });
});
