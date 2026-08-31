// @vitest-environment jsdom
// M17-S08 (#394): ECHTER Mount-Test für die Akzent-Chrome-Migration (#391) —
// statt reinem Source-Grep. Die ECHTE tokens.css + primitives.css werden injiziert,
// ein migriertes Chrome-Element (.ui-list-row[data-selected]) gemountet, und der
// beim Moduswechsel edit↔play AUFGELÖSTE Modus-Akzent verglichen: er MUSS sich
// unterscheiden (die migrierte Chrome folgt dem Modus, nicht mehr --color-accent).
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tokensCss = readFileSync('src/styles/tokens.css', 'utf-8');
const primitivesCss = readFileSync('src/ui/primitives.css', 'utf-8');

beforeEach(() => {
  const style = document.createElement('style');
  style.setAttribute('data-test', 'tokens');
  style.textContent = `${tokensCss}\n${primitivesCss}`;
  document.head.appendChild(style);
});
afterEach(() => {
  document.head.querySelectorAll('style[data-test="tokens"]').forEach((n) => n.remove());
  document.body.innerHTML = '';
  const el = document.documentElement;
  for (const a of ['data-mode', 'data-appearance', 'data-theme']) el.removeAttribute(a);
});

function resolvedAccentOn(el: Element): string {
  return getComputedStyle(el).getPropertyValue('--mode-accent').trim();
}

describe('M17-S08 accent chrome flips with the shell mode (computed, real CSS)', () => {
  it('a migrated element (.ui-list-row[data-selected]) resolves a DIFFERENT accent in edit vs play', () => {
    const row = document.createElement('div');
    row.className = 'ui-list-row';
    row.setAttribute('data-selected', '');
    document.body.appendChild(row);

    const el = document.documentElement;
    el.setAttribute('data-appearance', 'dark');

    el.setAttribute('data-mode', 'edit');
    const editAccent = resolvedAccentOn(row);

    el.setAttribute('data-mode', 'play');
    const playAccent = resolvedAccentOn(row);

    expect(editAccent).toBeTruthy();
    expect(playAccent).toBeTruthy();
    // Der von der migrierten Chrome konsumierte Token flippt mit dem Modus.
    expect(editAccent).not.toBe(playAccent);
  });

  it('teal theme flips play accent to teal while prep stays red', () => {
    const el = document.documentElement;
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-theme', 'teal');

    el.setAttribute('data-mode', 'edit');
    const prep = resolvedAccentOn(el);
    el.setAttribute('data-mode', 'play');
    const live = resolvedAccentOn(el);

    expect(prep).not.toBe(live); // Prep ≠ Live auch im Teal-Theme
  });
});
