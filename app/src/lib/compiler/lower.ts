type ParserNode = Record<string, any>;

export type LoweredProgram = {
  setup: LoweredLambda;
  draw: LoweredLambda;
};

export type LoweredLambda = {
  params: string[];
  body: LoweredStatement[];
};

export type LoweredStatement =
  | { kind: 'assign'; name: string; value: LoweredExpression }
  | { kind: 'expression'; value: LoweredExpression };

export type LoweredExpression =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'symbol'; value: string }
  | { kind: 'identifier'; name: string }
  | { kind: 'null' }
  | { kind: 'array'; items: LoweredExpression[] }
  | { kind: 'table'; columns: { name: string; value: LoweredExpression }[] }
  | { kind: 'call'; callee: LoweredExpression; args: LoweredExpression[] }
  | { kind: 'each'; callee: string; arg: LoweredExpression }
  | { kind: 'binary'; op: string; left: LoweredExpression; right: LoweredExpression }
  | { kind: 'cond'; branches: { condition: LoweredExpression; value: LoweredExpression }[]; elseValue: LoweredExpression };

export type LoweringResult = {
  program: LoweredProgram | null;
  diagnostics: CompileDiagnostic[];
  unsupported: string[];
};

const SUPPORTED_BINOPS = new Set(['!', '#', '*', '+', '-', '%', 'div', 'mod', '~', ',']);

export function lowerProgram(program: ParserNode): LoweringResult {
  const diagnostics: CompileDiagnostic[] = [];
  const unsupported = new Set<string>();

  if (!program || program.kind !== 'program' || !Array.isArray(program.statements)) {
    return {
      program: null,
      diagnostics: [{ severity: 'error', message: 'Expected a q program AST.', code: 'invalid-program', nodeKind: program?.kind }],
      unsupported: [],
    };
  }

  let setup: LoweredLambda | null = null;
  let draw: LoweredLambda | null = null;

  for (const statement of program.statements) {
    if (statement?.kind !== 'assign' || typeof statement.name !== 'string' || !statement.value) {
      pushUnsupported(diagnostics, unsupported, statement?.kind ?? 'unknown', 'Only top-level setup/draw assignments are supported.');
      continue;
    }

    if (statement.name !== 'setup' && statement.name !== 'draw') {
      pushUnsupported(diagnostics, unsupported, statement.name, `Top-level definition \`${statement.name}\` is not supported by the JS compiler yet.`);
      continue;
    }

    if (statement.value.kind !== 'lambda') {
      pushUnsupported(diagnostics, unsupported, statement.value.kind, `Top-level \`${statement.name}\` must be a lambda.`);
      continue;
    }

    const loweredLambda = lowerLambda(statement.value, diagnostics, unsupported);
    if (!loweredLambda) continue;

    if (statement.name === 'setup') setup = loweredLambda;
    if (statement.name === 'draw') draw = loweredLambda;
  }

  if (!setup) {
    diagnostics.push({ severity: 'error', message: 'Missing required `setup` lambda.', code: 'missing-setup', nodeKind: 'program' });
  }

  if (!draw) {
    diagnostics.push({ severity: 'error', message: 'Missing required `draw` lambda.', code: 'missing-draw', nodeKind: 'program' });
  }

  return {
    program: setup && draw && unsupported.size === 0 && !diagnostics.some((entry) => entry.severity === 'error') ? { setup, draw } : null,
    diagnostics,
    unsupported: [...unsupported],
  };
}

function lowerLambda(node: ParserNode, diagnostics: CompileDiagnostic[], unsupported: Set<string>): LoweredLambda | null {
  if (!Array.isArray(node.body)) {
    pushUnsupported(diagnostics, unsupported, node.kind, 'Lambda body must be a statement list.');
    return null;
  }

  const params = Array.isArray(node.params) ? node.params.filter((entry: unknown): entry is string => typeof entry === 'string') : [];
  const body = node.body
    .map((statement: ParserNode) => lowerStatement(statement, diagnostics, unsupported))
    .filter((entry): entry is LoweredStatement => Boolean(entry));

  return { params, body };
}

function lowerStatement(node: ParserNode, diagnostics: CompileDiagnostic[], unsupported: Set<string>): LoweredStatement | null {
  if (!node || typeof node !== 'object') {
    pushUnsupported(diagnostics, unsupported, 'unknown', 'Encountered an invalid statement node.');
    return null;
  }

  if (node.kind === 'assign') {
    return {
      kind: 'assign',
      name: String(node.name ?? ''),
      value: lowerExpression(node.value, diagnostics, unsupported),
    };
  }

  return {
    kind: 'expression',
    value: lowerExpression(node, diagnostics, unsupported),
  };
}

function lowerExpression(node: ParserNode, diagnostics: CompileDiagnostic[], unsupported: Set<string>): LoweredExpression {
  if (!node || typeof node !== 'object') {
    pushUnsupported(diagnostics, unsupported, 'unknown', 'Encountered an invalid expression node.');
    return { kind: 'null' };
  }

  if (isHexColorVector(node)) {
    return { kind: 'number', value: Number.parseInt(String(node.items[1].name).slice(1), 16) };
  }

  switch (node.kind) {
    case 'number':
      return { kind: 'number', value: parseQNumber(node.value) };
    case 'string':
      return { kind: 'string', value: String(node.value ?? '') };
    case 'symbol':
      return { kind: 'symbol', value: String(node.value ?? '') };
    case 'identifier':
      return node.name === 'null' ? { kind: 'null' } : { kind: 'identifier', name: String(node.name ?? '') };
    case 'group':
      return lowerExpression(node.value, diagnostics, unsupported);
    case 'vector':
    case 'list':
      return {
        kind: 'array',
        items: Array.isArray(node.items) ? node.items.map((entry: ParserNode) => lowerExpression(entry, diagnostics, unsupported)) : [],
      };
    case 'table':
      return {
        kind: 'table',
        columns: Array.isArray(node.columns)
          ? node.columns.map((column: ParserNode) => ({
              name: String(column.name ?? ''),
              value: lowerExpression(column.value, diagnostics, unsupported),
            }))
          : [],
      };
    case 'call':
      return {
        kind: 'call',
        callee: lowerExpression(node.callee, diagnostics, unsupported),
        args: Array.isArray(node.args) ? node.args.map((entry: ParserNode) => lowerExpression(entry, diagnostics, unsupported)) : [],
      };
    case 'each':
      if (node.callee?.kind !== 'identifier') {
        pushUnsupported(diagnostics, unsupported, node.kind, 'Only identifier-based each calls are supported.');
        return { kind: 'null' };
      }
      return {
        kind: 'each',
        callee: String(node.callee.name ?? ''),
        arg: lowerExpression(node.arg, diagnostics, unsupported),
      };
    case 'binary':
      if (!SUPPORTED_BINOPS.has(String(node.op ?? ''))) {
        pushUnsupported(diagnostics, unsupported, `binary:${String(node.op ?? 'unknown')}`, `Binary operator \`${String(node.op ?? 'unknown')}\` is not supported.`);
      }
      return {
        kind: 'binary',
        op: String(node.op ?? ''),
        left: lowerExpression(node.left, diagnostics, unsupported),
        right: lowerExpression(node.right, diagnostics, unsupported),
      };
    case 'cond':
      return {
        kind: 'cond',
        branches: Array.isArray(node.branches)
          ? node.branches.map((branch: ParserNode) => ({
              condition: lowerExpression(branch.condition, diagnostics, unsupported),
              value: lowerExpression(branch.value, diagnostics, unsupported),
            }))
          : [],
        elseValue: lowerExpression(node.elseValue, diagnostics, unsupported),
      };
    default:
      pushUnsupported(diagnostics, unsupported, node.kind, `Node kind \`${node.kind}\` is not supported by the JS compiler yet.`);
      return { kind: 'null' };
  }
}

function isHexColorVector(node: ParserNode) {
  return (
    node?.kind === 'vector' &&
    Array.isArray(node.items) &&
    node.items.length === 2 &&
    node.items[0]?.kind === 'number' &&
    parseQNumber(node.items[0].value) === 0 &&
    node.items[1]?.kind === 'identifier' &&
    /^x[0-9a-fA-F]+$/.test(String(node.items[1].name ?? ''))
  );
}

function parseQNumber(raw: unknown) {
  const text = String(raw ?? '').trim();
  const normalized = text.endsWith('f') ? text.slice(0, -1) : text;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function pushUnsupported(
  diagnostics: CompileDiagnostic[],
  unsupported: Set<string>,
  nodeKind: string,
  message: string
) {
  unsupported.add(nodeKind);
  diagnostics.push({
    severity: 'warning',
    message,
    code: 'unsupported-node',
    nodeKind,
  });
}
