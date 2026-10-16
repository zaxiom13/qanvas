import { REF_BY_NAME, type RefEntry } from "../content/reference";

export interface CallHint {
  name: string;
  /** Argument under the cursor, counting from 0. */
  arg: number;
  /** Parameter texts from the bracket form of the catalog signature. Null when the catalog has no bracket form. */
  params: string[] | null;
  sig: string;
}

/** The call the cursor is inside, if the name is written just before `[`. */
export function activeCall(src: string, pos: number): { name: string; arg: number } | null {
  let i = 0;
  const end = Math.min(Math.max(pos, 0), src.length);
  const stack: { name: string; arg: number }[] = [];
  while (i < end) {
    const c = src[i];
    if (c === '"') {
      i++;
      while (i < end) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // A slash after whitespace, or at the start of a line, starts a comment.
    if (c === "/" && (i === 0 || src[i - 1] === "\n" || src[i - 1] === " " || src[i - 1] === "\t")) {
      while (i < end && src[i] !== "\n") i++;
      continue;
    }
    if (c === "\n") {
      stack.length = 0;
      i++;
      continue;
    }
    if (c === "[") {
      let j = i - 1;
      while (j >= 0 && (src[j] === " " || src[j] === "\t")) j--;
      const nameEnd = j + 1;
      while (j >= 0 && /[\w.]/.test(src[j])) j--;
      stack.push({ name: src.slice(j + 1, nameEnd), arg: 0 });
      i++;
      continue;
    }
    if (c === "]") {
      stack.pop();
      i++;
      continue;
    }
    if (c === ";" && stack.length) stack[stack.length - 1].arg++;
    i++;
  }
  const top = stack[stack.length - 1];
  if (!top?.name) return null;
  return top;
}

function paramsOf(entry: RefEntry): string[] | null {
  const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = entry.sig.match(new RegExp(escaped + "\\[([^\\]]*)\\]"));
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return [];
  return inner.split(";").map((s) => s.trim());
}

export function callHint(src: string, pos: number, catalog: Map<string, RefEntry> = REF_BY_NAME): CallHint | null {
  const call = activeCall(src, pos);
  if (!call) return null;
  const entry = catalog.get(call.name);
  if (!entry) return null;
  return { name: call.name, arg: call.arg, params: paramsOf(entry), sig: entry.sig };
}

/** Split the catalog signature so the active parameter can be marked. */
export function hintParts(h: CallHint): { lead: string; active: string | null; tail: string } {
  if (!h.params || h.arg < 0 || h.arg >= h.params.length) return { lead: h.sig, active: null, tail: "" };
  const marker = h.name + "[";
  const open = h.sig.indexOf(marker);
  if (open < 0) return { lead: h.sig, active: null, tail: "" };
  const innerStart = open + marker.length;
  const close = h.sig.indexOf("]", innerStart);
  if (close < 0) return { lead: h.sig, active: null, tail: "" };
  const bits = h.sig.slice(innerStart, close).split(";");
  if (h.arg >= bits.length) return { lead: h.sig, active: null, tail: "" };
  const before = bits.slice(0, h.arg).join(";");
  const rest = bits.slice(h.arg + 1).join(";");
  return {
    lead: h.sig.slice(0, innerStart) + before + (h.arg > 0 ? ";" : ""),
    active: bits[h.arg],
    tail: (rest ? ";" + rest : "") + h.sig.slice(close),
  };
}
