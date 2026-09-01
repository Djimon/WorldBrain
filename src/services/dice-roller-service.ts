// M10-S16 (#362): dice roller + per-roll visibility (D17).
// Generic dNN roller (e.g. `2d6+3`). Per roll the roller carries a
// visibility — Private / DM only / All. The actual routing logic
// (who sees what in the combat log) lives server/host-side; here is the
// roll primitive plus result structure incl. `visibility` field for the
// downstream distribution.

export type DiceVisibility = 'private' | 'dm_only' | 'all';

export interface DiceExpression {
  count: number;
  sides: number;
  modifier: number;
}

export interface RollOptions {
  visibility?: DiceVisibility;
}

export interface RollResult {
  expression: string;
  dice: number[];
  modifier: number;
  total: number;
  visibility: DiceVisibility;
}

const EXPR_RE = /^\s*(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i;

export function parseDiceExpression(expr: string): DiceExpression {
  const m = EXPR_RE.exec(expr);
  if (m === null) throw new Error(`Invalid dice expression: ${expr}`);
  const count = Number.parseInt(m[1], 10);
  const sides = Number.parseInt(m[2], 10);
  const modifier = m[3] !== undefined ? Number.parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  if (count < 1 || sides < 2) throw new Error(`Invalid dice expression: ${expr}`);
  return { count, sides, modifier };
}

function rollDie(sides: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // Modulo bias negligible for the usual dice sizes (n << 2^32).
  return (buf[0] % sides) + 1;
}

export async function roll(expression: string, options: RollOptions = {}): Promise<RollResult> {
  const parsed = parseDiceExpression(expression);
  const dice: number[] = [];
  for (let i = 0; i < parsed.count; i += 1) dice.push(rollDie(parsed.sides));
  const sum = dice.reduce((a, b) => a + b, 0) + parsed.modifier;
  return {
    expression,
    dice,
    modifier: parsed.modifier,
    total: sum,
    visibility: options.visibility ?? 'all',
  };
}
