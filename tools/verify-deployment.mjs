// Poll production until version.json matches the commit we expect on main.
// GitHub Actions on main uses GITHUB_SHA; otherwise the script asks GitHub
// which commit main points at. Workers Builds is what publishes the file.
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

export const deployment = {
  repo: "zaxiom13/qanvas",
  branch: "main",
  url: "https://qanvas.z-axiom-413.workers.dev",
};

const timeoutMs = Number(process.env.VERIFY_TIMEOUT_MS ?? 10 * 60 * 1000);
const intervalMs = Number(process.env.VERIFY_INTERVAL_MS ?? 15_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function expectedCommit() {
  const override = (process.env.VERIFY_EXPECT ?? "").trim();
  if (override) return override;
  const sha = (process.env.GITHUB_SHA ?? "").trim();
  const ref = process.env.GITHUB_REF ?? "";
  if (sha && ref === `refs/heads/${deployment.branch}`) return sha;

  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "qanvas-verify-deployment",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${deployment.repo}/commits/${deployment.branch}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${deployment.repo}@${deployment.branch} returned HTTP ${res.status}`);
  const body = await res.json();
  if (typeof body.sha !== "string" || !body.sha) throw new Error("GitHub response has no sha");
  return body.sha;
}

export async function liveVersion() {
  const url = new URL("/version.json", deployment.url);
  url.searchParams.set("t", String(Date.now()));
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const body = await res.json();
  if (!body || typeof body.commit !== "string") return { error: "version.json has no commit" };
  return { commit: body.commit, builtAt: typeof body.builtAt === "string" ? body.builtAt : "" };
}

export async function verifyDeployment() {
  const expected = (await expectedCommit()).trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;
  let last = "no response yet";
  for (;;) {
    try {
      const live = await liveVersion();
      if (live.commit && live.commit.toLowerCase() === expected) {
        console.log(`${deployment.url} is serving ${expected} (built ${live.builtAt || "unknown"})`);
        return;
      }
      last = live.commit ? `commit ${live.commit}` : live.error ?? "unreadable version.json";
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      console.error(`timed out after ${timeoutMs}ms waiting for ${expected} at ${deployment.url}; last live: ${last}`);
      process.exitCode = 1;
      return;
    }
    console.log(`waiting for ${expected}; live is ${last}`);
    await sleep(Math.min(intervalMs, remaining));
  }
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  verifyDeployment().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
