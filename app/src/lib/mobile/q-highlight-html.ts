import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightTree } from '@lezer/highlight';
import { tags as t } from '@lezer/highlight';
import { qLanguage } from './q-codemirror';

/** Same token classes and editor colors as {@link MobileCodeEditor}; used for static HTML (e.g. tour snippets). */
export const qMobileEditorHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, class: 'q-token-keyword', color: '#4C63D6', fontWeight: '700' },
  { tag: t.atom, class: 'q-token-symbol', color: '#B38256' },
  { tag: t.variableName, class: 'q-token-variable', color: '#2C2924' },
  { tag: t.number, class: 'q-token-number', color: '#3B8F51' },
  { tag: t.string, class: 'q-token-string', color: '#8B5E34' },
  { tag: t.comment, class: 'q-token-comment', color: '#9A8E80', fontStyle: 'italic' },
  { tag: t.operator, class: 'q-token-operator', color: '#C94834' },
  { tag: t.bracket, class: 'q-token-bracket', color: '#6B6258' },
]);

const highlightExtensions = [qLanguage, syntaxHighlighting(qMobileEditorHighlightStyle)];

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns HTML for a q snippet with the same classes as the mobile CodeMirror editor.
 * Safe for `{@html ...}`: all plain text is escaped; class names come only from the highlight theme.
 */
export function highlightQSnippetHtml(source: string): string {
  if (!source) return '';
  const state = EditorState.create({ doc: source, extensions: highlightExtensions });
  const tree = syntaxTree(state);
  const out: string[] = [];
  let pos = 0;
  highlightTree(tree, qMobileEditorHighlightStyle, (from, to, classes) => {
    if (from > pos) out.push(escapeHtml(source.slice(pos, from)));
    if (from < to && classes) {
      const body = escapeHtml(source.slice(from, to));
      out.push(`<span class="${classes}">${body}</span>`);
    } else if (from < to) {
      out.push(escapeHtml(source.slice(from, to)));
    }
    pos = Math.max(pos, to);
  });
  if (pos < source.length) out.push(escapeHtml(source.slice(pos)));
  return out.join('');
}
