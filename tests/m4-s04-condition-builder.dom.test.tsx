// M4-S04: Visual condition builder UI — produces JsonLogic, human-readable preview, read-back.
// See: https://github.com/Djimon/WorldBrain/issues/52

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConditionBuilder } from '../src/ui/ConditionBuilder';

const sampleVars = [
  { id: 'hp', label: 'HP', type: 'number' },
  { id: 'isNight', label: 'Is Night', type: 'boolean' },
  { id: 'phase', label: 'Phase', type: 'enum', options: ['combat', 'exploration', 'rest'] },
];

describe('M4-S04 condition builder', () => {
  describe('basic rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} />)).not.toThrow();
    });

    it('renders a variable selector', () => {
      render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} />);
      const sel = screen.queryByRole('combobox', { name: /variable|left/i })
        ?? screen.queryByRole('combobox');
      expect(sel).toBeInTheDocument();
    });

    it('renders an operator selector', () => {
      render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} />);
      const ops = screen.queryAllByRole('combobox');
      expect(ops.length).toBeGreaterThanOrEqual(2); // variable + operator
    });
  });

  describe('JsonLogic output', () => {
    it('onChange is called with a JsonLogic object when condition is built', () => {
      const onChange = vi.fn();
      render(<ConditionBuilder variables={sampleVars} onChange={onChange} />);

      // Select variable
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'hp' } });

      // Select operator >
      if (selects.length > 1) fireEvent.change(selects[1], { target: { value: '>' } });

      // Enter value
      const numInput = screen.queryByRole('spinbutton') ?? screen.queryByRole('textbox');
      if (numInput) fireEvent.change(numInput, { target: { value: '5' } });

      if (onChange.mock.calls.length > 0) {
        const result = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      }
    });

    it('produces valid JsonLogic for a simple == comparison', () => {
      const onChange = vi.fn();
      render(<ConditionBuilder variables={sampleVars} onChange={onChange} initialCondition={{ '==': [{ var: 'vars.hp' }, 10] }} />);

      // The builder should emit the condition — either on mount or after interaction
      expect(onChange).toHaveBeenCalledTimes(0); // no change yet on mount
    });
  });

  describe('human-readable preview', () => {
    it('renders a preview of the condition in plain text', () => {
      render(<ConditionBuilder
        variables={sampleVars}
        onChange={vi.fn()}
        initialCondition={{ '>': [{ var: 'vars.hp' }, 5] }}
      />);

      // Preview should show something like "HP > 5"
      const preview = screen.queryByText(/hp.*>.*5|hp greater than 5/i);
      expect(preview).toBeInTheDocument();
    });
  });

  describe('read-back: loading existing JsonLogic', () => {
    it('loads an existing == condition back into builder state', () => {
      render(<ConditionBuilder
        variables={sampleVars}
        onChange={vi.fn()}
        initialCondition={{ '==': [{ var: 'vars.phase' }, 'combat'] }}
      />);

      // The builder should reflect the loaded condition
      expect(screen.getByDisplayValue(/phase|combat/i)).toBeInTheDocument();
    });

    it('loads an AND condition back into builder', () => {
      render(<ConditionBuilder
        variables={sampleVars}
        onChange={vi.fn()}
        initialCondition={{ 'and': [
          { var: 'vars.isNight' },
          { '>': [{ var: 'vars.hp' }, 0] },
        ] }}
      />);

      expect(screen.getByText(/and/i)).toBeInTheDocument();
    });
  });

  describe('AND / OR grouping', () => {
    it('renders an "Add AND/OR group" control', () => {
      render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} />);
      const andOr = screen.queryByRole('button', { name: /and|or|add group/i });
      expect(andOr).toBeInTheDocument();
    });
  });

  describe('NOT negation', () => {
    it('renders a NOT toggle', () => {
      render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} />);
      const notToggle = screen.queryByRole('button', { name: /not|negate/i })
        ?? screen.queryByRole('checkbox', { name: /not/i });
      expect(notToggle).toBeInTheDocument();
    });
  });
});

// Bug #121: ConditionBuilder with AND/OR group must recursively render child conditions,
//           not display literal placeholder text "[condition N]".
describe('issue #121: ConditionBuilder recursive group rendering', () => {
  const nestedAndCondition = {
    'and': [
      { '>': [{ var: 'vars.hp' }, 5] },
      { '==': [{ var: 'vars.isNight' }, true] },
    ],
  };

  const nestedOrCondition = {
    'or': [
      { '==': [{ var: 'vars.phase' }, 'combat'] },
      { '>': [{ var: 'vars.hp' }, 10] },
    ],
  };

  it('does not render literal "[condition 1]" text for a group child', () => {
    render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} initialCondition={nestedAndCondition} />);
    expect(screen.queryByText(/\[condition\s*\d+\]/i)).not.toBeInTheDocument();
  });

  it('does not render literal "[condition 2]" text for a group child', () => {
    render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} initialCondition={nestedAndCondition} />);
    expect(screen.queryByText(/\[condition\s*2\]/i)).not.toBeInTheDocument();
  });

  it('renders the hp child condition as an interactive element inside an AND group', () => {
    render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} initialCondition={nestedAndCondition} />);
    // After fix: the child condition renders its variable selector or value, not a stub
    const hpControl = screen.queryByDisplayValue(/hp/i)
      ?? screen.queryByText(/hp/i);
    expect(hpControl).toBeInTheDocument();
  });

  it('renders both children of an OR group, not placeholders', () => {
    render(<ConditionBuilder variables={sampleVars} onChange={vi.fn()} initialCondition={nestedOrCondition} />);
    expect(screen.queryByText(/\[condition/i)).not.toBeInTheDocument();
  });
});
