// Enforces the module boundaries described in docs/ARCHITECTURE.md.
// Run: node tools/check-architecture.mjs   (also part of `npm run check`)
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const SRC = resolve("src");

// Which top-level modules each module may import. Anything not listed is forbidden.
const ALLOWED = {
  q: [],
  drawing: ["q"],
  presentation: ["q"],
  runtime: ["q", "drawing"],
  sketches: [],
  learning: ["q", "runtime", "presentation"],
  content: ["learning"],
  editor: ["content"],
  adapters: ["q", "drawing", "runtime", "sketches", "learning", "presentation"],
  ui: ["q", "drawing", "runtime", "presentation", "editor", "adapters", "app"],
  features: ["q", "drawing", "runtime", "presentation", "editor", "adapters", "app", "sketches", "learning", "content", "ui"],
  app: ["*"],
  main: ["app", "app.css"],
};

// Packages that tie code to the browser or a UI framework stay out of the core.
const CORE = ["q", "drawing", "presentation", "runtime", "sketches", "learning", "content"];
const PLATFORM_PACKAGES = /^(svelte|p5|idb-keyval|@codemirror\/|@lezer\/|paneforge|bits-ui|@lucide\/)/;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const isSource = (f) => /\.(ts|svelte)$/.test(f) && !f.endsWith(".d.ts");
const moduleOf = (file) => relative(SRC, file).split(sep)[0].replace(/\.(ts|svelte)$/, "");
const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

const problems = [];
for (const file of walk(SRC).filter(isSource)) {
  const from = moduleOf(file);
  const allowed = ALLOWED[from];
  if (!allowed) {
    problems.push(`${relative(".", file)}: module "${from}" is not registered in tools/check-architecture.mjs`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  for (const m of source.matchAll(IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (spec.startsWith(".")) {
      const target = resolve(dirname(file), spec);
      if (!target.startsWith(SRC)) continue;
      const to = moduleOf(target);
      if (to !== from && !allowed.includes("*") && !allowed.includes(to)) {
        problems.push(`${relative(".", file)}: "${from}" must not import "${to}" (${spec})`);
      }
    } else if (CORE.includes(from) && PLATFORM_PACKAGES.test(spec)) {
      problems.push(`${relative(".", file)}: core module "${from}" must not depend on platform package "${spec}"`);
    }
  }
}

if (problems.length) {
  console.error("Architecture boundary violations:\n  " + problems.join("\n  "));
  console.error("\nSee docs/ARCHITECTURE.md. Move the code to the owning module, or pass what it needs in through a port.");
  process.exit(1);
}
console.log("Architecture boundaries OK.");
