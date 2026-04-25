<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers } from '@codemirror/view';
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
  .mobile-code-editor {
    height: 100%;
    min-height: 0;
  }
</style>
