import { compileSketch } from './compile';

export type CompiledOutputView = CompiledSketchResult & {
  meta: string;
  output: string;
};

let lastSource = '';
let lastResult: CompiledOutputView | null = null;

export function getCompiledOutputView(source: string): CompiledOutputView {
  if (lastResult && source === lastSource) {
    return lastResult;
  }

  const compiled = compileSketch(source);
  const summary = compiled.status === 'compiled'
    ? 'Compiled JS'
    : compiled.status === 'error'
      ? 'Compile error'
      : 'Unsupported feature';

  lastResult = {
    ...compiled,
    meta: `${summary} • ${compiled.code ? compiled.backend : 'Fallback: interpreter'}`,
    output: compiled.code
      ? compiled.code
      : JSON.stringify(
          {
            status: compiled.status,
            backend: compiled.backend,
            diagnostics: compiled.diagnostics,
            unsupported: compiled.unsupported,
            metadata: compiled.metadata,
          },
          null,
          2
        ),
  };

  lastSource = source;
  return lastResult;
}

export { compileSketch } from './compile';
