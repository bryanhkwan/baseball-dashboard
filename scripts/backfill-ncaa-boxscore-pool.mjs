import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const GENERATOR_PATH = path.join(SCRIPT_DIR, "generate-ncaa-boxscore-pool.mjs");
const DEFAULT_SEASON = 2026;
const DEFAULT_CHUNK_DAYS = 7;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 750;

function formatIsoDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const parsed = new Date(`${String(value || "").trim()}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }
  return parsed;
}

function shiftDate(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseArgs(argv) {
  const today = new Date();
  const options = {
    season: DEFAULT_SEASON,
    startDate: `${DEFAULT_SEASON}-02-01`,
    endDate: formatIsoDate(today),
    output: path.join(REPO_ROOT, "data", "generated", `ncaa-boxscore-pool-${DEFAULT_SEASON}.json`),
    chunkDir: "",
    chunkDays: DEFAULT_CHUNK_DAYS,
    skipExisting: true,
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--season") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed)) {
        options.season = parsed;
        if (!argv.includes("--start-date")) {
          options.startDate = `${parsed}-02-01`;
        }
        if (!argv.includes("--output")) {
          options.output = path.join(REPO_ROOT, "data", "generated", `ncaa-boxscore-pool-${parsed}.json`);
        }
      }
      index += 1;
      continue;
    }

    if (token === "--start-date") {
      options.startDate = argv[index + 1] || options.startDate;
      index += 1;
      continue;
    }

    if (token === "--end-date") {
      options.endDate = argv[index + 1] || options.endDate;
      index += 1;
      continue;
    }

    if (token === "--output") {
      options.output = path.resolve(process.cwd(), argv[index + 1] || options.output);
      index += 1;
      continue;
    }

    if (token === "--chunk-dir") {
      options.chunkDir = path.resolve(process.cwd(), argv[index + 1] || options.chunkDir);
      index += 1;
      continue;
    }

    if (token === "--chunk-days") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.chunkDays = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--concurrency") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.concurrency = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--retries") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.retries = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--retry-delay-ms") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.retryDelayMs = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--force") {
      options.skipExisting = false;
    }
  }

  if (!options.chunkDir) {
    options.chunkDir = path.join(REPO_ROOT, "data", "generated", `ncaa-boxscore-pool-${options.season}-chunks`);
  }

  return options;
}

function enumerateChunks(startDate, endDate, chunkDays) {
  const chunks = [];
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    const chunkStart = new Date(cursor);
    const chunkEnd = shiftDate(chunkStart, chunkDays - 1);
    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime());
    }

    chunks.push({
      startDate: formatIsoDate(chunkStart),
      endDate: formatIsoDate(chunkEnd),
    });

    cursor = shiftDate(chunkEnd, 1);
  }

  return chunks;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function roundTo(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mergeSchools(target, source = {}) {
  for (const [schoolSlug, school] of Object.entries(source || {})) {
    if (!target[schoolSlug]) {
      target[schoolSlug] = school;
      continue;
    }

    target[schoolSlug] = {
      name: target[schoolSlug].name || school.name || schoolSlug,
      longName: target[schoolSlug].longName || school.longName || school.name || schoolSlug,
    };
  }
}

function mergeHitters(hitterMap, hitters = []) {
  for (const row of hitters) {
    const [
      id,
      schoolSlug,
      name,
      position,
      number,
      gamesTracked,
      gamesStarted,
      lastSeenDate,
      latestGameId,
      atBats,
      runsScored,
      hits,
      runsBattedIn,
      walks,
      strikeouts,
      doubles,
      triples,
      homeRuns,
    ] = row;

    const record =
      hitterMap.get(id) || {
        id,
        schoolSlug,
        name,
        position,
        number,
        gamesTracked: 0,
        gamesStarted: 0,
        lastSeenDate: "",
        latestGameId: "",
        atBats: 0,
        runsScored: 0,
        hits: 0,
        runsBattedIn: 0,
        walks: 0,
        strikeouts: 0,
        doubles: 0,
        triples: 0,
        homeRuns: 0,
      };

    record.position = record.position || position;
    record.number = record.number || number;
    record.gamesTracked += Number(gamesTracked || 0);
    record.gamesStarted += Number(gamesStarted || 0);
    record.atBats += Number(atBats || 0);
    record.runsScored += Number(runsScored || 0);
    record.hits += Number(hits || 0);
    record.runsBattedIn += Number(runsBattedIn || 0);
    record.walks += Number(walks || 0);
    record.strikeouts += Number(strikeouts || 0);
    record.doubles += Number(doubles || 0);
    record.triples += Number(triples || 0);
    record.homeRuns += Number(homeRuns || 0);
    if (String(lastSeenDate || "") >= String(record.lastSeenDate || "")) {
      record.lastSeenDate = lastSeenDate || record.lastSeenDate;
      record.latestGameId = latestGameId || record.latestGameId;
    }

    hitterMap.set(id, record);
  }
}

function mergePitchers(pitcherMap, pitchers = []) {
  for (const row of pitchers) {
    const [
      id,
      schoolSlug,
      name,
      position,
      number,
      gamesTracked,
      gamesStarted,
      lastSeenDate,
      latestGameId,
      inningsPitched,
      hitsAllowed,
      earnedRunsAllowed,
      walksAllowed,
      strikeouts,
      wins,
      losses,
      saves,
    ] = row;

    const record =
      pitcherMap.get(id) || {
        id,
        schoolSlug,
        name,
        position,
        number,
        gamesTracked: 0,
        gamesStarted: 0,
        lastSeenDate: "",
        latestGameId: "",
        inningsPitched: 0,
        hitsAllowed: 0,
        earnedRunsAllowed: 0,
        walksAllowed: 0,
        strikeouts: 0,
        wins: 0,
        losses: 0,
        saves: 0,
      };

    record.position = record.position || position;
    record.number = record.number || number;
    record.gamesTracked += Number(gamesTracked || 0);
    record.gamesStarted += Number(gamesStarted || 0);
    record.inningsPitched += Number(inningsPitched || 0);
    record.hitsAllowed += Number(hitsAllowed || 0);
    record.earnedRunsAllowed += Number(earnedRunsAllowed || 0);
    record.walksAllowed += Number(walksAllowed || 0);
    record.strikeouts += Number(strikeouts || 0);
    record.wins += Number(wins || 0);
    record.losses += Number(losses || 0);
    record.saves += Number(saves || 0);
    if (String(lastSeenDate || "") >= String(record.lastSeenDate || "")) {
      record.lastSeenDate = lastSeenDate || record.lastSeenDate;
      record.latestGameId = latestGameId || record.latestGameId;
    }

    pitcherMap.set(id, record);
  }
}

function finalizeHitters(hitterMap) {
  return [...hitterMap.values()]
    .sort((left, right) => `${left.schoolSlug}:${left.name}`.localeCompare(`${right.schoolSlug}:${right.name}`))
    .map((record) => {
      const totalBases = record.hits + record.doubles + record.triples * 2 + record.homeRuns * 3;
      return [
        record.id,
        record.schoolSlug,
        record.name,
        record.position,
        record.number,
        record.gamesTracked,
        record.gamesStarted,
        record.lastSeenDate,
        record.latestGameId,
        record.atBats,
        record.runsScored,
        record.hits,
        record.runsBattedIn,
        record.walks,
        record.strikeouts,
        record.doubles,
        record.triples,
        record.homeRuns,
        record.atBats > 0 ? roundTo(record.hits / record.atBats) : 0,
        record.atBats + record.walks > 0 ? roundTo((record.hits + record.walks) / (record.atBats + record.walks)) : 0,
        record.atBats > 0 ? roundTo(totalBases / record.atBats) : 0,
      ];
    });
}

function finalizePitchers(pitcherMap) {
  return [...pitcherMap.values()]
    .sort((left, right) => `${left.schoolSlug}:${left.name}`.localeCompare(`${right.schoolSlug}:${right.name}`))
    .map((record) => [
      record.id,
      record.schoolSlug,
      record.name,
      record.position,
      record.number,
      record.gamesTracked,
      record.gamesStarted,
      record.lastSeenDate,
      record.latestGameId,
      roundTo(record.inningsPitched),
      record.hitsAllowed,
      record.earnedRunsAllowed,
      record.walksAllowed,
      record.strikeouts,
      record.wins,
      record.losses,
      record.saves,
    ]);
}

function mergeCoverage(payloads, schools, hitters, pitchers, chunkSummaries) {
  const merged = {
    startDate: payloads[0]?.coverage?.startDate || "",
    endDate: payloads[payloads.length - 1]?.coverage?.endDate || "",
    daysRequested: payloads.reduce((total, payload) => total + Number(payload.coverage?.daysRequested || 0), 0),
    scoreboardDaysLoaded: payloads.reduce((total, payload) => total + Number(payload.coverage?.scoreboardDaysLoaded || 0), 0),
    scoreboardFailures: payloads.flatMap((payload) => payload.coverage?.scoreboardFailures || []),
    uniqueGamesDiscovered: payloads.reduce((total, payload) => total + Number(payload.coverage?.uniqueGamesDiscovered || 0), 0),
    boxscoresLoaded: payloads.reduce((total, payload) => total + Number(payload.coverage?.boxscoresLoaded || 0), 0),
    boxscoreFailures: payloads.flatMap((payload) => payload.coverage?.boxscoreFailures || []),
    schoolsCovered: Object.keys(schools).length,
    playersCovered: hitters.length + pitchers.length,
    roleCounts: {
      Hitter: hitters.length,
      Pitcher: pitchers.length,
    },
    chunkCount: chunkSummaries.length,
    chunks: chunkSummaries,
  };

  return merged;
}

function buildMergedPayload(payloads, chunkSummaries, options) {
  const schoolMap = {};
  const hitterMap = new Map();
  const pitcherMap = new Map();

  for (const payload of payloads) {
    mergeSchools(schoolMap, payload.schools || {});
    mergeHitters(hitterMap, payload.hitters || []);
    mergePitchers(pitcherMap, payload.pitchers || []);
  }

  const hitters = finalizeHitters(hitterMap);
  const pitchers = finalizePitchers(pitcherMap);

  return {
    generatedAt: new Date().toISOString(),
    season: options.season,
    source: "NCAA D1 baseball scoreboards and boxscores",
    note:
      "This compact pool was built from chunked NCAA boxscore backfill windows so failed dates can be retried incrementally instead of restarting the full season walk.",
    coverage: mergeCoverage(payloads, schoolMap, hitters, pitchers, chunkSummaries),
    schools: schoolMap,
    hitters,
    pitchers,
  };
}

async function runChunk(chunk, chunkPath, options) {
  const args = [
    GENERATOR_PATH,
    "--season",
    String(options.season),
    "--start-date",
    chunk.startDate,
    "--end-date",
    chunk.endDate,
    "--output",
    chunkPath,
    "--concurrency",
    String(options.concurrency),
    "--retries",
    String(options.retries),
    "--retry-delay-ms",
    String(options.retryDelayMs),
  ];

  const result = await execFileAsync(process.execPath, args, {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.stdout?.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const startDate = parseIsoDate(options.startDate);
  const endDate = parseIsoDate(options.endDate);
  if (endDate < startDate) {
    throw new Error("end-date must be on or after start-date.");
  }

  const chunks = enumerateChunks(startDate, endDate, options.chunkDays);
  await mkdir(options.chunkDir, { recursive: true });
  await mkdir(path.dirname(options.output), { recursive: true });

  const payloads = [];
  const chunkSummaries = [];

  for (const chunk of chunks) {
    const chunkFileName = `${chunk.startDate}_to_${chunk.endDate}.json`;
    const chunkPath = path.join(options.chunkDir, chunkFileName);

    if (!options.skipExisting || !(await fileExists(chunkPath))) {
      console.log(`Generating chunk ${chunk.startDate} -> ${chunk.endDate}`);
      await runChunk(chunk, chunkPath, options);
    } else {
      console.log(`Reusing existing chunk ${chunk.startDate} -> ${chunk.endDate}`);
    }

    const payload = await readJson(chunkPath);
    payloads.push(payload);
    chunkSummaries.push({
      startDate: payload.coverage?.startDate || chunk.startDate,
      endDate: payload.coverage?.endDate || chunk.endDate,
      schoolsCovered: payload.coverage?.schoolsCovered || 0,
      playersCovered: payload.coverage?.playersCovered || 0,
      boxscoresLoaded: payload.coverage?.boxscoresLoaded || 0,
      scoreboardDaysLoaded: payload.coverage?.scoreboardDaysLoaded || 0,
      file: chunkFileName,
    });
  }

  const mergedPayload = buildMergedPayload(payloads, chunkSummaries, options);
  await writeFile(options.output, `${JSON.stringify(mergedPayload, null, 2)}\n`, "utf8");

  console.log(`Wrote merged pool ${options.output}`);
  console.log(`Chunks: ${mergedPayload.coverage.chunkCount}`);
  console.log(`Schools covered: ${mergedPayload.coverage.schoolsCovered}`);
  console.log(`Players covered: ${mergedPayload.coverage.playersCovered}`);
  console.log(`Role counts: ${mergedPayload.coverage.roleCounts.Hitter} hitters / ${mergedPayload.coverage.roleCounts.Pitcher} pitchers`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});