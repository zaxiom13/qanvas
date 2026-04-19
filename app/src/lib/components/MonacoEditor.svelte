<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type * as Monaco from 'monaco-editor';
  import noUiSlider, { type API as NoUiSliderApi } from 'nouislider';
  import Pickr from '@simonwep/pickr';
  import 'nouislider/dist/nouislider.css';
  import '@simonwep/pickr/dist/themes/nano.min.css';
  import {
    findInlineControlLiteral,
    formatInlineControlValue,
    type ColorInlineControlLiteral,
    type InlineControlLiteral,
    type NumericInlineControlLiteral,
  } from '$lib/monaco/inline-controls';
  import { registerQLanguage } from '$lib/monaco/q-language';

  type Props = {
    value: string;
    activeKey: string;
    onChange: (value: string) => void;
    onInteractiveChange?: (value: string) => void;
  };

  type ResolvedInlineLiteral = InlineControlLiteral & {
    lineNumber: number;
  };

  type NumericControlSession = {
    anchor: string;
    min: number;
    max: number;
    step: number;
    decimals: number;
    suffix: string;
  };

  let { value, activeKey, onChange, onInteractiveChange }: Props = $props();

  let container = $state<HTMLDivElement | null>(null);
  let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);
  let monacoRef = $state<typeof Monaco | null>(null);
  let currentKey = $state('');
  let isApplyingExternalValue = false;
  let pendingChangeOrigin: 'default' | 'interactive' = 'default';
  let removeWindowShortcuts = () => {};
  let removeCommentToggle = () => {};
  let cleanupInlineControls = () => {};
  let activeInlineLiteral = $state<ResolvedInlineLiteral | null>(null);
  let inlineWidgetRoot: HTMLDivElement | null = null;
  let inlineWidgetLabel: HTMLSpanElement | null = null;
  let inlineWidgetSwatch: HTMLSpanElement | null = null;
  let inlineWidgetPinned = false;
  let hideInlineWidgetTimer: ReturnType<typeof setTimeout> | null = null;
  let literalDecorationIds: string[] = [];
  let inlineControlWidget: Monaco.editor.IContentWidget | null = null;

  let inlineSlider: NoUiSliderApi | null = null;
  let inlineSliderAnchor = '';
  let inlineSliderIsSyncing = false;
  let inlineColorPickr: Pickr | null = null;
  let inlineColorPickrAnchor = '';
  let inlineColorPickrIsSyncing = false;
  let numericControlSession: NumericControlSession | null = null;

  function dispatchShortcut(name: string) {
    window.dispatchEvent(new CustomEvent(name));
  }

  function runEditorAction(actionId: string) {
    void editor?.getAction(actionId)?.run();
  }

  function emitEditorChange(nextValue: string) {
    if (pendingChangeOrigin === 'interactive') {
      pendingChangeOrigin = 'default';
      (onInteractiveChange ?? onChange)(nextValue);
      return;
    }

    onChange(nextValue);
  }

  function toggleLineComments() {
    if (!editor || !monacoRef) return;

    const monaco = monacoRef;
    const model = editor.getModel();
    const selections = editor.getSelections();
    if (!model || !selections?.length) return;

    const lineNumbers = new Set<number>();
    for (const selection of selections) {
      const endLineNumber =
        selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber
          ? selection.endLineNumber - 1
          : selection.endLineNumber;

      for (let lineNumber = selection.startLineNumber; lineNumber <= endLineNumber; lineNumber += 1) {
        lineNumbers.add(lineNumber);
      }
    }

    const sortedLineNumbers = [...lineNumbers].sort((left, right) => left - right);
    const allCommented = sortedLineNumbers.every((lineNumber) => {
      const line = model.getLineContent(lineNumber);
      return !line.trim() || /^\s*\//.test(line);
    });

    const edits = sortedLineNumbers.map((lineNumber) => {
      const line = model.getLineContent(lineNumber);
      const nextLine = !line.trim()
        ? line
        : allCommented
          ? line.replace(/^(\s*)\/ ?/, '$1')
          : line.replace(/^(\s*)/, '$1/');

      return {
        range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
        text: nextLine,
      };
    });

    editor.executeEdits('qanvas-comment-toggle', edits);
  }

  function usesPrimaryModifier(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey;
  }

  function isEditorTarget(target: EventTarget | null) {
    return target instanceof Node && Boolean(container?.contains(target));
  }

  function isCommentShortcut(event: KeyboardEvent) {
    return event.code === 'Slash' || event.key === '/' || event.key === '?';
  }

  function isPlainTextInput(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
  }

  function handleWindowShortcuts(event: KeyboardEvent) {
    if (!usesPrimaryModifier(event)) return;

    if (!event.shiftKey && !event.altKey && event.code === 'KeyO') {
      event.preventDefault();
      dispatchShortcut('qanvas:toggle-projects');
      return;
    }

    const editorFocused = editor?.hasTextFocus() || isEditorTarget(event.target) || isEditorTarget(document.activeElement);
    const activeOutsideEditor = isPlainTextInput(document.activeElement) && !isEditorTarget(document.activeElement);
    if (!event.altKey && isCommentShortcut(event) && (editorFocused || !activeOutsideEditor)) {
      event.preventDefault();
      toggleLineComments();
    }
  }

  function clearInlineWidgetHideTimer() {
    if (!hideInlineWidgetTimer) return;
    clearTimeout(hideInlineWidgetTimer);
    hideInlineWidgetTimer = null;
  }

  function isInlineWidgetTarget(target: EventTarget | null) {
    return target instanceof Node && Boolean(inlineWidgetRoot?.contains(target));
  }

  function getLiteralAnchor(literal: ResolvedInlineLiteral) {
    return `${literal.lineNumber}:${literal.startColumn}`;
  }

  function applyNumericSession(literal: ResolvedInlineLiteral) {
    if (literal.kind !== 'number') {
      numericControlSession = null;
      return literal;
    }

    const anchor = getLiteralAnchor(literal);
    if (!numericControlSession || numericControlSession.anchor !== anchor) {
      numericControlSession = {
        anchor,
        min: literal.value - 10,
        max: literal.value + 10,
        step: literal.step,
        decimals: literal.decimals,
        suffix: literal.suffix,
      };
    }

    return {
      ...literal,
      min: numericControlSession.min,
      max: numericControlSession.max,
      step: numericControlSession.step,
      decimals: numericControlSession.decimals,
      suffix: numericControlSession.suffix,
    };
  }

  function ensureInlineWidgetRoot() {
    if (inlineWidgetRoot) return inlineWidgetRoot;

    const root = document.createElement('div');
    root.className = 'qanvas-inline-control';
    root.addEventListener('pointerdown', (event) => {
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
      event.stopPropagation();
    });
    root.addEventListener('mousedown', (event) => {
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
      event.stopPropagation();
    });
    root.addEventListener('pointerenter', () => {
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
    });
    root.addEventListener('pointerleave', () => {
      inlineWidgetPinned = false;
      scheduleInlineWidgetHide();
    });

    inlineWidgetRoot = root;
    return root;
  }

  function teardownSlider() {
    if (!inlineSlider) return;
    inlineSlider.destroy();
    inlineSlider = null;
    inlineSliderAnchor = '';
    inlineSliderIsSyncing = false;
  }

  function teardownColorPickr() {
    if (!inlineColorPickr) return;
    const picker = inlineColorPickr as Pickr & { destroyAndRemove?: () => void };
    if (typeof picker.destroyAndRemove === 'function') {
      picker.destroyAndRemove();
    } else {
      picker.destroy();
    }
    inlineColorPickr = null;
    inlineColorPickrAnchor = '';
    inlineColorPickrIsSyncing = false;
  }

  function buildNumberWidget(root: HTMLDivElement, literal: NumericInlineControlLiteral & { lineNumber: number }) {
    teardownColorPickr();
    teardownSlider();

    root.replaceChildren();
    root.dataset.kind = 'number';

    const pill = document.createElement('div');
    pill.className = 'qanvas-inline-control__pill';

    const label = document.createElement('span');
    label.className = 'qanvas-inline-control__value';

    const sliderHost = document.createElement('div');
    sliderHost.className = 'qanvas-inline-control__slider';

    pill.append(label, sliderHost);
    root.append(pill);

    inlineWidgetLabel = label;
    inlineWidgetSwatch = null;
    inlineSliderAnchor = getLiteralAnchor(literal);
    inlineSlider = noUiSlider.create(sliderHost, {
      start: [literal.value],
      step: literal.step,
      range: { min: literal.min, max: literal.max },
      connect: [true, false],
      behaviour: 'tap-drag',
      animate: false,
    });

    inlineSlider.on('start', () => {
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
    });
    inlineSlider.on('slide', (values) => {
      if (inlineSliderIsSyncing) return;
      const currentLiteral = activeInlineLiteral;
      if (!currentLiteral || currentLiteral.kind !== 'number') return;
      const nextValue = Number(Array.isArray(values) ? values[0] : values);
      if (!Number.isFinite(nextValue)) return;
      applyActiveInlineLiteralChange(formatInlineControlValue(currentLiteral, nextValue));
    });
    inlineSlider.on('end', () => {
      inlineWidgetPinned = false;
      scheduleInlineWidgetHide();
    });
  }

  function buildColorWidget(root: HTMLDivElement, literal: ColorInlineControlLiteral & { lineNumber: number }) {
    teardownSlider();
    teardownColorPickr();

    root.replaceChildren();
    root.dataset.kind = 'color';

    const pill = document.createElement('div');
    pill.className = 'qanvas-inline-control__pill';

    const swatch = document.createElement('span');
    swatch.className = 'qanvas-inline-control__swatch';

    const label = document.createElement('span');
    label.className = 'qanvas-inline-control__value';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'qanvas-inline-control__pickr-trigger';
    trigger.textContent = 'Pick';

    pill.append(swatch, label, trigger);
    root.append(pill);

    inlineWidgetLabel = label;
    inlineWidgetSwatch = swatch;
    inlineColorPickrAnchor = getLiteralAnchor(literal);
    inlineColorPickr = Pickr.create({
      el: trigger,
      theme: 'nano',
      useAsButton: true,
      default: literal.value,
      container: root,
      lockOpacity: true,
      comparison: false,
      closeOnScroll: true,
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          hex: true,
          input: true,
          save: false,
          clear: false,
          cancel: false,
        },
      },
    });

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
      inlineColorPickr?.show();
    });

    inlineColorPickr.on('show', () => {
      inlineWidgetPinned = true;
      clearInlineWidgetHideTimer();
    });
    inlineColorPickr.on('hide', () => {
      inlineWidgetPinned = false;
      scheduleInlineWidgetHide();
    });
    inlineColorPickr.on('change', (color: { toHEXA: () => { toString: () => string } } | null) => {
      if (inlineColorPickrIsSyncing || !color) return;
      const currentLiteral = activeInlineLiteral;
      if (!currentLiteral || currentLiteral.kind !== 'color') return;

      const rawHex = color.toHEXA().toString();
      const normalHex = rawHex.startsWith('#')
        ? `#${rawHex.slice(1, 7)}`
        : `#${rawHex.slice(0, 6)}`;
      applyActiveInlineLiteralChange(formatInlineControlValue(currentLiteral, normalHex));
    });
  }

  function syncInlineWidget() {
    const root = ensureInlineWidgetRoot();

    if (!activeInlineLiteral) {
      root.classList.add('is-hidden');
      root.removeAttribute('data-kind');
      return;
    }

    root.classList.remove('is-hidden');

    if (activeInlineLiteral.kind === 'number') {
      syncNumberWidget(activeInlineLiteral);
      return;
    }

    syncColorWidget(activeInlineLiteral);
  }

  function syncNumberWidget(literal: NumericInlineControlLiteral & { lineNumber: number }) {
    const root = ensureInlineWidgetRoot();
    const anchor = getLiteralAnchor(literal);
    if (root.dataset.kind !== 'number' || !inlineSlider || inlineSliderAnchor !== anchor) {
      buildNumberWidget(root, literal);
    }

    if (!inlineWidgetLabel || !inlineSlider) return;
    inlineWidgetLabel.textContent = `${literal.raw}  (${literal.min} .. ${literal.max})`;
    inlineSliderIsSyncing = true;
    inlineSlider.set(literal.value);
    inlineSliderIsSyncing = false;
  }

  function syncColorWidget(literal: ColorInlineControlLiteral & { lineNumber: number }) {
    const root = ensureInlineWidgetRoot();
    const anchor = getLiteralAnchor(literal);
    if (root.dataset.kind !== 'color' || !inlineColorPickr || inlineColorPickrAnchor !== anchor) {
      buildColorWidget(root, literal);
    }

    if (!inlineWidgetLabel || !inlineWidgetSwatch || !inlineWidgetRoot) return;
    inlineWidgetRoot.style.setProperty('--inline-control-accent', literal.value);
    inlineWidgetLabel.textContent = literal.raw;
    inlineWidgetSwatch.style.background = literal.value;
    if (inlineColorPickr) {
      inlineColorPickrIsSyncing = true;
      inlineColorPickr.setColor(literal.value, true);
      inlineColorPickrIsSyncing = false;
    }
  }

  function updateLiteralDecorations() {
    if (!editor || !monacoRef) return;

    const nextDecorations = activeInlineLiteral
      ? [{
          range: new monacoRef.Range(
            activeInlineLiteral.lineNumber,
            activeInlineLiteral.startColumn,
            activeInlineLiteral.lineNumber,
            activeInlineLiteral.endColumn
          ),
          options: {
            inlineClassName:
              activeInlineLiteral.kind === 'color'
                ? 'qanvas-inline-literal qanvas-inline-literal--color'
                : 'qanvas-inline-literal qanvas-inline-literal--number',
          },
        }]
      : [];

    literalDecorationIds = editor.deltaDecorations(literalDecorationIds, nextDecorations);
  }

  function layoutInlineWidget() {
    if (!editor || !inlineControlWidget) return;
    syncInlineWidget();
    editor.layoutContentWidget(inlineControlWidget);
  }

  function resetInlineControlSession() {
    numericControlSession = null;
    teardownSlider();
    teardownColorPickr();
  }

  function hideInlineWidget() {
    activeInlineLiteral = null;
    inlineWidgetPinned = false;
    resetInlineControlSession();
    updateLiteralDecorations();
    layoutInlineWidget();
  }

  function scheduleInlineWidgetHide() {
    clearInlineWidgetHideTimer();
    if (inlineWidgetPinned) return;
    hideInlineWidgetTimer = setTimeout(() => {
      hideInlineWidgetTimer = null;
      if (!inlineWidgetPinned) {
        hideInlineWidget();
      }
    }, 140);
  }

  function setActiveInlineLiteral(nextLiteral: ResolvedInlineLiteral | null) {
    if (!nextLiteral) {
      activeInlineLiteral = null;
      updateLiteralDecorations();
      layoutInlineWidget();
      return;
    }

    const resolvedLiteral = nextLiteral.kind === 'number'
      ? applyNumericSession(nextLiteral)
      : (() => {
          numericControlSession = null;
          return nextLiteral;
        })();

    activeInlineLiteral = resolvedLiteral;
    updateLiteralDecorations();
    layoutInlineWidget();
  }

  function resolveInlineLiteralAtPosition(position: { lineNumber: number; column: number } | null) {
    if (!editor || !position) return null;

    const model = editor.getModel();
    if (!model) return null;

    const lineText = model.getLineContent(position.lineNumber);
    const literal = findInlineControlLiteral(lineText, position.column);
    return literal ? { ...literal, lineNumber: position.lineNumber } : null;
  }

  function updateInlineLiteralFromPosition(position: { lineNumber: number; column: number } | null) {
    if (!editor) return;

    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      if (!inlineWidgetPinned) {
        hideInlineWidget();
      }
      return;
    }

    const literal = resolveInlineLiteralAtPosition(position);
    if (literal) {
      clearInlineWidgetHideTimer();
      setActiveInlineLiteral(literal);
    } else if (!inlineWidgetPinned) {
      scheduleInlineWidgetHide();
    }
  }

  function applyActiveInlineLiteralChange(nextRaw: string) {
    if (!editor || !monacoRef || !activeInlineLiteral) return;
    if (nextRaw === activeInlineLiteral.raw) return;

    const currentLiteral = activeInlineLiteral;
    pendingChangeOrigin = 'interactive';

    editor.executeEdits('qanvas-inline-control', [
      {
        range: new monacoRef.Range(
          currentLiteral.lineNumber,
          currentLiteral.startColumn,
          currentLiteral.lineNumber,
          currentLiteral.endColumn
        ),
        text: nextRaw,
        forceMoveMarkers: true,
      },
    ]);

    const updatedLiteral = resolveInlineLiteralAtPosition({
      lineNumber: currentLiteral.lineNumber,
      column: currentLiteral.startColumn,
    });

    if (updatedLiteral) {
      setActiveInlineLiteral(updatedLiteral);
    } else {
      hideInlineWidget();
    }
  }

  onMount(async () => {
    const monaco = await import('monaco-editor');
    monacoRef = monaco;
    registerQLanguage(monaco);

    if (!container) return;

    editor = monaco.editor.create(container, {
      value,
      language: 'q',
      theme: 'qanvas-warm',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      folding: true,
      lineNumbers: 'on',
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      suggestOnTriggerCharacters: true,
      snippetSuggestions: 'top',
      acceptSuggestionOnCommitCharacter: true,
      glyphMargin: false,
      overviewRulerBorder: false,
      scrollbar: {
        verticalScrollbarSize: 6,
        horizontalScrollbarSize: 6,
      },
    });

    inlineControlWidget = {
      getId: () => 'qanvas-inline-control-widget',
      allowEditorOverflow: true,
      suppressMouseDown: false,
      getDomNode: () => ensureInlineWidgetRoot(),
      getPosition: () =>
        activeInlineLiteral
          ? {
              position: {
                lineNumber: activeInlineLiteral.lineNumber,
                column: activeInlineLiteral.startColumn,
              },
              preference: [
                monaco.editor.ContentWidgetPositionPreference.ABOVE,
                monaco.editor.ContentWidgetPositionPreference.BELOW,
              ],
            }
          : null,
    };
    editor.addContentWidget(inlineControlWidget);

    const disposables = [
      editor.onDidChangeModelContent(() => {
        if (isApplyingExternalValue || !editor) return;
        emitEditorChange(editor.getValue());
      }),
      editor.onDidChangeCursorPosition((event) => {
        updateInlineLiteralFromPosition(event.position);
      }),
      editor.onMouseMove((event) => {
        if (event.target.position) {
          updateInlineLiteralFromPosition(event.target.position);
        }
      }),
      editor.onMouseLeave(() => {
        if (!inlineWidgetPinned) {
          scheduleInlineWidgetHide();
        }
      }),
      editor.onDidBlurEditorText(() => {
        if (!inlineWidgetPinned && !isInlineWidgetTarget(document.activeElement)) {
          scheduleInlineWidgetHide();
        }
      }),
      editor.onDidBlurEditorWidget(() => {
        if (!inlineWidgetPinned && !isInlineWidgetTarget(document.activeElement)) {
          scheduleInlineWidgetHide();
        }
      }),
    ];

    cleanupInlineControls = () => {
      clearInlineWidgetHideTimer();
      resetInlineControlSession();
      activeInlineLiteral = null;
      if (editor && literalDecorationIds.length) {
        literalDecorationIds = editor.deltaDecorations(literalDecorationIds, []);
      }
      if (editor && inlineControlWidget) {
        editor.removeContentWidget(inlineControlWidget);
      }
      inlineControlWidget = null;
      for (const disposable of disposables) {
        disposable.dispose();
      }
    };

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => dispatchShortcut('qanvas:save'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => dispatchShortcut('qanvas:toggle-sidebar'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => dispatchShortcut('qanvas:toggle-examples'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO, () => dispatchShortcut('qanvas:toggle-projects'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => dispatchShortcut('qanvas:new-sketch'));

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      runEditorAction('editor.action.copyLinesDownAction');
    });
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      runEditorAction('editor.action.copyLinesUpAction');
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
      runEditorAction('editor.action.moveLinesDownAction');
    });
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
      runEditorAction('editor.action.moveLinesUpAction');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runEditorAction('editor.action.insertLineAfter');
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      runEditorAction('editor.action.insertLineBefore');
    });

    window.addEventListener('keydown', handleWindowShortcuts, true);
    removeWindowShortcuts = () => window.removeEventListener('keydown', handleWindowShortcuts, true);

    const handleCommentToggle = () => toggleLineComments();
    window.addEventListener('qanvas:toggle-comment', handleCommentToggle as EventListener);
    removeCommentToggle = () => window.removeEventListener('qanvas:toggle-comment', handleCommentToggle as EventListener);
  });

  onDestroy(() => {
    removeWindowShortcuts();
    removeCommentToggle();
    cleanupInlineControls();
    editor?.dispose();
  });

  $effect(() => {
    if (!editor) return;

    if (currentKey !== activeKey) {
      currentKey = activeKey;
      hideInlineWidget();
      isApplyingExternalValue = true;
      editor.setValue(value);
      isApplyingExternalValue = false;
      return;
    }

    if (value !== editor.getValue()) {
      hideInlineWidget();
      isApplyingExternalValue = true;
      editor.setValue(value);
      isApplyingExternalValue = false;
    }
  });
</script>

<div bind:this={container} id="monaco-editor"></div>
