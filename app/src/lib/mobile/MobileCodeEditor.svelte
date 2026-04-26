<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers } from '@codemirror/view';
  import { autocompletion, snippetCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete';
  import {
    Q_BUILTIN_FUNCTIONS,
    Q_CANVAS_FUNCTIONS,
    Q_COLOR_SYMBOLS,
    Q_CONTEXT_SYMBOLS,
    Q_KEYWORDS,
    Q_SLASH_SNIPPETS,
  } from '$lib/monaco/q-language';
  import { qMobileEditorHighlightStyle } from './q-highlight-html';
  import { qLanguage } from './q-codemirror';

  type Props = {
    value: string;
    onChange: (value: string) => void;
  };

  let { value, onChange }: Props = $props();
  let host = $state<HTMLDivElement | null>(null);
  let view: EditorView | null = null;
  let lastValue = $state('');

  const mobileTheme = EditorView.theme({
    '&': {
      height: '100%',
      background: '#FFFDF9',
      color: '#2C2520',
      fontSize: '13px',
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto',
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.65',
      background: '#FFFDF9',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '18px 16px 18px 0',
      caretColor: '#5B6FE8',
    },
    '.cm-line': {
      padding: '0 8px',
    },
    '.cm-gutters': {
      background: '#F7F1E9',
      color: '#B5A799',
      borderRight: '1px solid #E0D8CC',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '34px',
      padding: '0 8px 0 10px',
    },
    '.cm-activeLine': {
      background: '#F7F1E9',
    },
    '.cm-activeLineGutter': {
      background: '#EDE6DC',
      color: '#7A6E62',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      background: '#DDE2FF',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  });

  const mobileSlashSnippets = Q_SLASH_SNIPPETS.map((item) =>
    snippetCompletion(item.insertText, {
      label: item.label,
      detail: item.detail,
      info: item.documentation,
      type: 'keyword',
    })
  );

  const mobileQanvasCompletions = Q_CANVAS_FUNCTIONS.map((item) =>
    snippetCompletion(item.insertText, {
      label: item.label,
      detail: item.detail,
      info: item.documentation,
      type: 'function',
    })
  );

  const mobileContextCompletions = Q_CONTEXT_SYMBOLS.map((item) =>
    item.insertText.includes('${')
      ? snippetCompletion(item.insertText, {
          label: item.label,
          detail: item.detail,
          info: item.documentation,
          type: 'variable',
        })
      : ({
          label: item.label,
          detail: item.detail,
          info: item.documentation,
          apply: item.insertText,
          type: 'variable',
        } satisfies Completion)
  );

  const mobileColorCompletions = Q_COLOR_SYMBOLS.map(
    (item) =>
      ({
        label: item.label,
        detail: item.detail,
        info: item.documentation,
        apply: item.insertText,
        type: 'constant',
      }) satisfies Completion
  );

  const mobileBuiltinCompletions = Q_BUILTIN_FUNCTIONS.map(
    (label) =>
      ({
        label,
        detail: 'q built-in',
        info: 'Built-in q function.',
        type: 'function',
      }) satisfies Completion
  );

  const mobileKeywordCompletions = Q_KEYWORDS.map(
    (label) =>
      ({
        label,
        detail: 'q keyword',
        info: 'Core q keyword or query word.',
        type: 'keyword',
      }) satisfies Completion
  );

  function dedupeMobileCompletions(items: Completion[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
  }

  const mobileQCompletionsList = dedupeMobileCompletions([
    ...mobileSlashSnippets,
    ...mobileQanvasCompletions,
    ...mobileContextCompletions,
    ...mobileColorCompletions,
    ...mobileBuiltinCompletions,
    ...mobileKeywordCompletions,
  ]);

  function mobileQCompletions(context: CompletionContext) {
    const slash = context.matchBefore(/\/[a-zA-Z]*/);
    if (slash) {
      if (slash.from === slash.to && !context.explicit) return null;
      return {
        from: slash.from,
        options: mobileSlashSnippets,
      };
    }

    const word = context.matchBefore(/[a-zA-Z_.][a-zA-Z0-9_.`]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const lineStart = context.state.doc.lineAt(context.pos).from;
    const before = context.state.sliceDoc(lineStart, context.pos);
    const color = before.match(/Color\.[A-Z_]*$/);

    return {
      from: color ? context.pos - color[0].length : word.from,
      options: mobileQCompletionsList,
      validFor: /^[a-zA-Z_.][a-zA-Z0-9_.`]*$/,
    };
  }

  onMount(() => {
    if (!host) return;

    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          qLanguage,
          autocompletion({
            override: [mobileQCompletions],
            activateOnTyping: true,
          }),
          syntaxHighlighting(qMobileEditorHighlightStyle),
          mobileTheme,
          bracketMatching(),
          indentOnInput(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            lastValue = update.state.doc.toString();
            onChange(lastValue);
          }),
          EditorView.contentAttributes.of({
            'aria-label': 'q sketch editor',
            autocapitalize: 'off',
            autocomplete: 'off',
            spellcheck: 'false',
          }),
        ],
      }),
    });
    lastValue = value;

    return () => {
      view?.destroy();
      view = null;
    };
  });

  $effect(() => {
    if (!view || value === lastValue) return;
    lastValue = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });
</script>

<div class="mobile-code-editor" bind:this={host}></div>

<style>
  /* `body` uses user-select: none for UI chrome; re-enable for CodeMirror on touch/desktop. */
  .mobile-code-editor {
    height: 100%;
    min-height: 0;
    user-select: text;
    -webkit-user-select: text;
  }

  .mobile-code-editor :global(.cm-editor),
  .mobile-code-editor :global(.cm-scroller),
  .mobile-code-editor :global(.cm-content),
  .mobile-code-editor :global(.cm-line) {
    user-select: text;
    -webkit-user-select: text;
  }
</style>
