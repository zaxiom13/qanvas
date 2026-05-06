export function normalizeQScript(source: string) {
  const statements: string[] = [];
  let buffer = '';
  let delimiterDepth = 0;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || (delimiterDepth === 0 && line.startsWith('/'))) {
      continue;
    }

    buffer = buffer ? `${buffer}\n${line}` : line;
    delimiterDepth += countChar(line, '{');
    delimiterDepth -= countChar(line, '}');
    delimiterDepth += countChar(line, '(');
    delimiterDepth -= countChar(line, ')');
    delimiterDepth += countChar(line, '[');
    delimiterDepth -= countChar(line, ']');

    if (delimiterDepth <= 0) {
      statements.push(stripTrailingStatementSemicolons(buffer));
      buffer = '';
      delimiterDepth = 0;
    }
  }

  if (buffer) {
    statements.push(stripTrailingStatementSemicolons(buffer));
  }

  return statements;
}

function stripTrailingStatementSemicolons(source: string) {
  return source.replace(/;\s*([\)\]])/g, '$1');
}

function countChar(value: string, target: string) {
  return [...value].filter((char) => char === target).length;
}
