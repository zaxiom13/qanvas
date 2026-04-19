import { parse } from '@qpad/engine';

export type CompiledOutputView = {
  status: 'ok' | 'error';
  meta: string;
  output: string;
};

let lastSource = '';
let lastResult: CompiledOutputView | null = null;

export function getCompiledOutputView(source: string): CompiledOutputView {
  if (lastResult && source === lastSource) {
    return lastResult;
  }

  try {
    const program = parse(source);
    const statements =
      program && typeof program === 'object' && 'statements' in program && Array.isArray(program.statements)
        ? program.statements
        : [];
    const statementCount = statements.length;
    lastResult = {
      status: 'ok',
      meta: `Parser AST • ${statementCount} statement${statementCount === 1 ? '' : 's'}`,
      output: JSON.stringify(
        {
          representation: 'parser-ast',
          generatedJavaScriptAvailable: false,
          note: 'The q engine does not expose generated JavaScript, so this view shows the parsed program tree used before evaluation.',
          program,
        },
        null,
        2
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastResult = {
      status: 'error',
      meta: 'Parse error',
      output: JSON.stringify(
        {
          representation: 'parser-ast',
          generatedJavaScriptAvailable: false,
          error: message,
        },
        null,
        2
      ),
    };
  }

  lastSource = source;
  return lastResult;
}
