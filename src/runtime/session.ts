import { Session, NIL, type SessionHost } from "../q/index";
import type { Lambda } from "../q/fns";
import { Api, installApi } from "../drawing/api";
import { QANVAS_Q } from "../drawing/qlib";
import { DEFAULT_INK } from "../drawing/defaults";

/** Shared initialization for live sketches, previews and challenge execution. */
export function createSketchSession(api: Api, host: SessionHost = {}) {
  const session = new Session(host);
  session.imports = [".qv"];
  installApi(session, api);
  session.run(QANVAS_Q);
  api.style.ink = { kind: "one", css: DEFAULT_INK };
  return session;
}

/** q functions can acquire implicit x/y/z parameters; fill every slot. */
export const nils = (f: Lambda) => new Array(Math.max(1, f.rank)).fill(NIL);
