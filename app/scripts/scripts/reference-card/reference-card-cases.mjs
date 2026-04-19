import { spawnSync } from 'node:child_process';

const HOST_SENSITIVE_PATTERN = /\b(?:getenv|setenv|system|hopen|hclose|hcount|hdel|read0|read1|save|load)\b/;
const TOP_LEVEL_ASSIGNMENT_PATTERN =
  /^(?:\.[A-Za-z][\w.]*(?:\[[^\]]*\])?|[A-Za-z][\w]*(?:\[[^\]]*\])?)\s*(?:[-+*%&,|^#_?$!~]?|::):/;

export function buildReferenceCardCases(page, { probeQ = probeQExpression } = {}) {
  const cases = [];
  const pageHistory = [];

  for (const block of page.blocks ?? []) {
    const { cases: blockCases, executedExpressions } = buildBlockCases(block, pageHistory, { probeQ });
    cases.push(...blockCases);
    pageHistory.push(...executedExpressions);
  }

  return cases;
}

function buildBlockCases(block, pageHistory, { probeQ }) {
  if (/^q\)/m.test(String(block.code ?? ''))) {
    return buildTranscriptCases(block, pageHistory, { probeQ });
  }

  return buildSnippetCases(block, pageHistory, { probeQ });
}

function buildTranscriptCases(block, pageHistory, { probeQ }) {
  const cases = [];
  const executedExpressions = [];
  const localHistory = [...pageHistory];

  for (const entry of parseTranscriptBlock(block.code)) {
    const expression = entry.code.trim();
    const assertion = classifyTranscriptExpression(expression, entry.expectedOutput, localHistory, { probeQ });

    cases.push({
      id: `${block.id}-${entry.id}`,
      sourceBlockId: block.id,
      sourceKind: 'transcript',
      setup: [...localHistory],
      code: expression,
      assertion,
    });

    if (assertion.kind !== 'skip') {
      localHistory.push(expression);
      executedExpressions.push(expression);
    }
  }

  return { cases, executedExpressions };
}

function buildSnippetCases(block, pageHistory, { probeQ }) {
  const cases = [];
  const executedExpressions = [];
  const localHistory = [...pageHistory];
  const lines = String(block.code ?? '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      cases: [
        {
          id: `${block.id}-expr-001`,
          sourceBlockId: block.id,
          sourceKind: 'snippet',
          setup: [...localHistory],
          code: '',
          assertion: {
            kind: 'skip',
            reason: 'empty block',
          },
        },
      ],
      executedExpressions,
    };
  }

  const candidates = lines.length === 1
    ? [{ id: 'expr-001', code: stripDocComment(lines[0]) }]
    : lines.map((line, index) => ({
        id: `expr-${String(index + 1).padStart(3, '0')}`,
        code: stripDocComment(line),
      }));

  for (const candidate of candidates) {
    const expression = candidate.code.trim();
    const assertion = classifySnippetExpression(expression, localHistory, { probeQ });

    cases.push({
      id: `${block.id}-${candidate.id}`,
      sourceBlockId: block.id,
      sourceKind: 'snippet',
      setup: [...localHistory],
      code: expression,
      assertion,
    });

    if (assertion.kind !== 'skip') {
      localHistory.push(expression);
      executedExpressions.push(expression);
    }
  }

  return { cases, executedExpressions };
}

function classifyTranscriptExpression(expression, expectedOutput, setup, { probeQ }) {
  if (!expression) {
    return {
      kind: 'skip',
      reason: 'empty transcript command',
    };
  }

  if (expression.startsWith('\\')) {
    return {
      kind: 'skip',
      reason: 'q directive is not portable in automated tests',
    };
  }

  if (expression.startsWith('/')) {
    return {
      kind: 'skip',
      reason: 'comment-only transcript command',
    };
  }

  if (isHostSensitiveExpression(expression)) {
    return {
      kind: 'skip',
      reason: 'host-sensitive command requires local environment or I/O',
    };
  }

  const probe = probeQ(setup, expression);
  if (probe.timedOut) {
    return {
      kind: 'skip',
      reason: 'q oracle timed out for this example',
    };
  }
  if (probe.status !== 0 || probe.stderr.length > 0) {
    return {
      kind: 'skip',
      reason: probe.stderr || `q exited with status ${probe.status}`,
    };
  }

  if (expectedOutput.length > 0) {
    return {
      kind: 'doc-output',
      expectedOutput,
    };
  }

  if (looksStateChangingExpression(expression)) {
    return {
      kind: 'state-change',
    };
  }

  return {
    kind: 'differential',
  };
}

function classifySnippetExpression(expression, setup, { probeQ }) {
  if (!expression) {
    return {
      kind: 'skip',
      reason: 'empty snippet line',
    };
  }

  if (expression.startsWith('/')) {
    return {
      kind: 'skip',
      reason: 'comment-only snippet line',
    };
  }

  if (isHostSensitiveExpression(expression)) {
    return {
      kind: 'skip',
      reason: 'host-sensitive command requires local environment or I/O',
    };
  }

  if (looksLikeReferenceGlossary(expression)) {
    return {
      kind: 'skip',
      reason: 'reference glossary entry is not a standalone executable example',
    };
  }

  const probe = probeQ(setup, expression);
  if (probe.timedOut) {
    return {
      kind: 'skip',
      reason: 'q oracle timed out for this example',
    };
  }
  if (probe.status !== 0 || probe.stderr.length > 0) {
    return {
      kind: 'skip',
      reason: probe.stderr || `q exited with status ${probe.status}`,
    };
  }

  if (looksStateChangingExpression(expression) && probe.stdout.length === 0) {
    return {
      kind: 'state-change',
    };
  }

  return {
    kind: 'differential',
  };
}

function stripDocComment(line) {
  return String(line ?? '').replace(/\s+\/.*$/, '').trimEnd();
}

function looksLikeReferenceGlossary(expression) {
  if (/^[<>:=\\/'"*+%&|,^#!?@~_-]+$/.test(expression)) {
    return true;
  }

  if (/^[A-Za-z.]+$/.test(expression) && !expression.startsWith('.')) {
    return true;
  }

  return false;
}

function looksStateChangingExpression(expression) {
  return TOP_LEVEL_ASSIGNMENT_PATTERN.test(expression);
}

function isHostSensitiveExpression(expression) {
  return HOST_SENSITIVE_PATTERN.test(expression);
}

export function parseTranscriptBlock(code) {
  const entries = [];
  let current = null;

  for (const rawLine of String(code ?? '').split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.startsWith('q)')) {
      if (current) {
        entries.push(current);
      }

      current = {
        code: stripDocComment(line.slice(2).trim()),
        outputLines: [],
      };
      continue;
    }

    if (current) {
      current.outputLines.push(rawLine);
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries.map((entry, index) => ({
    id: `expr-${String(index + 1).padStart(3, '0')}`,
    code: entry.code,
    expectedOutput: normalizeTranscriptOutput(entry.outputLines),
  }));
}

export function buildQInput(setup, code) {
  const history = (setup ?? []).filter((statement) => String(statement ?? '').trim().length > 0);
  const program = history.length > 0
    ? `${history.join(';\n')};\n${String(code ?? '').trim()}\n`
    : `${String(code ?? '').trim()}\n`;

  return program;
}

export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trimEnd();
}

export function probeQExpression(setup, code) {
  const result = spawnSync('q', ['-q'], {
    encoding: 'utf8',
    input: buildQInput(setup, code),
    timeout: 1000,
    killSignal: 'SIGKILL',
    maxBuffer: 1024 * 1024 * 4,
  });

  return {
    status: result.status ?? (result.error ? -1 : -1),
    stdout: normalizeText(result.stdout),
    stderr: normalizeText(result.stderr || result.error?.message || ''),
    timedOut:
      result.error?.code === 'ETIMEDOUT' ||
      result.signal === 'SIGKILL' ||
      /timed out/i.test(result.error?.message || ''),
  };
}

function normalizeTranscriptOutput(lines) {
  const trimmedLines = [...lines];

  while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1].trim() === '') {
    trimmedLines.pop();
  }

  return normalizeText(
    trimmedLines
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
  );
}
