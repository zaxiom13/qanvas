<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { onDestroy, onMount } from "svelte";
  import { qExtensions, setQError, toggleScrub } from "../editor/extensions";

  interface Props {
    value: string;
    onChange?: (v: string) => void;
    onRun?: () => void;
    onScrub?: () => void;
    error?: { from: number; to: number; message: string } | null;
    compact?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    scrub?: boolean;
    view?: EditorView | null;
    label?: string;
  }

  let {
    value,
    onChange,
    onRun,
    onScrub,
    error = null,
    compact = false,
    readOnly = false,
    placeholder,
    scrub = false,
    view = $bindable(null),
    label = "q code editor",
  }: Props = $props();

  let host: HTMLDivElement;
  let current = "";

  onMount(() => {
    current = value;
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: qExtensions({
          compact,
          readOnly,
          placeholder,
          onRun: () => onRun?.(),
          onScrub: onScrub ? () => onScrub?.() : undefined,
          onChange: (v) => {
            current = v;
            onChange?.(v);
          },
        }),
      }),
    });
    view.contentDOM.setAttribute("aria-label", label);
    view.contentDOM.setAttribute("autocapitalize", "off");
    view.contentDOM.setAttribute("autocorrect", "off");
    view.contentDOM.setAttribute("spellcheck", "false");
  });

  onDestroy(() => view?.destroy());

  // external value changes (e.g. loading an example)
  $effect(() => {
    const v = value;
    if (view && v !== current) {
      current = v;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  });

  $effect(() => {
    const e = error;
    if (view) setQError(view, e);
  });

  $effect(() => {
    const s = scrub;
    if (view) toggleScrub(view, s);
  });
</script>

<div class="editor" class:compact bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .editor.compact {
    height: auto;
  }
  .editor.compact :global(.cm-editor) {
    height: auto;
    background: transparent;
  }
  .editor.compact :global(.cm-content) {
    padding: 10px 0;
  }
  .editor.compact :global(.cm-scroller) {
    overflow-x: auto;
  }
  .editor :global(.cm-editor) {
    background: var(--code-bg);
  }
</style>
