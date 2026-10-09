// App-wide reactive state: routing, preferences, console target.
import type { EvalResult } from "../q/interp";
import { Session } from "../q/index";
import type { QValue } from "../q/index";
import { parseHash as parse, type Route, type Tab } from "./route";

export type { Route, Tab } from "./route";

const load = <T>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem("qanvas:" + k);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem("qanvas:" + k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

export type Theme = "system" | "light" | "dark";

class AppState {
  route = $state<Route>(parse(location.hash));
  theme = $state<Theme>(load("theme", "system"));
  consoleOpen = $state(false);
  autoRun = $state<boolean>(load("autoRun", true));
  /** a line queued for the console (e.g. "try in console" buttons) */
  consoleInject = $state<{ src: string; n: number } | null>(null);
  lastTab = $state<Record<Tab, string>>(load("lastTab", { learn: "", sketch: "", dojo: "", ref: "" }));

  constructor() {
    window.addEventListener("hashchange", () => {
      this.route = parse(location.hash);
      const r = this.route;
      this.lastTab = { ...this.lastTab, [r.tab]: location.hash };
      save("lastTab", this.lastTab);
    });
    this.applyTheme();
  }

  go(path: string) {
    const h = "#/" + path.replace(/^#?\/?/, "");
    if (location.hash !== h) location.hash = h;
  }

  goTab(tab: Tab) {
    const last = this.lastTab[tab];
    if (last && this.route.tab !== tab) location.hash = last;
    else this.go(tab);
  }

  setTheme(t: Theme) {
    this.theme = t;
    save("theme", t);
    this.applyTheme();
  }

  applyTheme() {
    const el = document.documentElement;
    if (this.theme === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", this.theme);
  }

  get dark(): boolean {
    if (this.theme === "dark") return true;
    if (this.theme === "light") return false;
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }

  setAutoRun(v: boolean) {
    this.autoRun = v;
    save("autoRun", v);
  }

  tryInConsole(src: string) {
    this.consoleOpen = true;
    this.consoleInject = { src, n: (this.consoleInject?.n ?? 0) + 1 };
  }
}

export const app = new AppState();

// ---------- console target ----------
export interface ConsoleTarget {
  name: string;
  evaluate(src: string): EvalResult | null;
  trace(src: string): { steps: { s: number; e: number; value: QValue }[]; result: EvalResult } | null;
}

const scratch = new Session();
export const scratchTarget: ConsoleTarget = {
  name: "scratch",
  evaluate: (src) => scratch.evaluate(src),
  trace: (src) => scratch.trace(src),
};

class ConsoleHub {
  target = $state.raw<ConsoleTarget>(scratchTarget);
  lines = $state.raw<ConsoleLine[]>([]);
  private id = 0;
  use(t: ConsoleTarget | null) {
    this.target = t ?? scratchTarget;
  }
  push(l: Omit<ConsoleLine, "id">) {
    const next = [...this.lines, { ...l, id: ++this.id }];
    this.lines = next.length > 400 ? next.slice(-400) : next;
  }
  clear() {
    this.lines = [];
  }
}

export interface ConsoleLine {
  id: number;
  kind: "in" | "out" | "err" | "info" | "value";
  text: string;
  value?: QValue;
  src?: string;
  err?: import("./explain").Explained;
  trace?: { s: number; e: number; value: QValue }[];
}

export const consoleHub = new ConsoleHub();
