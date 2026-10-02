import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadUpstream, packageRoot } from "./index.js";
import type { UpstreamPin } from "./types.js";

const RAW = "https://raw.githubusercontent.com";
const API = "https://api.github.com";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "cdop-reference-api" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

interface TreeEntry {
  path: string;
  type: string;
}

export async function listUpstreamFiles(repo: string, ref: string, dir: string): Promise<string[]> {
  const tree = await fetchJson<{ tree: TreeEntry[] }>(
    `${API}/repos/${repo}/git/trees/${ref}?recursive=1`,
  );
  return tree.tree
    .filter((t) => t.type === "blob" && t.path.startsWith(`${dir}/`))
    .map((t) => t.path.slice(dir.length + 1));
}

export async function resolveCommit(
  repo: string,
  ref: string,
): Promise<{ sha: string; date: string }> {
  const c = await fetchJson<{ sha: string; commit: { committer: { date: string } } }>(
    `${API}/repos/${repo}/commits/${ref}`,
  );
  return { sha: c.sha, date: c.commit.committer.date };
}

/** Recompute sha256 of every vendored file and compare with UPSTREAM.json. */
export async function verifyVendored(): Promise<{ ok: boolean; mismatches: string[] }> {
  const up = loadUpstream();
  const mismatches: string[] = [];
  for (const [rel, expected] of Object.entries(up.files)) {
    const body = await readFile(new URL(rel, packageRoot));
    const actual = createHash("sha256").update(body).digest("hex");
    if (actual !== expected) mismatches.push(rel);
  }
  return { ok: mismatches.length === 0, mismatches };
}

/** Re-vendor every file from upstream at `ref` and rewrite UPSTREAM.json. */
export async function syncFromUpstream(ref = "main"): Promise<UpstreamPin> {
  const up = loadUpstream();
  const { sha, date } = await resolveCommit(up.repo, ref);
  const files: Record<string, string> = {};
  for (const [local, remote] of Object.entries(up.paths)) {
    const names = await listUpstreamFiles(up.repo, sha, remote);
    await mkdir(new URL(`${local}/`, packageRoot), { recursive: true });
    for (const name of names) {
      const body = await fetchText(`${RAW}/${up.repo}/${sha}/${remote}/${name}`);
      const rel = `${local}/${name}`;
      await writeFile(new URL(rel, packageRoot), body);
      files[rel] = createHash("sha256").update(body).digest("hex");
    }
  }
  const next: UpstreamPin = {
    ...up,
    ref,
    commit: sha,
    commit_date: date,
    fetched_at: new Date().toISOString(),
    files,
  };
  await writeFile(new URL("UPSTREAM.json", packageRoot), JSON.stringify(next, null, 2) + "\n");
  return next;
}

export interface DriftReport {
  pinnedCommit: string;
  upstreamCommit: string;
  changed: string[];
  added: string[];
  removed: string[];
}

/** Compare upstream `ref` against the pinned vendored copy without writing anything. */
export async function driftReport(ref = "main"): Promise<DriftReport> {
  const up = loadUpstream();
  const { sha } = await resolveCommit(up.repo, ref);
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();
  for (const [local, remote] of Object.entries(up.paths)) {
    const names = await listUpstreamFiles(up.repo, sha, remote);
    for (const name of names) {
      const rel = `${local}/${name}`;
      seen.add(rel);
      const body = await fetchText(`${RAW}/${up.repo}/${sha}/${remote}/${name}`);
      const hash = createHash("sha256").update(body).digest("hex");
      const pinned = up.files[rel];
      if (!pinned) added.push(rel);
      else if (pinned !== hash) changed.push(rel);
    }
  }
  for (const rel of Object.keys(up.files)) if (!seen.has(rel)) removed.push(rel);
  return { pinnedCommit: up.commit, upstreamCommit: sha, changed, added, removed };
}
