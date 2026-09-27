import { Session } from "../src/q/index";
const s = new Session();
for (const l of ["X:flip (1 2 3f;4 5 6f)", "X", "X-\:0.5 0.5", "(1 2;3 4;5 6)-\:10 20", "1 2 3-\:10", "(1 2;3 4) -\: 1 1"]) { const r = s.evaluate(l); console.log(l, "=>", r.error ? "'" + r.error.qname + " " + r.error.hint : r.text); }
