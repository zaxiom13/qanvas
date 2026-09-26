import { Session, formatError } from "../src/q/index";
import { QANVAS_Q } from "../src/qanvas/qlib";
const s = new Session();
for (const line of QANVAS_Q.split("\n")) {
  if (!line.trim() || line.startsWith("\\")) { if (line.startsWith("\d")) s.run(line); continue; }
  const r = s.evaluate(line);
  if (r.error) console.log(line, "\n  ", r.errorText, r.error.hint);
}
