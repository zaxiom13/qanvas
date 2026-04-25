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
      background: '#FBF8F2',
      color: '#2C2924',
      fontSize: '13px',
    },
    '.cm-scroller': {
      height: '100%',
      overflow: 'auto',
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.65',
      background:
        'linear-gradient(90deg, rgba(76, 99, 214, 0.06) 1px, transparent 1px) 0 0 / 56px 56px, #FBF8F2',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '18px 16px 18px 0',
      caretColor: '#4C63D6',
    },
    '.cm-line': {
      padding: '0 8px',
    },
    '.cm-gutters': {
      background: 'rgba(239, 234, 224, 0.78)',
      color: '#9A8E80',
      borderRight: '1px solid #D9D0BF',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '34px',
      padding: '0 8px 0 10px',
    },
    '.cm-activeLine': {
      background: 'rgba(76, 99, 214, 0.06)',
    },
    '.cm-activeLineGutter': {
      background: 'rgba(76, 99, 214, 0.08)',
      color: '#23201C',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      background: 'rgba(76, 99, 214, 0.22)',
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
