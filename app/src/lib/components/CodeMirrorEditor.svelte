<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    copyLineDown,
    copyLineUp,
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
    insertBlankLine,
    insertNewlineAndIndent,
    moveLineDown,
    moveLineUp,
  } from '@codemirror/commands';
  import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
  import { EditorState } from '@codemirror/state';
  import { EditorView, keymap, lineNumbers } from '@codemirror/view';
  import {
    autocompletion,
    snippetCompletion,
    type Completion,
    type CompletionContext,
  } from '@codemirror/autocomplete';
  import Pickr from '@simonwep/pickr';
  import '@simonwep/pickr/dist/themes/nano.min.css';
  import {
    findInlineControlLiteral,
    formatInlineControlValue,
    type ColorInlineControlLiteral,
    type InlineControlLiteral,
  } from '$lib/editor/inline-controls';
  import { mergeCompletionDocumentationIntoDetail } from '$lib/editor/merge-completion-documentation';
  import {
    Q_BUILTIN_FUNCTIONS,
    Q_CANVAS_FUNCTIONS,
    Q_COLOR_SYMBOLS,
    Q_CONTEXT_SYMBOLS,
    Q_KEYWORDS,
    Q_NAMESPACE_SYMBOLS,
    Q_SLASH_SNIPPETS,
  } from '$lib/editor/q-language';
  import { qMobileEditorHighlightStyle } from '$lib/mobile/q-highlight-html';
  import { qLanguage } from '$lib/mobile/q-codemirror';

  type Props = {
    value: string;
    activeKey: string;
    onChange: (value: string) => void;
    onInteractiveChange?: (value: string) => void;
  };

  let { value, activeKey, onChange, onInteractiveChange }: Props = $props();
  let host = $state<HTMLDivElement | null>(null);
  let inlineControlHost = $state<HTMLDivElement | null>(null);
  let view: EditorView | null = null;
  let lastValue = $state('');
  let currentKey = $state('');
  let isApplyingExternalValue = false;
  let pendingChangeOrigin: 'default' | 'interactive' = 'default';
  let removeWindowShortcuts = () => {};
  let removeCommentToggle = () => {};
  let activeInlineLiteral = $state<(InlineControlLiteral & { lineNumber: number }) | null>(null);
  let inlineControlStyle = $state('');
  let inlineControlPinned = false;
  let inlineControlHideTimer: ReturnType<typeof setTimeout> | null = null;
  let inlineColorPickr: Pickr | null = null;
  let inlineColorPickrAnchor = '';
  let inlineColorPickrIsSyncing = false;
  let touchSelection:
    | {
        identifier: number;
        anchor: number;
        moved: boolean;
        startX: number;
        startY: number;
      }
    | null = null;

  let twoFingerPan:
    | {
        id0: number;
        id1: number;
        lastMidX: number;
        lastMidY: number;
      }
    | null = null;

  /** True while the user is in a scroll-oriented touch gesture; keeps the virtual keyboard closed. */
  let suppressKeyboardForScroll = false;

  const touchSelectMoveThreshold = 6;

  const completionUiTheme = EditorView.theme({
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      minWidth: '300px',
      maxWidth: 'min(820px, 96vw)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      columnGap: '4px',
      rowGap: '1px',
      whiteSpace: 'normal',
      overflowX: 'visible',
      textOverflow: 'clip',
      lineHeight: 1.2,
      borderBottom: '1px solid rgba(44, 37, 32, 0.12)',
      padding: '1px 6px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li:last-child': {
      borderBottom: 'none',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section': {
      display: 'list-item',
      borderBottom: '1px solid rgba(44, 37, 32, 0.12)',
      padding: '2px 6px 1px',
      lineHeight: 1.2,
    },
    '.cm-tooltip.cm-tooltip-autocomplete .cm-completionLabel': {
      flex: '0 1 auto',
      minWidth: 0,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
    },
    '.cm-tooltip.cm-tooltip-autocomplete .cm-completionDetail': {
      flex: '1 1 100%',
      marginLeft: 0,
      marginTop: 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontStyle: 'normal',
      opacity: 0.82,
      fontSize: '10px',
      lineHeight: 1.25,
    },
    '.cm-tooltip.cm-tooltip-autocomplete .cm-completionIcon': {
      flex: '0 0 auto',
      marginTop: '0.08em',
      paddingRight: '0.35em',
      fontSize: '82%',
    },
    '.cm-tooltip.cm-tooltip-autocomplete .cm-completionInfo': {
      display: 'none',
    },
  });

  const editorTheme = EditorView.theme({
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
      touchAction: 'pan-x pan-y',
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
      touchAction: 'pan-x pan-y',
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

  function dispatchShortcut(name: string) {
    window.dispatchEvent(new CustomEvent(name));
  }

  function emitEditorChange(nextValue: string) {
    if (pendingChangeOrigin === 'interactive') {
      pendingChangeOrigin = 'default';
      (onInteractiveChange ?? onChange)(nextValue);
      return;
    }

    onChange(nextValue);
  }

  function usesPrimaryModifier(event: KeyboardEvent) {
    return event.metaKey || event.ctrlKey;
  }

  function isEditorTarget(target: EventTarget | null) {
    return target instanceof Node && Boolean(host?.contains(target));
  }

  function isCommentShortcut(event: KeyboardEvent) {
    return event.code === 'Slash' || event.key === '/' || event.key === '?';
  }

  function isPlainTextInput(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
  }

  function isEditorContentTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('.cm-content')) && !Boolean(target.closest('.qanvas-inline-control'));
  }

  /** Gutter or scroller chrome (not `.cm-content`): native one-finger pan scroll. */
  function isScrollerChromeTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (!target.closest('.cm-scroller')) return false;
    if (target.closest('.cm-content')) return false;
    if (target.closest('.qanvas-inline-control')) return false;
    return true;
  }

  function setContentInputMode(currentView: EditorView, mode: 'none' | 'text') {
    if (mode === 'none') currentView.contentDOM.setAttribute('inputmode', 'none');
    else currentView.contentDOM.removeAttribute('inputmode');
  }

  function beginScrollGestureKeyboardSuppression(currentView: EditorView) {
    suppressKeyboardForScroll = true;
    setContentInputMode(currentView, 'none');
    if (currentView.hasFocus) currentView.contentDOM.blur();
  }

  /** When every touch has ended, restore normal keyboard behavior for the next tap. */
  function clearScrollKeyboardSuppressionIfIdle(event: TouchEvent) {
    if (event.touches.length !== 0) return;
    if (!suppressKeyboardForScroll) return;
    suppressKeyboardForScroll = false;
    if (view) setContentInputMode(view, 'text');
  }

  function getTouchByIdentifier(touches: TouchList, identifier: number) {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);
      if (touch?.identifier === identifier) return touch;
    }
    return null;
  }

  function initTwoFingerPanFromTouches(touches: TouchList) {
    if (touches.length < 2) return;
    const t0 = touches.item(0);
    const t1 = touches.item(1);
    if (!t0 || !t1) return;
    twoFingerPan = {
      id0: t0.identifier,
      id1: t1.identifier,
      lastMidX: (t0.clientX + t1.clientX) / 2,
      lastMidY: (t0.clientY + t1.clientY) / 2,
    };
  }

  function applyTwoFingerPan(event: TouchEvent, currentView: EditorView) {
    if (event.touches.length < 2) return;
    if (!twoFingerPan) initTwoFingerPanFromTouches(event.touches);
    if (!twoFingerPan) return;

    let p0 = getTouchByIdentifier(event.touches, twoFingerPan.id0);
    let p1 = getTouchByIdentifier(event.touches, twoFingerPan.id1);
    if (!p0 || !p1) {
      initTwoFingerPanFromTouches(event.touches);
      if (!twoFingerPan) return;
      p0 = getTouchByIdentifier(event.touches, twoFingerPan.id0);
      p1 = getTouchByIdentifier(event.touches, twoFingerPan.id1);
      if (!p0 || !p1) return;
    }

    event.preventDefault();
    event.stopPropagation();

    const midX = (p0.clientX + p1.clientX) / 2;
    const midY = (p0.clientY + p1.clientY) / 2;
    const dx = midX - twoFingerPan.lastMidX;
    const dy = midY - twoFingerPan.lastMidY;
    twoFingerPan.lastMidX = midX;
    twoFingerPan.lastMidY = midY;

    const scroller = currentView.scrollDOM;
    scroller.scrollLeft -= dx;
    scroller.scrollTop -= dy;
  }

  function clearTwoFingerPanIfNeeded(event: TouchEvent) {
    if (event.touches.length < 2) twoFingerPan = null;
  }

  function selectEditorRange(anchor: number, head: number, scrollIntoView = false) {
    if (!view) return;
    view.dispatch({
      selection: { anchor, head },
      scrollIntoView,
      userEvent: 'select.pointer',
    });
  }

  function updateSelectionMetadata() {
    if (!host || !view) return;
    const range = view.state.selection.main;
    host.dataset.selectionLength = String(Math.abs(range.head - range.anchor));
  }

  function startTouchSelection(event: TouchEvent, currentView: EditorView) {
    if (event.touches.length >= 2 && isEditorTarget(event.target)) {
      touchSelection = null;
      beginScrollGestureKeyboardSuppression(currentView);
      initTwoFingerPanFromTouches(event.touches);
      return;
    }

    if (event.touches.length === 1 && isScrollerChromeTarget(event.target)) {
      beginScrollGestureKeyboardSuppression(currentView);
      return;
    }

    if (event.touches.length !== 1 || !isEditorContentTarget(event.target)) return;

    const touch = event.touches.item(0);
    if (!touch) return;
    const pos = currentView.posAtCoords({ x: touch.clientX, y: touch.clientY });
    if (pos == null) return;

    touchSelection = {
      identifier: touch.identifier,
      anchor: pos,
      moved: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
    // Do not preventDefault on touchstart: iOS/Android need the default touch
    // path on the contenteditable surface so the virtual keyboard can open.
    currentView.focus();
    selectEditorRange(pos, pos);
  }

  function moveTouchSelection(event: TouchEvent, currentView: EditorView) {
    if (event.touches.length >= 2 && isEditorTarget(event.target)) {
      touchSelection = null;
      applyTwoFingerPan(event, currentView);
      return;
    }

    if (!touchSelection) return;
    const touch = getTouchByIdentifier(event.changedTouches, touchSelection.identifier);
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - touchSelection.startX);
    const deltaY = Math.abs(touch.clientY - touchSelection.startY);
    if (!touchSelection.moved && Math.max(deltaX, deltaY) < touchSelectMoveThreshold) return;

    beginScrollGestureKeyboardSuppression(currentView);

    // Only preventDefault once the finger moves past the tap threshold so the
    // browser can still run default touch handling on a simple tap (soft keyboard).
    event.preventDefault();
    event.stopPropagation();

    const pos = currentView.posAtCoords({ x: touch.clientX, y: touch.clientY });
    if (pos == null) return;

    touchSelection.moved = true;
    selectEditorRange(touchSelection.anchor, pos, true);
  }

  function endTouchSelection(event: TouchEvent) {
    clearScrollKeyboardSuppressionIfIdle(event);
    clearTwoFingerPanIfNeeded(event);

    if (!touchSelection) return;
    const touch = getTouchByIdentifier(event.changedTouches, touchSelection.identifier);
    if (!touch) return;

    if (touchSelection.moved) {
      event.preventDefault();
      event.stopPropagation();
    }
    touchSelection = null;
  }

  function toggleLineComments() {
    if (!view) return;

    const doc = view.state.doc;
    const lineNumbers = new Set<number>();
    for (const range of view.state.selection.ranges) {
      const startLine = doc.lineAt(range.from).number;
      const rawEndLine = doc.lineAt(range.to).number;
      const endLine = range.to === doc.line(rawEndLine).from && rawEndLine > startLine ? rawEndLine - 1 : rawEndLine;
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
        lineNumbers.add(lineNumber);
      }
    }

    const sortedLineNumbers = [...lineNumbers].sort((left, right) => left - right);
    const allCommented = sortedLineNumbers.every((lineNumber) => {
      const line = doc.line(lineNumber).text;
      return !line.trim() || /^\s*\//.test(line);
    });

    const changes = sortedLineNumbers.map((lineNumber) => {
      const line = doc.line(lineNumber);
      const nextLine = !line.text.trim()
        ? line.text
        : allCommented
          ? line.text.replace(/^(\s*)\/ ?/, '$1')
          : line.text.replace(/^(\s*)/, '$1/');

      return { from: line.from, to: line.to, insert: nextLine };
    });

    view.dispatch({ changes, userEvent: 'input' });
  }

  function handleWindowShortcuts(event: KeyboardEvent) {
    if (!usesPrimaryModifier(event)) return;

    if (!event.shiftKey && !event.altKey && event.code === 'KeyO') {
      event.preventDefault();
      dispatchShortcut('qanvas:toggle-projects');
      return;
    }

    const editorFocused = view?.hasFocus || isEditorTarget(event.target) || isEditorTarget(document.activeElement);
    const activeOutsideEditor = isPlainTextInput(document.activeElement) && !isEditorTarget(document.activeElement);
    if (!event.altKey && isCommentShortcut(event) && (editorFocused || !activeOutsideEditor)) {
      event.preventDefault();
      toggleLineComments();
    }
  }

  function getLiteralAnchor(literal: InlineControlLiteral & { lineNumber: number }) {
    return `${literal.lineNumber}:${literal.startColumn}`;
  }

  function clearInlineControlHideTimer() {
    if (!inlineControlHideTimer) return;
    clearTimeout(inlineControlHideTimer);
    inlineControlHideTimer = null;
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

  function resetInlineControls() {
    clearInlineControlHideTimer();
    teardownColorPickr();
    activeInlineLiteral = null;
    inlineControlPinned = false;
  }

  function scheduleInlineControlHide() {
    clearInlineControlHideTimer();
    if (inlineControlPinned) return;
    inlineControlHideTimer = setTimeout(() => {
      inlineControlHideTimer = null;
      if (!inlineControlPinned) {
        resetInlineControls();
      }
    }, 140);
  }

  function resolveInlineLiteralAtPos(pos: number) {
    if (!view) return null;
    const line = view.state.doc.lineAt(pos);
    const column = pos - line.from + 1;
    const literal = findInlineControlLiteral(line.text, column);
    return literal ? { ...literal, lineNumber: line.number } : null;
  }

  function layoutInlineControl(literal: InlineControlLiteral & { lineNumber: number }) {
    if (!view || !host) return;
    const line = view.state.doc.line(literal.lineNumber);
    const coords = view.coordsAtPos(line.from + literal.startColumn - 1);
    const hostRect = host.getBoundingClientRect();
    if (!coords) return;

    const left = Math.max(8, coords.left - hostRect.left);
    const top = Math.max(8, coords.top - hostRect.top - 44);
    inlineControlStyle = `left: ${left}px; top: ${top}px;`;
  }

  function setActiveInlineControl(literal: (InlineControlLiteral & { lineNumber: number }) | null) {
    if (!literal) {
      if (!inlineControlPinned) scheduleInlineControlHide();
      return;
    }

    clearInlineControlHideTimer();
    activeInlineLiteral = literal;
    layoutInlineControl(literal);
  }

  function updateInlineControlFromPos(pos: number | null) {
    if (pos == null || view?.state.selection.main.from !== view?.state.selection.main.to) {
      if (!inlineControlPinned) scheduleInlineControlHide();
      return;
    }

    const literal = resolveInlineLiteralAtPos(pos);
    if (literal) {
      setActiveInlineControl(literal);
    } else if (!inlineControlPinned) {
      scheduleInlineControlHide();
    }
  }

  function applyActiveInlineLiteralChange(nextRaw: string) {
    if (!view || !activeInlineLiteral || nextRaw === activeInlineLiteral.raw) return;
    const currentLiteral = activeInlineLiteral;
    const line = view.state.doc.line(currentLiteral.lineNumber);
    pendingChangeOrigin = 'interactive';
    view.dispatch({
      changes: {
        from: line.from + currentLiteral.startColumn - 1,
        to: line.from + currentLiteral.endColumn - 1,
        insert: nextRaw,
      },
      userEvent: 'input',
    });

    const updatedLiteral = resolveInlineLiteralAtPos(line.from + currentLiteral.startColumn - 1);
    if (updatedLiteral) {
      activeInlineLiteral = updatedLiteral;
      layoutInlineControl(updatedLiteral);
    } else {
      resetInlineControls();
    }
  }

  function ensureColorPickr(node: HTMLButtonElement, literal: ColorInlineControlLiteral & { lineNumber: number }) {
    const anchor = getLiteralAnchor(literal);
    if (inlineColorPickr && inlineColorPickrAnchor === anchor) {
      inlineColorPickrIsSyncing = true;
      inlineColorPickr.setColor(literal.value, true);
      inlineColorPickrIsSyncing = false;
      return;
    }

    teardownColorPickr();
    inlineColorPickrAnchor = anchor;
    inlineColorPickr = Pickr.create({
      el: node,
      theme: 'nano',
      useAsButton: true,
      default: literal.value,
      container: inlineControlHost ?? undefined,
      lockOpacity: true,
      comparison: false,
      closeOnScroll: true,
      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: { hex: true, input: true, save: false, clear: false, cancel: false },
      },
    });
    inlineColorPickr.on('show', () => {
      inlineControlPinned = true;
      clearInlineControlHideTimer();
    });
    inlineColorPickr.on('hide', () => {
      inlineControlPinned = false;
      scheduleInlineControlHide();
    });
    inlineColorPickr.on('change', (color: { toHEXA: () => { toString: () => string } } | null) => {
      if (inlineColorPickrIsSyncing || !color || !activeInlineLiteral || activeInlineLiteral.kind !== 'color') return;
      const rawHex = color.toHEXA().toString();
      const normalHex = rawHex.startsWith('#') ? `#${rawHex.slice(1, 7)}` : `#${rawHex.slice(0, 6)}`;
      applyActiveInlineLiteralChange(formatInlineControlValue(activeInlineLiteral, normalHex));
    });
  }

  const mobileSlashSnippets = Q_SLASH_SNIPPETS.map((item) =>
    mergeCompletionDocumentationIntoDetail(
      snippetCompletion(item.insertText, {
        label: item.label,
        detail: item.detail,
        info: item.documentation,
        type: 'keyword',
      })
    )
  );

  const mobileQanvasCompletions = Q_CANVAS_FUNCTIONS.map((item) =>
    mergeCompletionDocumentationIntoDetail(
      snippetCompletion(item.insertText, {
        label: item.label,
        detail: item.detail,
        info: item.documentation,
        type: 'function',
      })
    )
  );

  const mobileContextCompletions = Q_CONTEXT_SYMBOLS.map((item) =>
    mergeCompletionDocumentationIntoDetail(
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
    )
  );

  const mobileColorCompletions = Q_COLOR_SYMBOLS.map((item) =>
    mergeCompletionDocumentationIntoDetail({
      label: item.label,
      detail: item.detail,
      info: item.documentation,
      apply: item.insertText,
      type: 'constant',
    } satisfies Completion)
  );

  const mobileNamespaceCompletions = Q_NAMESPACE_SYMBOLS.map((item) =>
    mergeCompletionDocumentationIntoDetail({
      label: item.label,
      detail: item.detail,
      info: item.documentation,
      type: item.type,
    } satisfies Completion)
  );

  const mobileBuiltinCompletions = Q_BUILTIN_FUNCTIONS.map((label) =>
    mergeCompletionDocumentationIntoDetail({
      label,
      detail: 'q built-in',
      info: 'Built-in q function.',
      type: 'function',
    } satisfies Completion)
  );

  const mobileKeywordCompletions = Q_KEYWORDS.map((label) =>
    mergeCompletionDocumentationIntoDetail({
      label,
      detail: 'q keyword',
      info: 'Core q keyword or query word.',
      type: 'keyword',
    } satisfies Completion)
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
    ...mobileNamespaceCompletions,
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
            closeOnBlur: false,
          }),
          completionUiTheme,
          syntaxHighlighting(qMobileEditorHighlightStyle),
          editorTheme,
          bracketMatching(),
          indentOnInput(),
          keymap.of([
            { key: 'Mod-s', run: () => (dispatchShortcut('qanvas:save'), true) },
            { key: 'Mod-b', run: () => (dispatchShortcut('qanvas:toggle-sidebar'), true) },
            { key: 'Mod-e', run: () => (dispatchShortcut('qanvas:toggle-examples'), true) },
            { key: 'Mod-o', run: () => (dispatchShortcut('qanvas:toggle-projects'), true) },
            { key: 'Mod-n', run: () => (dispatchShortcut('qanvas:new-sketch'), true) },
            { key: 'Shift-Alt-ArrowDown', run: copyLineDown },
            { key: 'Shift-Alt-ArrowUp', run: copyLineUp },
            { key: 'Alt-ArrowDown', run: moveLineDown },
            { key: 'Alt-ArrowUp', run: moveLineUp },
            { key: 'Mod-Enter', run: insertBlankLine },
            { key: 'Mod-Shift-Enter', run: insertNewlineAndIndent },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.selectionSet) updateSelectionMetadata();
            if (!update.docChanged || isApplyingExternalValue) return;
            lastValue = update.state.doc.toString();
            emitEditorChange(lastValue);
          }),
          EditorView.domEventHandlers({
            touchstart(event, currentView) {
              startTouchSelection(event, currentView);
            },
            touchmove(event, currentView) {
              moveTouchSelection(event, currentView);
            },
            touchend(event) {
              endTouchSelection(event);
            },
            touchcancel(event) {
              endTouchSelection(event);
            },
            mousemove(event, currentView) {
              const pos = currentView.posAtCoords({ x: event.clientX, y: event.clientY });
              updateInlineControlFromPos(pos);
            },
            mouseleave() {
              if (!inlineControlPinned) scheduleInlineControlHide();
            },
            blur() {
              if (!inlineControlPinned) scheduleInlineControlHide();
            },
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
    currentKey = activeKey;
    updateSelectionMetadata();

    window.addEventListener('keydown', handleWindowShortcuts, true);
    removeWindowShortcuts = () => window.removeEventListener('keydown', handleWindowShortcuts, true);

    const handleCommentToggle = () => toggleLineComments();
    window.addEventListener('qanvas:toggle-comment', handleCommentToggle as EventListener);
    removeCommentToggle = () => window.removeEventListener('qanvas:toggle-comment', handleCommentToggle as EventListener);

    return () => {
      removeWindowShortcuts();
      removeCommentToggle();
      view?.destroy();
      view = null;
    };
  });

  $effect(() => {
    if (!view) return;
    if (currentKey === activeKey && value === lastValue) return;
    currentKey = activeKey;
    lastValue = value;
    resetInlineControls();
    isApplyingExternalValue = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    isApplyingExternalValue = false;
  });

  onDestroy(() => {
    removeWindowShortcuts();
    removeCommentToggle();
    resetInlineControls();
    view?.destroy();
    view = null;
  });

  $effect(() => {
    if (!activeInlineLiteral) return;
    const triggerNode = inlineControlHost?.querySelector<HTMLButtonElement>('.qanvas-inline-control__pickr-trigger');
    if (triggerNode) ensureColorPickr(triggerNode, activeInlineLiteral);
  });
</script>

<div class="qanvas-code-editor mobile-code-editor" bind:this={host}>
  {#if activeInlineLiteral}
    <div
      class="qanvas-inline-control"
      class:is-hidden={!activeInlineLiteral}
      data-kind={activeInlineLiteral.kind}
      role="toolbar"
      aria-label="Inline literal controls"
      tabindex="-1"
      bind:this={inlineControlHost}
      style={inlineControlStyle}
      onpointerdown={(event) => {
        inlineControlPinned = true;
        clearInlineControlHideTimer();
        event.stopPropagation();
      }}
      onpointerenter={() => {
        inlineControlPinned = true;
        clearInlineControlHideTimer();
      }}
      onpointerleave={() => {
        inlineControlPinned = false;
        scheduleInlineControlHide();
      }}
    >
      <div class="qanvas-inline-control__pill">
        <span class="qanvas-inline-control__swatch" style={`background: ${activeInlineLiteral.value}`}></span>
        <span class="qanvas-inline-control__value">{activeInlineLiteral.raw}</span>
        <button class="qanvas-inline-control__pickr-trigger" type="button">Pick</button>
      </div>
    </div>
  {/if}
</div>

<style>
  /* `body` uses user-select: none for UI chrome; re-enable for CodeMirror on touch/desktop. */
  .qanvas-code-editor {
    position: relative;
    height: 100%;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    user-select: text;
    -webkit-user-select: text;
    touch-action: none;
  }

  .qanvas-code-editor :global(.cm-editor) {
    height: 100%;
  }

  .qanvas-code-editor :global(.qanvas-inline-control) {
    position: absolute;
    z-index: 30;
  }

  .qanvas-code-editor :global(.cm-scroller) {
    -webkit-overflow-scrolling: touch;
  }

  .qanvas-code-editor :global(.cm-editor),
  .qanvas-code-editor :global(.cm-content),
  .qanvas-code-editor :global(.cm-line) {
    user-select: text;
    -webkit-user-select: text;
    touch-action: none;
    -webkit-touch-callout: default;
  }
</style>
