import type { createSession } from '@qpad/engine';
import { normalizeQScript } from './q-script-normalize';
import { rewriteQanvasCompat } from './sketch-q-literals';

export type SketchSession = ReturnType<typeof createSession>;

export type SketchEvaluateHooks = {
  onShowOutput?: (formatted: string) => void;
};

export function loadSketchSource(
  session: SketchSession,
  source: string,
  options: { fileName?: string; hooks?: SketchEvaluateHooks } = {}
) {
  const { fileName, hooks } = options;

  for (const statement of normalizeQScript(rewriteQanvasCompat(source))) {
    try {
      const result = session.evaluate(statement);
      if (hooks?.onShowOutput && /^show(?:\s|\[|\()/.test(statement.trim())) {
        hooks.onShowOutput(result.formatted);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(fileName ? `${fileName}: ${message}` : message);
    }
  }
}
