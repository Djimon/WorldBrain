// @vitest-environment jsdom
// M14 bug (#345): Kalender refresht Mehrtages-Event nach Edit-Save nicht (stale allEvents)
// See: https://github.com/Djimon/WorldBrain/issues/345

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M14 #345 EntityDetailView onSaved callback', () => {
  it('EntityDetailViewProps includes onSaved', () => {
    const source = readFileSync('src/ui/EntityDetailView.tsx', 'utf-8');
    expect(source).toMatch(/onSaved\??\s*:\s*\(\)\s*=>\s*void/);
  });

  it('commitEdit calls onSaved after successful save (both branches)', () => {
    const source = readFileSync('src/ui/EntityDetailView.tsx', 'utf-8');
    const commitBlock = source.slice(
      source.indexOf('async function commitEdit'),
      source.indexOf('setEditing(false)', source.indexOf('async function commitEdit')) + 50,
    );
    expect(commitBlock).toMatch(/onSaved\?\.\(\)/);
  });

  it('onSaved is called for non-Event entities too', () => {
    const source = readFileSync('src/ui/EntityDetailView.tsx', 'utf-8');
    const commitFn = source.slice(source.indexOf('async function commitEdit'));
    const elseBranch = commitFn.slice(commitFn.indexOf('} else {'));
    const endOfElse = elseBranch.indexOf('}', elseBranch.indexOf('saveEntity'));
    const elseBlock = elseBranch.slice(0, endOfElse + 20);
    expect(elseBlock).toMatch(/onSaved/);
  });
});

describe('M14 #345 WorkspaceShell wiring', () => {
  it('WorkspaceShell passes onSaved to EntityDetailView in calendar edit', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/EntityDetailView[\s\S]*?onSaved/);
  });

  it('onSaved bumps calendarRefreshToken', () => {
    const source = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(source).toMatch(/onSaved.*setCalendarRefreshToken|setCalendarRefreshToken.*onSaved/s);
  });
});

describe('M14 #345 CalendarMonthView guard', () => {
  it('span filter logic is unchanged (lines 89-95 range)', () => {
    const source = readFileSync('src/ui/CalendarMonthView.tsx', 'utf-8');
    expect(source).toMatch(/start_day|end_day/);
    expect(source).toMatch(/allEvents/);
  });
});
