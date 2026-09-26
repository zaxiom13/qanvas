// Runs q expressions through a real KDB-X install inside WSL and returns REPL output per expression.
// Usage: node tools/oracle.mjs file.txt   (one expression per line)  -> prints JSON [{src,out}]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SEP = "~~ORACLE~~";

export function runOracle(exprs) {
  const dir = mkdtempSync(join(tmpdir(), "qor-"));
  const script = join(dir, "in.q");
  const body = exprs.map((e) => `${e}\n-1"${SEP}";`).join("\n") + "\n\\\\\n";
  writeFileSync(script, body);
  const wslPath = "/mnt/" + script[0].toLowerCase() + script.slice(2).replace(/\\/g, "/");
  const r = spawnSync("wsl", ["-d", "Ubuntu", "-u", "root", "--cd", "/root", "--", "bash", "-c", `/root/.kx/bin/q -q -c 25 200 < '${wslPath}' 2>&1`], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  const text = (r.stdout ?? "").replace(/\0/g, "") + (r.stderr ?? "").replace(/\0/g, "");
  const parts = text.split(SEP + "\n");
  return exprs.map((src, i) => ({ src, out: (parts[i] ?? "<missing>").replace(/\r/g, "") }));
}

if (process.argv[1] && process.argv[1].endsWith("oracle.mjs")) {
  const lines = readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter((l) => l.trim());
  const res = runOracle(lines);
  if (process.argv.includes("--json")) console.log(JSON.stringify(res, null, 1));
  else for (const { src, out } of res) console.log(`q)${src}\n${out}`);
}
