import type { Completion } from '@codemirror/autocomplete';

/**
 * Fold string `info` into `detail` and drop `info` so CodeMirror does not render
 * a separate completion info tooltip beside the list.
 */
export function mergeCompletionDocumentationIntoDetail(completion: Completion): Completion {
  const { info } = completion;
  if (!info || typeof info !== 'string') return completion;
  const doc = info.trim();
  if (!doc) {
    const { info: _omit, ...rest } = completion;
    return rest as Completion;
  }
  const detail = completion.detail?.trim();
  const mergedDetail = detail ? `${detail}\n\n${doc}` : doc;
  const { info: _omit, ...rest } = completion;
  return { ...rest, detail: mergedDetail };
}
