import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { linter, lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import {
  Decoration, EditorView, ViewPlugin, drawSelection, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap,
  lineNumbers, placeholder as cmPlaceholder, type DecorationSet, type ViewUpdate,
} from "@codemirror/view";
import { KIND_LABEL, REFERENCE, REF_BY_NAME } from "../content/reference";
import { qSyntax } from "./qlang";

export const editorTheme = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "var(--code-bg)",
    fontSize: "14px",
    height: "100%",
  },
  ".cm-scroller": { fontFamily: "var(--font-code)", lineHeight: "1.6", overflow: "auto" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 14px 0 12px" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection) !important",
  },
  ".cm-gutters": { backgroundColor: "var(--code-bg)", color: "var(--text-3)", border: "none", paddingLeft: "6px" },
  ".cm-lineNumbers .cm-gutterElement": { fontSize: "12px", minWidth: "26px" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-2)" },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)", outline: "none" },
  ".cm-tooltip": {
    border: "1px solid var(--line)",
    background: "var(--surface)",
    borderRadius: "10px",
    boxShadow: "var(--shadow-lg)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-code)", fontSize: "13px", maxHeight: "16em" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px !important" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "var(--accent)", color: "var(--accent-text)" },
  ".cm-completionDetail": { opacity: 0.7, marginLeft: "10px", fontStyle: "normal" },
  ".cm-completionInfo": { padding: "10px 12px", maxWidth: "320px", fontFamily: "var(--font-ui)" },
  ".cm-diagnostic-error": { borderLeft: "3px solid var(--bad)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--bad)",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-panels": { background: "var(--surface)", color: "var(--text)" },
  ".cm-placeholder": { color: "var(--text-3)", fontStyle: "italic" },
  ".cm-scrub": { cursor: "ew-resize", borderBottom: "1px dashed color-mix(in srgb, var(--syn-number) 60%, transparent)" },
  ".cm-scrubbing": { background: "color-mix(in srgb, var(--syn-number) 18%, transparent)", borderRadius: "3px" },
});

// ---------- completion ----------
const COMPLETIONS: Completion[] = REFERENCE.filter((r) => /^[.a-zA-Z]/.test(r.name)).map((r) => ({
  label: r.name,
  type: r.kind === "draw" ? "function" : r.kind === "input" ? "variable" : r.kind === "keyword" ? "keyword" : r.kind === "complex" ? "namespace" : "function",
  detail: r.sig,
  info: () => infoDom(r.name),
  boost: r.kind === "draw" ? 2 : r.kind === "keyword" ? 1 : 0,
}));

function infoDom(name: string): HTMLElement {
  const r = REF_BY_NAME.get(name)!;
  const el = document.createElement("div");
  el.className = "cm-ref-info";
  const sig = document.createElement("div");
  sig.style.cssText = "font-family:var(--font-code);font-size:12.5px;color:var(--accent);margin-bottom:4px";
  sig.textContent = r.sig;
  const sum = document.createElement("div");
  sum.style.cssText = "font-size:13px;line-height:1.45;color:var(--text)";
  sum.textContent = r.summary;
  el.append(sig, sum);
  if (r.ex[0]) {
    const ex = document.createElement("code");
    ex.style.cssText = "display:block;margin-top:8px;font-size:12px;color:var(--text-2);white-space:pre-wrap";
    ex.textContent = r.ex[0];
    el.append(ex);
  }
  return el;
}

function localNames(state: EditorState): Completion[] {
  const text = state.doc.toString();
  const seen = new Set<string>();
  const out: Completion[] = [];
  for (const m of text.matchAll(/(^|[\s;{(\[])([a-zA-Z][\w]*)\s*::?(?!:)/g)) {
    const n = m[2];
    if (seen.has(n) || REF_BY_NAME.has(n)) continue;
    seen.add(n);
    out.push({ label: n, type: "variable", boost: 3 });
  }
  return out;
}

function qComplete(ctx: CompletionContext) {
  const word = ctx.matchBefore(/\.?[a-zA-Z][\w.]*/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  // not inside strings/comments
  const line = ctx.state.doc.lineAt(ctx.pos);
  const before = line.text.slice(0, ctx.pos - line.from);
  if ((before.match(/"/g) ?? []).length % 2 === 1) return null;
  if (/(^|\s)\//.test(before)) return null;
  if (before[before.length - word.text.length - 1] === "`") return null;
  return { from: word.from, options: [...localNames(ctx.state), ...COMPLETIONS], validFor: /^\.?[\w.]*$/ };
}

// ---------- hover ----------
const qHover = hoverTooltip((view, pos) => {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const i = pos - line.from;
  // find a word or glyph around pos
  let s = i, e = i;
  const isW = (c: string) => /[\w.]/.test(c);
  if (isW(text[i] ?? "") || isW(text[i - 1] ?? "")) {
    while (s > 0 && isW(text[s - 1])) s--;
    while (e < text.length && isW(text[e])) e++;
  } else {
    const two = text.slice(i, i + 2), prev2 = text.slice(i - 1, i + 1);
    if (REF_BY_NAME.has(two)) { s = i; e = i + 2; }
    else if (REF_BY_NAME.has(prev2)) { s = i - 1; e = i + 1; }
    else { s = i; e = i + 1; }
  }
  const w = text.slice(s, e);
  const r = REF_BY_NAME.get(w);
  if (!r) return null;
  return {
    pos: line.from + s,
    end: line.from + e,
    above: true,
    create: () => {
      const dom = infoDom(w);
      dom.style.padding = "10px 12px";
      dom.style.maxWidth = "340px";
      const k = document.createElement("div");
      k.style.cssText = "font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:2px;font-weight:650";
      k.textContent = `${KIND_LABEL[r.kind]} · ${r.cat}`;
      dom.prepend(k);
      return { dom };
    },
  };
}, { hoverTime: 350 });

// ---------- error diagnostics (pushed from the runtime) ----------
export const setQError = (view: EditorView, err: { from: number; to: number; message: string } | null) => {
  const diags: Diagnostic[] = [];
  if (err) {
    const len = view.state.doc.length;
    const from = Math.max(0, Math.min(len, err.from));
    const to = Math.max(from, Math.min(len, err.to));
    diags.push({ from, to: to === from ? Math.min(len, from + 1) : to, severity: "error", message: err.message });
  }
  view.dispatch(setDiagnostics(view.state, diags));
};

// ---------- number scrubbing (Alt/Option-drag a number, or drag in scrub mode) ----------
const setScrubMode = StateEffect.define<boolean>();
export const scrubModeField = StateField.define<boolean>({
  create: () => false,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setScrubMode)) return e.value;
    return v;
  },
});
export const toggleScrub = (view: EditorView, on: boolean) => view.dispatch({ effects: setScrubMode.of(on) });

const NUM_AT = /-?\d+\.?\d*(?:e[+-]?\d+)?/g;

function numberAt(view: EditorView, pos: number): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(pos);
  for (const m of line.text.matchAll(NUM_AT)) {
    const from = line.from + m.index!, to = from + m[0].length;
    if (pos >= from && pos <= to) {
      const before = line.text[m.index! - 1] ?? " ";
      if (/[a-zA-Z_`]/.test(before)) return null;
      if (/[a-zA-Z_:]/.test(line.text[m.index! + m[0].length] ?? "") && line.text[m.index! + m[0].length] !== "f") return null;
      return { from, to, text: m[0] };
    }
  }
  return null;
}

export function scrubber(onScrub: () => void): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decos: DecorationSet = Decoration.none;
      active: { from: number; to: number; start: number; x: number; decimals: number; base: number } | null = null;
      constructor(readonly view: EditorView) {}
      update(u: ViewUpdate) {
        if (u.docChanged && this.active) {
          // keep range in sync as text length changes
        }
      }
    },
    {
      eventHandlers: {
        pointerdown(e: PointerEvent, view: EditorView) {
          const scrubMode = view.state.field(scrubModeField, false);
          if (!e.altKey && !scrubMode) return false;
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos == null) return false;
          const n = numberAt(view, pos);
          if (!n) return false;
          e.preventDefault();
          const dec = n.text.includes(".") ? n.text.split(".")[1].length : 0;
          let cur = { from: n.from, to: n.to };
          const base = parseFloat(n.text);
          const x0 = e.clientX;
          const el = e.target as HTMLElement;
          el.setPointerCapture?.(e.pointerId);
          let last = n.text;
          const step = dec ? Math.pow(10, -dec) : Math.max(1, Math.abs(base) >= 100 ? 1 : 1);
          const move = (ev: PointerEvent) => {
            const dx = ev.clientX - x0;
            const fine = ev.shiftKey ? 0.1 : 1;
            let v = base + Math.round((dx / 4) * fine) * step;
            let s = dec ? v.toFixed(dec) : String(Math.round(v));
            if (s === "-0") s = "0";
            if (s === last) return;
            view.dispatch({ changes: { from: cur.from, to: cur.to, insert: s }, userEvent: "input.scrub" });
            cur = { from: cur.from, to: cur.from + s.length };
            last = s;
            onScrub();
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          return true;
        },
      },
    },
  );
  return [scrubModeField, plugin];
}

export interface EditorOpts {
  lineNumbers?: boolean;
  placeholder?: string;
  onRun?: () => void;
  onChange?: (text: string) => void;
  onScrub?: () => void;
  readOnly?: boolean;
  compact?: boolean;
  /** console mode: Enter runs, Up/Down walk history */
  console?: boolean;
  onHistory?: (dir: -1 | 1) => string | null;
}

function consoleKeys(o: EditorOpts): Extension {
  const walk = (dir: -1 | 1) => (view: EditorView) => {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.head);
    if (dir < 0 && line.number !== 1) return false;
    if (dir > 0 && line.number !== state.doc.lines) return false;
    const next = o.onHistory?.(dir);
    if (next == null) return false;
    view.dispatch({ changes: { from: 0, to: state.doc.length, insert: next }, selection: { anchor: next.length } });
    return true;
  };
  return keymap.of([
    ...completionKeymap,
    { key: "Enter", run: () => (o.onRun?.(), true) },
    { key: "ArrowUp", run: walk(-1) },
    { key: "ArrowDown", run: walk(1) },
  ]);
}

export function qExtensions(o: EditorOpts): Extension[] {
  const ext: Extension[] = [
    qSyntax,
    editorTheme,
    history(),
    drawSelection(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    highlightSelectionMatches(),
    autocompletion({ override: [qComplete], icons: false, activateOnTypingDelay: 120 }),
    qHover,
    linter(null),
    EditorView.lineWrapping,
    ...(o.console ? [consoleKeys(o)] : []),
    keymap.of([
      { key: "Mod-Enter", run: () => (o.onRun?.(), true), preventDefault: true },
      { key: "Shift-Enter", run: () => (o.onRun?.(), true), preventDefault: true },
      { key: "Mod-/", run: toggleComment },
      ...closeBracketsKeymap,
      ...completionKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
      ...defaultKeymap,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) o.onChange?.(u.state.doc.toString());
    }),
    EditorState.tabSize.of(2),
  ];
  if (o.lineNumbers !== false && !o.compact) ext.push(lineNumbers(), highlightActiveLineGutter(), lintGutter());
  if (!o.compact) ext.push(highlightActiveLine());
  if (o.placeholder) ext.push(cmPlaceholder(o.placeholder));
  if (o.readOnly) ext.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  if (o.onScrub) ext.push(scrubber(o.onScrub));
  return ext;
}
