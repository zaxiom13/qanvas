import { parse } from '@qpad/engine';
import { lowerProgram, type LoweredExpression, type LoweredLambda, type LoweredProgram, type LoweredStatement } from './lower';

export function compileSketch(source: string): CompiledSketchResult {
  try {
    const program = parse(source);
    const lowered = lowerProgram(program as Record<string, unknown>);

    if (!lowered.program) {
      const status = lowered.diagnostics.some((entry) => entry.severity === 'error') ? 'error' : 'unsupported';
      return {
        status,
        backend: 'interpreter',
        code: null,
        diagnostics: lowered.diagnostics,
        unsupported: lowered.unsupported,
        metadata: { runtimeVersion: 'compiled-js-v1', sourceHash: hashSource(source) },
      };
    }

    return {
      status: 'compiled',
      backend: 'compiled-js',
      code: emitProgram(lowered.program),
      diagnostics: lowered.diagnostics,
      unsupported: lowered.unsupported,
      metadata: { runtimeVersion: 'compiled-js-v1', sourceHash: hashSource(source) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      backend: 'interpreter',
      code: null,
      diagnostics: [{ severity: 'error', message, code: 'parse-error', nodeKind: 'program' }],
      unsupported: [],
      metadata: { runtimeVersion: 'compiled-js-v1', sourceHash: hashSource(source) },
    };
  }
}

function emitProgram(program: LoweredProgram) {
  return `(() => {
  const Color = rtColors();
  function rtColors() {
    return {
      INK: 0x0D0D1F,
      NIGHT: 0x05060C,
      MIDNIGHT: 0x0B0D1A,
      DEEP: 0x081028,
      BLUE: 0x5B6FE8,
      SKY: 0x7CA6FF,
      GOLD: 0xC4956E,
      CORAL: 0xE07A52,
      RED: 0xD1694E,
      PURPLE: 0x8C6BC9,
      GREEN: 0x4E9F92,
      CREAM: 0xF4ECD8,
      YELLOW: 0xFFE2A0,
      SOFT_YELLOW: 0xFFE2B8,
      LAVENDER: 0xE4B7FF,
      ORBIT: 0x26294A
    };
  }
  return ({
  setup(rt) {
${emitLambdaBody(program.setup, 2)}
  },
  draw(state, frameInfo, input, canvas, rt) {
${emitLambdaBody(program.draw, 2)}
  }
  });
})()`;
}

function emitLambdaBody(lambda: LoweredLambda, indentLevel: number) {
  const lines: string[] = [];
  const ind = indent(indentLevel);

  for (const [index, statement] of lambda.body.entries()) {
    const last = index === lambda.body.length - 1;
    lines.push(...emitStatement(statement, ind, last));
  }

  if (!lambda.body.length) {
    lines.push(`${ind}return null;`);
  }

  return lines.join('\n');
}

function emitStatement(statement: LoweredStatement, ind: string, last: boolean) {
  if (statement.kind === 'assign') {
    const keyword = last ? 'const' : 'const';
    const line = `${ind}${keyword} ${statement.name} = ${emitExpression(statement.value)};`;
    return last ? [line, `${ind}return ${statement.name};`] : [line];
  }

  return [`${ind}${last ? 'return ' : ''}${emitExpression(statement.value)};`];
}

function emitExpression(expression: LoweredExpression): string {
  switch (expression.kind) {
    case 'number':
      return Number.isInteger(expression.value) ? String(expression.value) : JSON.stringify(expression.value);
    case 'string':
    case 'symbol':
      return JSON.stringify(expression.value);
    case 'identifier':
      return expression.name;
    case 'null':
      return 'null';
    case 'array':
      return `[${expression.items.map((item) => emitExpression(item)).join(', ')}]`;
    case 'table':
      return `rt.table({ ${expression.columns.map((column) => `${JSON.stringify(column.name)}: ${emitExpression(column.value)}`).join(', ')} })`;
    case 'binary':
      return `rt.op(${JSON.stringify(expression.op)}, ${emitExpression(expression.left)}, ${emitExpression(expression.right)})`;
    case 'cond':
      return `rt.cond([${expression.branches
        .map((branch) => `{ condition: ${emitExpression(branch.condition)}, value: ${emitExpression(branch.value)} }`)
        .join(', ')}], ${emitExpression(expression.elseValue)})`;
    case 'each':
      return `rt.each(${JSON.stringify(expression.callee)}, ${emitExpression(expression.arg)})`;
    case 'call':
      return emitCallExpression(expression);
  }
}

function emitCallExpression(expression: Extract<LoweredExpression, { kind: 'call' }>) {
  // Parser can surface dyadic `~` (match) as an implicit call with callee identifier `~`.
  if (expression.callee.kind === 'identifier' && expression.callee.name === '~') {
    if (expression.args.length === 1) {
      return `rt.op("~", null, ${emitExpression(expression.args[0]!)})`;
    }
    if (expression.args.length === 2) {
      return `rt.op("~", ${emitExpression(expression.args[0]!)}, ${emitExpression(expression.args[1]!)})`;
    }
  }

  const builtinName = expression.callee.kind === 'identifier' ? expression.callee.name : null;
  const args = `[${expression.args.map((entry) => emitExpression(entry)).join(', ')}]`;

  if (builtinName && isBuiltinCall(builtinName)) {
    return `rt.callBuiltin(${JSON.stringify(builtinName)}, ${args})`;
  }

  return `rt.call(${emitExpression(expression.callee)}, ${builtinName ? JSON.stringify(builtinName) : 'null'}, ${args})`;
}

function isBuiltinCall(name: string) {
  return BUILTIN_CALLS.has(name) || isDerivedPrimitiveAdverb(name);
}

function isDerivedPrimitiveAdverb(name: string) {
  return /^[+\-*%&|,][/\\]$/.test(name);
}

const BUILTIN_CALLS = new Set([
  'background',
  'circle',
  'rect',
  'line',
  'text',
  'image',
  'first',
  'last',
  'count',
  'til',
  'floor',
  'ceiling',
  'flip',
  'enlist',
  'raze',
  'reverse',
  'sum',
  'prd',
  'sums',
  'prds',
  'mins',
  'maxs',
  'avgs',
  'avg',
  'min',
  'max',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'abs',
  'exp',
  'log',
  'neg',
  'reciprocal',
  'signum',
]);

function indent(level: number) {
  return '  '.repeat(level);
}

function hashSource(source: string) {
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
