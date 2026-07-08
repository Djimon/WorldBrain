// M9-S02: Formel-Engine für System-Felder (EPIC-014)
// Parses a formula string into the condition-engine AST and evaluates it via the
// shared numeric evaluator — no dynamic code execution. Computed schema fields
// reference other entity fields by name.

import { evaluateNumber, SUPPORTED_FUNCTION_OPS } from './condition-engine';

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'cmp';
interface Token {
  type: TokenType;
  value: string;
}

// M9-S09: comparison operators, longest-match first (==, !=, >=, <= before >, <).
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if ((c >= '0' && c <= '9') || c === '.') {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      tokens.push({ type: 'num', value: num });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) id += input[i++];
      tokens.push({ type: 'ident', value: id });
      continue;
    }
    if (c === '=' && input[i + 1] === '=') { tokens.push({ type: 'cmp', value: '==' }); i += 2; continue; }
    if (c === '!' && input[i + 1] === '=') { tokens.push({ type: 'cmp', value: '!=' }); i += 2; continue; }
    if (c === '>' && input[i + 1] === '=') { tokens.push({ type: 'cmp', value: '>=' }); i += 2; continue; }
    if (c === '<' && input[i + 1] === '=') { tokens.push({ type: 'cmp', value: '<=' }); i += 2; continue; }
    if (c === '>') { tokens.push({ type: 'cmp', value: '>' }); i++; continue; }
    if (c === '<') { tokens.push({ type: 'cmp', value: '<' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen', value: c }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen', value: c }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma', value: c }); i++; continue; }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

// Surface function names that map to a different condition-engine AST key.
const FUNCTION_NAME_ALIASES: Record<string, string> = { not: '!' };

// Recursive-descent parser → condition-engine AST nodes. Exported (in addition
// to evaluateFormula) so callers/tests can distinguish a parse-time rejection
// from a silent undefined-evaluation (#221).
export function parseFormula(input: string): unknown {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];
  const expect = (type: TokenType): void => {
    const t = next();
    if (!t || t.type !== type) throw new Error(`Expected ${type}`);
  };

  // M9-S09: comparison binds looser than arithmetic — a single (non-chaining)
  // comparison wraps a full +/- expression on each side.
  function parseComparison(): unknown {
    const left = parseExpr();
    if (peek()?.type === 'cmp') {
      const op = next()!.value;
      const right = parseExpr();
      return { [op]: [left, right] };
    }
    return left;
  }

  function parseExpr(): unknown {
    let left = parseTerm();
    while (peek()?.type === 'op' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = next()!.value;
      left = { [op]: [left, parseTerm()] };
    }
    return left;
  }

  function parseTerm(): unknown {
    let left = parseFactor();
    while (peek()?.type === 'op' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = next()!.value;
      left = { [op]: [left, parseFactor()] };
    }
    return left;
  }

  function parseFactor(): unknown {
    const t = peek();
    if (!t) throw new Error('Unexpected end of formula');
    if (t.type === 'op' && t.value === '-') { next(); return { '-': [0, parseFactor()] }; }
    if (t.type === 'op' && t.value === '+') { next(); return parseFactor(); }
    if (t.type === 'num') { next(); return Number(t.value); }
    if (t.type === 'lparen') { next(); const e = parseComparison(); expect('rparen'); return e; }
    if (t.type === 'ident') {
      next();
      if (peek()?.type === 'lparen') {
        next();
        const args: unknown[] = [];
        if (peek()?.type !== 'rparen') {
          args.push(parseComparison());
          while (peek()?.type === 'comma') { next(); args.push(parseComparison()); }
        }
        expect('rparen');
        const key = FUNCTION_NAME_ALIASES[t.value] ?? t.value;
        // #221: parser grammar must not exceed the evaluator's op-list — an
        // unknown/typo'd function name is a parse-time error, not a silent
        // undefined-evaluation.
        if (!(SUPPORTED_FUNCTION_OPS as readonly string[]).includes(key)) {
          throw new Error(`Unknown function: ${t.value}`);
        }
        return { [key]: args };
      }
      return { var: t.value };
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }

  const result = parseComparison();
  if (pos !== tokens.length) throw new Error('Trailing tokens');
  return result;
}

/**
 * Evaluate a formula string against a flat field context. Returns null on any
 * error (malformed formula, unknown field, division by zero) — never throws.
 */
export function evaluateFormula(formula: string, context: Record<string, number>): number | null {
  let ast: unknown;
  try {
    ast = parseFormula(formula);
  } catch {
    return null;
  }
  return evaluateNumber(ast, { vars: context });
}

/**
 * Evaluate a computed schema field (`{ computed: true, formula: '…' }`) against
 * an entity's field values. Non-computed / formula-less fields return null.
 */
export function evaluateFormulaField(
  fieldDef: { computed?: boolean; formula?: string },
  entity: Record<string, number>,
): number | null {
  // Only computed fields with a formula are evaluated (M9-S02 / #218).
  if (!fieldDef.computed || !fieldDef.formula) return null;
  return evaluateFormula(fieldDef.formula, entity);
}

// M9-S07: lookup derived-type (EPIC-014 decision 13) — a computed field is
// either `formula` (arithmetic) or `lookup` (table lookup by key). Tables are
// declarative plugin data, not a new engine operator.

export interface LookupFieldDef {
  computed?: boolean;
  lookup?: { table: string; key_field: string; mode: 'threshold' | 'exact' };
}

/**
 * Resolve a value from a table by numeric key. `exact` requires a matching
 * key; `threshold` picks the largest table key ≤ the given key (e.g. D&D
 * Proficiency Bonus by level). Empty table or no matching/qualifying key
 * returns null — never throws.
 */
export function resolveLookup(
  table: Record<string, number>,
  key: number,
  mode: 'threshold' | 'exact',
): number | null {
  const keys = Object.keys(table)
    .map(Number)
    .filter((k) => !Number.isNaN(k));
  if (keys.length === 0) return null;

  if (mode === 'exact') {
    return keys.includes(key) ? table[String(key)] : null;
  }

  const candidates = keys.filter((k) => k <= key);
  if (candidates.length === 0) return null;
  const chosen = Math.max(...candidates);
  return table[String(chosen)];
}

export function evaluateLookupField(
  fieldDef: LookupFieldDef,
  entity: Record<string, number>,
  tables: Record<string, Record<string, number>>,
): number | null {
  if (!fieldDef.lookup) return null;
  const { table: tableName, key_field, mode } = fieldDef.lookup;
  const table = tables[tableName];
  if (!table) return null;
  const key = entity[key_field];
  if (key === undefined) return null;
  return resolveLookup(table, key, mode);
}

// M9-S10: two-key lookup (EPIC-014 decision 19) — e.g. spell slots by
// class × level. The 1D key_field/mode API above is untouched and stays
// fully compatible.

export interface LookupFieldDef2D {
  computed?: boolean;
  lookup?: {
    table: string;
    key_fields: [string, string];
    modes: ['threshold' | 'exact', 'threshold' | 'exact'];
  };
}

// Resolve a single dimension by mode: exact does a direct key lookup (works
// for non-numeric keys like class names); threshold picks the largest
// numeric key <= the given key. Returns null on no match — never throws.
function lookupDimension<T>(
  table: Record<string, T>,
  key: number | string,
  mode: 'threshold' | 'exact',
): T | null {
  if (mode === 'exact') {
    return Object.prototype.hasOwnProperty.call(table, String(key)) ? table[String(key)] : null;
  }
  const numKey = Number(key);
  if (Number.isNaN(numKey)) return null;
  const numericKeys = Object.keys(table)
    .map(Number)
    .filter((k) => !Number.isNaN(k));
  if (numericKeys.length === 0) return null;
  const candidates = numericKeys.filter((k) => k <= numKey);
  if (candidates.length === 0) return null;
  const chosen = Math.max(...candidates);
  return table[String(chosen)];
}

export function resolveLookup2D(
  table: Record<string, Record<string, number>>,
  keys: [string | number, string | number],
  modes: ['threshold' | 'exact', 'threshold' | 'exact'],
): number | null {
  const outer = lookupDimension(table, keys[0], modes[0]);
  if (outer === null) return null;
  return lookupDimension(outer, keys[1], modes[1]);
}

export function evaluateLookupField2D(
  fieldDef: LookupFieldDef2D,
  entity: Record<string, number | string>,
  tables: Record<string, Record<string, Record<string, number>>>,
): number | null {
  if (!fieldDef.lookup) return null;
  const { table: tableName, key_fields, modes } = fieldDef.lookup;
  const table = tables[tableName];
  if (!table) return null;
  const keyA = entity[key_fields[0]];
  const keyB = entity[key_fields[1]];
  if (keyA === undefined || keyB === undefined) return null;
  return resolveLookup2D(table, [keyA, keyB], modes);
}

export type ComputedFieldDef = {
  computed?: boolean;
  formula?: string;
  lookup?: LookupFieldDef['lookup'];
};

// Collect `{ var: name }` references from a parsed formula AST.
function collectFormulaRefs(node: unknown, out: Set<string>): void {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
  const obj = node as Record<string, unknown>;
  const op = Object.keys(obj)[0];
  const args = obj[op];
  if (op === 'var') {
    out.add(String(args));
    return;
  }
  for (const arg of Array.isArray(args) ? args : [args]) {
    collectFormulaRefs(arg, out);
  }
}

function computedFieldDependencies(formula: string, knownFields: Set<string>): string[] {
  let ast: unknown;
  try {
    ast = parseFormula(formula);
  } catch {
    return [];
  }
  const refs = new Set<string>();
  collectFormulaRefs(ast, refs);
  return [...refs].filter((name) => knownFields.has(name));
}

/**
 * Resolve a set of computed fields (formula and/or lookup) against an entity
 * and plugin tables. Formula fields may reference other computed fields
 * (decision 12) — dependencies are resolved in topological order. A field
 * involved in a circular dependency resolves to null instead of looping
 * infinitely; it is never evaluated.
 */
export function resolveComputedFields(
  fields: Record<string, ComputedFieldDef>,
  entity: Record<string, number>,
  tables: Record<string, Record<string, number>>,
): Record<string, number | null> {
  const fieldNames = new Set(Object.keys(fields));
  const deps: Record<string, string[]> = {};
  for (const [name, def] of Object.entries(fields)) {
    deps[name] = def.formula ? computedFieldDependencies(def.formula, fieldNames) : [];
  }

  // Cycle detection via DFS with a recursion stack.
  const state: Record<string, 'unvisited' | 'visiting' | 'done'> = {};
  for (const name of fieldNames) state[name] = 'unvisited';
  const inCycle = new Set<string>();

  function detectCycles(name: string, stack: string[]): void {
    if (state[name] === 'done') return;
    if (state[name] === 'visiting') {
      const cycleStart = stack.indexOf(name);
      for (const cyclic of stack.slice(cycleStart)) inCycle.add(cyclic);
      return;
    }
    state[name] = 'visiting';
    stack.push(name);
    for (const dep of deps[name] ?? []) detectCycles(dep, stack);
    stack.pop();
    state[name] = 'done';
  }
  for (const name of fieldNames) detectCycles(name, []);

  // Topological order (postorder DFS), skipping cyclic fields entirely.
  const order: string[] = [];
  const ordered = new Set<string>();
  function topoVisit(name: string): void {
    if (ordered.has(name) || inCycle.has(name)) return;
    ordered.add(name);
    for (const dep of deps[name] ?? []) {
      if (!inCycle.has(dep)) topoVisit(dep);
    }
    order.push(name);
  }
  for (const name of fieldNames) topoVisit(name);

  const result: Record<string, number | null> = {};
  for (const name of inCycle) result[name] = null;

  const resolvedValues: Record<string, number> = {};
  for (const name of order) {
    const def = fields[name];
    let value: number | null = null;
    if (def.lookup) {
      value = evaluateLookupField(def, entity, tables);
    } else if (def.formula) {
      value = evaluateFormula(def.formula, { ...entity, ...resolvedValues });
    }
    result[name] = value;
    if (value !== null) resolvedValues[name] = value;
  }

  return result;
}
