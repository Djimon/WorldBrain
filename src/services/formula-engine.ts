// M9-S02: Formel-Engine für System-Felder (EPIC-014)
// Parses a formula string into the condition-engine AST and evaluates it via the
// shared numeric evaluator — no dynamic code execution. Computed schema fields
// reference other entity fields by name.

import { evaluateNumber } from './condition-engine';

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma';
interface Token {
  type: TokenType;
  value: string;
}

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
    if (c === '+' || c === '-' || c === '*' || c === '/') { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen', value: c }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen', value: c }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma', value: c }); i++; continue; }
    throw new Error(`Unexpected character: ${c}`);
  }
  return tokens;
}

// Recursive-descent parser → condition-engine AST nodes.
function parseFormula(input: string): unknown {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token | undefined => tokens[pos++];
  const expect = (type: TokenType): void => {
    const t = next();
    if (!t || t.type !== type) throw new Error(`Expected ${type}`);
  };

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
    if (t.type === 'lparen') { next(); const e = parseExpr(); expect('rparen'); return e; }
    if (t.type === 'ident') {
      next();
      if (peek()?.type === 'lparen') {
        next();
        const args: unknown[] = [];
        if (peek()?.type !== 'rparen') {
          args.push(parseExpr());
          while (peek()?.type === 'comma') { next(); args.push(parseExpr()); }
        }
        expect('rparen');
        return { [t.value]: args };
      }
      return { var: t.value };
    }
    throw new Error(`Unexpected token: ${t.value}`);
  }

  const result = parseExpr();
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
  if (!fieldDef.formula) return null;
  return evaluateFormula(fieldDef.formula, entity);
}
