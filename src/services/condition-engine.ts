export interface EvalContext {
  vars?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  flags?: Record<string, unknown>;
}

function getVar(path: string, ctx: EvalContext): unknown {
  const parts = path.split('.');
  const ns = parts[0];
  const key = parts.slice(1).join('.');

  let source: Record<string, unknown> | undefined;
  if (ns === 'vars') source = ctx.vars;
  else if (ns === 'globals') source = ctx.globals;
  else if (ns === 'flags') source = ctx.flags;
  else return ctx.vars?.[path];

  if (!source) return undefined;
  return key ? source[key] : source;
}

function evalNode(node: unknown, ctx: EvalContext): unknown {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return node;
  }

  const obj = node as Record<string, unknown>;
  const op = Object.keys(obj)[0];
  const rawArgs = obj[op];

  if (op === 'var') {
    const varPath = Array.isArray(rawArgs) ? String(rawArgs[0]) : String(rawArgs);
    return getVar(varPath, ctx);
  }

  const args = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

  if (op === '==') return evalNode(args[0], ctx) === evalNode(args[1], ctx);
  if (op === '!=') return evalNode(args[0], ctx) !== evalNode(args[1], ctx);
  if (op === '>') return (evalNode(args[0], ctx) as number) > (evalNode(args[1], ctx) as number);
  if (op === '>=') return (evalNode(args[0], ctx) as number) >= (evalNode(args[1], ctx) as number);
  if (op === '<') return (evalNode(args[0], ctx) as number) < (evalNode(args[1], ctx) as number);
  if (op === '<=') return (evalNode(args[0], ctx) as number) <= (evalNode(args[1], ctx) as number);

  if (op === 'and') return args.every((a) => Boolean(evalNode(a, ctx)));
  if (op === 'or') return args.some((a) => Boolean(evalNode(a, ctx)));
  if (op === '!') return !Boolean(evalNode(args[0], ctx));

  if (op === '+') return (evalNode(args[0], ctx) as number) + (evalNode(args[1], ctx) as number);
  if (op === '-') return (evalNode(args[0], ctx) as number) - (evalNode(args[1], ctx) as number);
  if (op === '*') return (evalNode(args[0], ctx) as number) * (evalNode(args[1], ctx) as number);
  if (op === '/') return (evalNode(args[0], ctx) as number) / (evalNode(args[1], ctx) as number);

  return undefined;
}

export function evaluate(condition: unknown, ctx: EvalContext): boolean {
  return Boolean(evalNode(condition, ctx));
}
