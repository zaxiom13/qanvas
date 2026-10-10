import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { deployment } from "../tools/verify-deployment.mjs";
import { resolveCommit, versionPayload } from "../tools/version-json.mjs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const wrangler = JSON.parse(read("../wrangler.jsonc"));
const pkg = JSON.parse(read("../package.json"));
const ci = read("../.github/workflows/deploy.yml");
const check = read("../.github/workflows/deployment-check.yml");
const headers = read("../public/_headers");

describe("Workers Builds deployment", () => {
  test("wrangler keeps the qanvas asset worker and opts into builds and previews", () => {
    expect(wrangler.name).toBe("qanvas");
    expect(wrangler.workers_dev).toBe(true);
    expect(wrangler.assets).toEqual({ directory: "./dist" });
    expect(wrangler.build).toEqual({ command: "npm run build" });
    expect(wrangler.previews).toEqual({});
  });

  test("manual deploy is wrangler deploy, which runs the configured build", () => {
    expect(pkg.scripts.build).toBe("vite build");
    expect(pkg.scripts.deploy).toBe("wrangler deploy");
  });

  test("GitHub CI checks the app and does not deploy", () => {
    expect(ci).not.toMatch(/wrangler deploy/);
    expect(ci).not.toMatch(/CLOUDFLARE_API_TOKEN/);
    expect(ci).toMatch(/npm run check/);
    expect(ci).toMatch(/npm test/);
    expect(ci).toMatch(/npm run build/);
  });

  test("the deployment check runs on main, read-only, and does not deploy", () => {
    expect(check).toMatch(/branches:\s*\[main\]/);
    expect(check).toMatch(/workflow_dispatch/);
    expect(check).toMatch(/contents:\s*read/);
    expect(check).toMatch(/node tools\/verify-deployment\.mjs/);
    expect(check).not.toMatch(/wrangler deploy/);
    expect(check).not.toMatch(/\bwrite\b/);
  });

  test("the verifier targets this repo's production workers.dev URL", () => {
    expect(deployment).toEqual({
      repo: "zaxiom13/qanvas",
      branch: "main",
      url: "https://qanvas.z-axiom-413.workers.dev",
    });
  });

  test("version.json records the Workers Builds commit, otherwise git", () => {
    const sha = "abc123def456abc123def456abc123def456abcd";
    expect(resolveCommit({ WORKERS_CI_COMMIT_SHA: sha, GITHUB_SHA: "other" })).toBe(sha);
    expect(resolveCommit({ CF_PAGES_COMMIT_SHA: sha })).toBe(sha);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    expect(resolveCommit({})).toBe(head);
    expect(versionPayload({ WORKERS_CI_COMMIT_SHA: sha }, new Date("2026-10-10T07:51:35.323Z"))).toEqual({
      commit: sha,
      builtAt: "2026-10-10T07:51:35.323Z",
    });
  });

  test("static asset headers still refuse to cache the shell", () => {
    expect(headers).toContain("/sw.js");
    expect(headers).toContain("Cache-Control: no-cache, no-store, must-revalidate");
    expect(headers).toContain("/index.html");
  });
});
