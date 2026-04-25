import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightTree } from '@lezer/highlight';
import { tags as t } from '@lezer/highlight';
import { qLanguage } from './q-codemirror';

/**
 * Matches desktop Monaco theme `qanvas-warm` token colors
 * (`registerQLanguage` in `$lib/monaco/q-language.ts`).
 */
export const qMobileEditorHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, class: 'q-token-keyword', color: '#7D4E2D' },
  { tag: t.standard(t.variableName), class: 'q-token-builtin', color: '#2F7A6D' },
  { tag: t.special(t.variableName), class: 'q-token-qanvas', color: '#C06B2C' },
  { tag: t.variableName, class: 'q-token-variable', color: '#2C2520' },
  { tag: t.atom, class: 'q-token-symbol', color: '#8B674B' },
  { tag: t.number, class: 'q-token-number', color: '#5B6FE8' },
  { tag: t.string, class: 'q-token-string', color: '#B35B3F' },
  { tag: t.comment, class: 'q-token-comment', color: '#A89B8E', fontStyle: 'italic' },
  { tag: t.operator, class: 'q-token-operator', color: '#5C534C' },
  { tag: t.bracket, class: 'q-token-bracket', color: '#5C534C' },
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
