import { readFileSync } from "node:fs";
import { Session } from "../src/q/index";
const out: string[] = [];
const s = new Session({ stdout: (t) => out.push(t), stderr: (t) => out.push(t) });
try { s.run(readFileSync(process.argv[2], "utf8")); } catch (e: any) { out.push("'" + e.qname + (e.hint ? "  (" + e.hint + ")" : "")); }
console.log(out.join("\n"));
