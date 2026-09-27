import { ERROR_HELP, QError } from "../q/errors";

export interface Explained {
  name: string; // q error name, e.g. type
  caretLine?: string; // the offending source line
  caretCol?: number;
  caretLen?: number;
  hint?: string; // specific, from the engine
  help?: string; // general meaning of this error
  tip?: string; // extra heuristics
  where?: { from: number; to: number }; // absolute range in the edited source (if known)
}

export function explainError(err: QError, src: string): Explained {
  const out: Explained = { name: err.qname, hint: err.hint, help: ERROR_HELP[err.qname] };
  const code = err.span?.src ?? src;
  if (err.span && code != null) {
    const { s, e } = err.span;
    const lineStart = code.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = code.indexOf("\n", s);
    if (lineEnd < 0) lineEnd = code.length;
    out.caretLine = code.slice(lineStart, lineEnd);
    out.caretCol = s - lineStart;
    out.caretLen = Math.max(1, Math.min(e, lineEnd) - s);
    // map back to the edited source when the error came from inside a lambda
    if (!err.span.src || err.span.src === src) out.where = { from: s, to: e };
    else {
      const at = src.indexOf(err.span.src);
      if (at >= 0) out.where = { from: at + s, to: at + e };
    }
    // a line break inside {...} is not a statement separator in q
    const before = code.slice(0, s);
    const nl = before.lastIndexOf("\n");
    if (nl >= 0 && /^\s*$/.test(before.slice(nl + 1))) {
      const prev = before.slice(0, nl).replace(/\s*\/[^\n]*$/, "").trimEnd();
      const last = prev[prev.length - 1];
      const insideLambda = (code.slice(0, s).match(/\{/g) ?? []).length > (code.slice(0, s).match(/\}/g) ?? []).length || !!err.span.src;
      if (insideLambda && last && !";{[(".includes(last)) {
        out.tip = "Inside { } a line break doesn't end a statement. Put a ; at the end of the previous line.";
      }
    }
  }
  if (!ERROR_HELP[err.qname] && /^[a-zA-Z_.][\w.]*$/.test(err.qname) && !out.hint) {
    out.help = `'${err.qname} usually means the name ${err.qname} has no value yet — define it before you use it.`;
  }
  if (err.qname === "stop") out.help = undefined;
  return out;
}
