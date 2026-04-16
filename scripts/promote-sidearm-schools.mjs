#!/usr/bin/env node
/**
 * Probe candidate school-athletics domains for Sidearm compatibility and promote
 * discovered teams in the manifest to `status: "ready"` so the daily refresh picks
 * them up automatically.
 *
 * Usage:
 *   node scripts/promote-sidearm-schools.mjs [--manifest <path>] [--candidates <path>]
 *                                            [--season <year>] [--keys <k1,k2>]
 *                                            [--dry-run|--write]
 *                                            [--concurrency <n>] [--timeout <ms>]
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const DEFAULT_MANIFEST = "data/school-manifest.baseball.expanded.json";
const DEFAULT_CANDIDATES = "data/sidearm-candidate-domains.json";
const DEFAULT_SEASON = 2026;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 15_000;
const NUXT_DATA_MARKER = 'id="__NUXT_DATA__">';

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    candidates: DEFAULT_CANDIDATES,
    season: DEFAULT_SEASON,
    keys: [],
    dryRun: true,
    concurrency: DEFAULT_CONCURRENCY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--manifest" && next) {
      options.manifest = next;
      index += 1;
    } else if (token === "--candidates" && next) {
      options.candidates = next;
      index += 1;
    } else if (token === "--season" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        options.season = parsed;
      }
      index += 1;
    } else if (token === "--keys" && next) {
      options.keys = next
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      index += 1;
    } else if (token === "--concurrency" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.concurrency = parsed;
      }
      index += 1;
    } else if (token === "--timeout" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.timeoutMs = parsed;
      }
      index += 1;
    } else if (token === "--write") {
      options.dryRun = false;
    } else if (token === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

async function loadJson(relativePath) {
  const resolved = path.resolve(REPO_ROOT, relativePath);
  const raw = await readFile(resolved, "utf8");
  return { data: JSON.parse(raw), absolutePath: resolved };
}

async function saveJson(absolutePath, data) {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(absolutePath, serialized, "utf8");
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 baseball-dashboard-probe/1.0",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      return { ok: false, status: response.status, body: "" };
    }
    const body = await response.text();
    return { ok: true, status: response.status, body, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

function extractNuxtPayload(html) {
  const start = html.indexOf(NUXT_DATA_MARKER);
  if (start === -1) {
    return null;
  }
  const jsonStart = start + NUXT_DATA_MARKER.length;
  const end = html.indexOf("</script>", jsonStart);
  if (end === -1) {
    return null;
  }
  return html.slice(jsonStart, end);
}

function probeLooksLikeSidearmBaseballRoster(html) {
  if (!html || typeof html !== "string") {
    return { ok: false, reason: "empty-response" };
  }
  if (!extractNuxtPayload(html)) {
    return { ok: false, reason: "no-nuxt-payload" };
  }
  const lowered = html.toLowerCase();
  const hasRosterSignal =
    lowered.includes('"roster"') &&
    (lowered.includes("jerseynumber") || lowered.includes("positionshort"));
  if (!hasRosterSignal) {
    return { ok: false, reason: "no-roster-signals" };
  }
  if (
    !lowered.includes("baseball") ||
    (!lowered.includes("/sports/baseball/") && !lowered.includes("baseball roster"))
  ) {
    return { ok: false, reason: "roster-not-baseball" };
  }
  return { ok: true };
}

function probeLooksLikeSidearmBaseballStats(html) {
  if (!html || typeof html !== "string") {
    return { ok: false, reason: "empty-response" };
  }
  if (!extractNuxtPayload(html)) {
    return { ok: false, reason: "no-nuxt-payload" };
  }
  const lowered = html.toLowerCase();
  if (!lowered.includes("cumulativestats")) {
    return { ok: false, reason: "no-cumulative-stats-payload" };
  }
  if (!lowered.includes("individualhittingstats") && !lowered.includes("individualpitchingstats")) {
    return { ok: false, reason: "no-individual-stats" };
  }
  return { ok: true };
}

async function probeCandidateDomain(domain, season, timeoutMs) {
  const base = String(domain || "").replace(/\/+$/, "");
  if (!base) {
    return { ok: false, reason: "empty-domain" };
  }

  const rosterUrl = `${base}/sports/baseball/roster`;
  const statsUrl = `${base}/sports/baseball/stats/${season}`;

  let rosterResult;
  try {
    rosterResult = await fetchWithTimeout(rosterUrl, timeoutMs);
  } catch (error) {
    return { ok: false, reason: `roster-fetch-error:${error?.name || "unknown"}`, rosterUrl };
  }
  if (!rosterResult.ok) {
    return { ok: false, reason: `roster-http-${rosterResult.status}`, rosterUrl };
  }
  const rosterValidation = probeLooksLikeSidearmBaseballRoster(rosterResult.body);
  if (!rosterValidation.ok) {
    return { ok: false, reason: `roster-${rosterValidation.reason}`, rosterUrl };
  }

  let statsResult;
  try {
    statsResult = await fetchWithTimeout(statsUrl, timeoutMs);
  } catch (error) {
    return {
      ok: false,
      reason: `stats-fetch-error:${error?.name || "unknown"}`,
      rosterUrl,
      statsUrl,
    };
  }
  if (!statsResult.ok) {
    return { ok: false, reason: `stats-http-${statsResult.status}`, rosterUrl, statsUrl };
  }
  const statsValidation = probeLooksLikeSidearmBaseballStats(statsResult.body);
  if (!statsValidation.ok) {
    return { ok: false, reason: `stats-${statsValidation.reason}`, rosterUrl, statsUrl };
  }

  return {
    ok: true,
    schoolSiteBase: base,
    rosterPath: "/sports/baseball/roster",
    statsPath: `/sports/baseball/stats/${season}`,
    rosterUrl,
    statsUrl,
  };
}

async function probeCandidates(domains, season, timeoutMs) {
  const attempts = [];
  for (const domain of domains) {
    const attempt = await probeCandidateDomain(domain, season, timeoutMs);
    attempts.push({ domain, ...attempt });
    if (attempt.ok) {
      return { ok: true, success: attempt, attempts };
    }
  }
  return { ok: false, success: null, attempts };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(concurrency, items.length))).fill(null).map(async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function isManifestTeamReady(team = {}) {
  return (
    team.enabled !== false &&
    Boolean(team.schoolSiteBase) &&
    Boolean(team.rosterPath) &&
    Boolean(team.statsPath)
  );
}

async function main() {
  const options = parseArgs(process.argv);

  const [{ data: manifest, absolutePath: manifestPath }, { data: candidates }] = await Promise.all([
    loadJson(options.manifest),
    loadJson(options.candidates),
  ]);

  const candidateMap = candidates?.candidates || candidates || {};
  const season =
    Number.isFinite(options.season) && options.season > 0
      ? options.season
      : Number.parseInt(manifest?.defaultSeason || DEFAULT_SEASON, 10);

  const keyFilter = new Set(options.keys || []);
  const targetTeams = (manifest.teams || []).filter((team) => {
    const key = String(team.key || "").toLowerCase();
    if (keyFilter.size && !keyFilter.has(key)) {
      return false;
    }
    if (isManifestTeamReady(team)) {
      return false;
    }
    const domains = candidateMap[key];
    return Array.isArray(domains) && domains.length > 0;
  });

  if (!targetTeams.length) {
    console.log("No candidate teams to probe (nothing in the candidates map matches discovered manifest entries).");
    return;
  }

  console.log(
    `Probing ${targetTeams.length} candidate school${targetTeams.length === 1 ? "" : "s"} for Sidearm compatibility (season ${season}, concurrency ${options.concurrency}, timeout ${options.timeoutMs}ms)${
      options.dryRun ? " — DRY RUN, no manifest writes" : " — will WRITE manifest"
    }.`,
  );

  const outcomes = await runWithConcurrency(targetTeams, options.concurrency, async (team) => {
    const key = String(team.key || "").toLowerCase();
    const domains = candidateMap[key] || [];
    const result = await probeCandidates(domains, season, options.timeoutMs);
    return { team, key, domains, result };
  });

  const promotions = [];
  const failures = [];

  for (const { team, key, domains, result } of outcomes) {
    if (result.ok) {
      promotions.push({ team, success: result.success, attempts: result.attempts });
      console.log(`[promote] ${key} -> ${result.success.schoolSiteBase}`);
    } else {
      failures.push({ team, domains, attempts: result.attempts });
      const summary = result.attempts.map((attempt) => `${attempt.domain} (${attempt.reason})`).join(", ");
      console.log(`[skip]    ${key}: ${summary || "no candidates"}`);
    }
  }

  if (!options.dryRun && promotions.length) {
    const teamMap = new Map((manifest.teams || []).map((team) => [String(team.key || "").toLowerCase(), team]));
    for (const { team, success } of promotions) {
      const key = String(team.key || "").toLowerCase();
      const entry = teamMap.get(key);
      if (!entry) {
        continue;
      }
      entry.enabled = true;
      entry.status = "ready";
      entry.adapter = "sidearm";
      entry.schoolSiteBase = success.schoolSiteBase;
      entry.rosterPath = success.rosterPath;
      entry.statsPath = success.statsPath;
      entry.notes = `Auto-promoted by promote-sidearm-schools.mjs on ${new Date().toISOString()}`;
    }
    await saveJson(manifestPath, manifest);
    console.log(`\nWrote ${promotions.length} promoted school${promotions.length === 1 ? "" : "s"} to ${options.manifest}.`);
  }

  console.log("");
  console.log(`Promotions: ${promotions.length}`);
  console.log(`Failures:   ${failures.length}`);
  console.log(`Total probed: ${outcomes.length}`);
  if (options.dryRun) {
    console.log("\nRe-run with --write to persist promotions to the manifest.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
