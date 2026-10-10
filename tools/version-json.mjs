// Stamps dist/version.json during `vite build`. Workers Builds sets
// WORKERS_CI_COMMIT_SHA (Pages used CF_PAGES_COMMIT_SHA); local and other
// builds fall back to git, then GITHUB_SHA.
import { execFileSync } from "node:child_process";

export function resolveCommit(env = process.env) {
  const fromCloudflare = [env.WORKERS_CI_COMMIT_SHA, env.CF_PAGES_COMMIT_SHA]
    .map((value) => (value ?? "").trim())
    .find(Boolean);
  if (fromCloudflare) return fromCloudflare;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return (env.GITHUB_SHA ?? "").trim() || "unknown";
  }
}

export function versionPayload(env = process.env, now = new Date()) {
  return { commit: resolveCommit(env), builtAt: now.toISOString() };
}

export function versionJsonPlugin() {
  return {
    name: "qanvas-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify(versionPayload()),
      });
    },
  };
}
