import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import schoolManifest from "../data/school-manifest.baseball.expanded.json" with { type: "json" };

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_SEASON = 2026;
const DEFAULT_CONCURRENCY = 3;

let schoolManifestData = schoolManifest;

function setManifestData(nextManifest) {
  schoolManifestData = nextManifest;
}

async function loadManifestFromPath(manifestPath) {
  const resolvedPath = path.resolve(process.cwd(), manifestPath);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const options = {
    team: "all",
    season: null,
    output: "",
    manifest: "",
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--team") {
      options.team = argv[index + 1] || options.team;
      index += 1;
      continue;
    }

    if (token === "--season") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed)) {
        options.season = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--output") {
      options.output = argv[index + 1] || options.output;
      index += 1;
      continue;
    }

    if (token === "--manifest") {
      options.manifest = argv[index + 1] || options.manifest;
      index += 1;
      continue;
    }

    if (token === "--concurrency") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.concurrency = parsed;
      }
      index += 1;
    }
  }

  return options;
}

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value = "") {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTrailingId(value = "") {
  const match = String(value || "").match(/\/(\d+)(?:\/)?$/);
  return match ? match[1] : "";
}

function extractNuxtPayload(html) {
  const marker = 'id="__NUXT_DATA__">';
  const start = html.indexOf(marker);

  if (start === -1) {
    throw new Error("The page does not expose a __NUXT_DATA__ payload.");
  }

  const jsonStart = start + marker.length;
  const end = html.indexOf("</script>", jsonStart);

  if (end === -1) {
    throw new Error("Could not find the closing script tag for __NUXT_DATA__.");
  }

  return html.slice(jsonStart, end);
}

function hydrateNuxtPayload(rawPayload) {
  const raw = JSON.parse(rawPayload);
  const cache = new Map();

  function hydrateByIndex(index) {
    if (cache.has(index)) {
      return cache.get(index);
    }

    const node = raw[index];
    cache.set(index, null);
    const hydrated = hydrateNode(node);
    cache.set(index, hydrated);
    return hydrated;
  }

  function hydrateNode(node) {
    if (typeof node === "number") {
      return hydrateByIndex(node);
    }

    if (!node || typeof node !== "object") {
      return node;
    }

    if (Array.isArray(node)) {
      if (node[0] === "Reactive" || node[0] === "ShallowReactive") {
        return hydrateNode(node[1]);
      }

      if (node[0] === "Set") {
        return node.slice(1).map(hydrateNode);
      }

      return node.map(hydrateNode);
    }

    const hydrated = {};
    for (const [key, value] of Object.entries(node)) {
      hydrated[key] = hydrateNode(value);
    }
    return hydrated;
  }

  return hydrateByIndex(0);
}

function normalizeClassYear(value = "") {
  const raw = normalizeWhitespace(value).replace(/\./g, "").toUpperCase();
  const map = {
    FRESHMAN: "FR",
    SOPHOMORE: "SO",
    JUNIOR: "JR",
    SENIOR: "SR",
    GRADUATE: "GR",
  };
  return map[raw] || raw || "";
}

function normalizeHandedness(value = "") {
  const raw = normalizeWhitespace(value).toUpperCase();
  if (!raw) {
    return "";
  }
  if (raw.includes("/")) {
    return raw;
  }
  return raw.replace(/\s+/g, "");
}

function inferRole(position = "", positionLong = "") {
  const normalized = `${position} ${positionLong}`.toUpperCase().replace(/[^A-Z0-9/ ]+/g, " ");
  const hasPitcher = /(^|\s|\/)(P|RHP|LHP|PITCHER)(\s|\/|$)/.test(normalized);
  const hasHitter = /(CATCHER|(^|\s|\/)(C|1B|2B|3B|SS|INF|OF|LF|CF|RF|DH|UTIL)(\s|\/|$)|INFIELD|OUTFIELD)/.test(
    normalized,
  );

  if (hasPitcher && !hasHitter) {
    return "Pitcher";
  }

  return "Hitter";
}

function parseSidearmRosterPage(html, config) {
  const payload = hydrateNuxtPayload(extractNuxtPayload(html));
  const rosterBuckets = payload?.pinia?.roster?.roster || {};
  const roster = Object.values(rosterBuckets)[0];

  if (!roster?.players?.length) {
    throw new Error(`No roster players were found on ${config.schoolName}'s public roster page.`);
  }

  const players = roster.players.map((player) => {
    const rosterPath = normalizeWhitespace(player.call_to_action);
    const rosterBioId = extractTrailingId(rosterPath);
    const displayName = normalizeWhitespace(`${player.firstName || ""} ${player.lastName || ""}`);

    return {
      rosterBioId,
      id: `${config.schoolSlug}-${rosterBioId || slugify(displayName)}`,
      name: displayName,
      role: inferRole(player.positionShort, player.positionLong),
      classYear: normalizeClassYear(player.academicYearShort || player.academicYearLong),
      position: normalizeWhitespace(player.positionShort),
      positionLong: normalizeWhitespace(player.positionLong),
      handedness: normalizeHandedness(player.custom1),
      jersey: normalizeWhitespace(player.jerseyNumber),
      hometown: normalizeWhitespace(player.hometown),
      highSchool: normalizeWhitespace(player.highSchool),
      previousSchool: normalizeWhitespace(player.previousSchool),
      profileUrl: rosterPath ? new URL(rosterPath, config.schoolSiteBase).toString() : "",
    };
  });

  return {
    rosterUrl: new URL(config.rosterPath, config.schoolSiteBase).toString(),
    players,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 baseball-dashboard/1.0",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.text();
}

function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  return Promise.all(runners).then(() => results);
}

function isRosterReady(team = {}) {
  return team.enabled !== false && Boolean(team.schoolSiteBase) && Boolean(team.rosterPath);
}

function resolveTargetTeams(options) {
  const requestedTeam = String(options.team || "all").toLowerCase();
  const season = options.season || schoolManifestData.defaultSeason || DEFAULT_SEASON;
  const readyTeams = (schoolManifestData.teams || []).filter(isRosterReady);

  if (requestedTeam === "all" || requestedTeam === "roster-pool" || requestedTeam === "sidearm-roster-pool") {
    return {
      season,
      outputPath:
        options.output || path.join(REPO_ROOT, "data", "generated", `sidearm-roster-pool-baseball-${season}.json`),
      teamConfigs: readyTeams.map((team) => ({
        ...team,
        season,
      })),
    };
  }

  const targetTeam = readyTeams.find((team) => String(team.key || "").toLowerCase() === requestedTeam);
  if (!targetTeam) {
    throw new Error(`Unknown or not-ready roster team preset "${options.team}".`);
  }

  return {
    season,
    outputPath:
      options.output || path.join(REPO_ROOT, "data", "generated", `${targetTeam.schoolSlug}-roster-pool-baseball-${season}.json`),
    teamConfigs: [
      {
        ...targetTeam,
        season,
      },
    ],
  };
}

function buildRosterPoolDataset(successes, failures, season) {
  const schools = successes
    .map((entry) => ({
      slug: entry.school.slug,
      name: entry.school.name,
      longName: entry.school.longName,
      rosterPlayers: entry.players.length,
      rosterUrl: entry.rosterUrl,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const players = successes.flatMap((entry) =>
    entry.players.map((player) => [
      player.id,
      entry.school.slug,
      player.name,
      player.role,
      player.position,
      player.classYear,
      player.handedness,
      player.jersey,
      player.hometown,
      player.highSchool,
      player.previousSchool,
      player.profileUrl,
    ]),
  );

  const roleCounts = players.reduce(
    (counts, row) => {
      const role = row[3] === "Pitcher" ? "Pitcher" : "Hitter";
      counts[role] += 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    season,
    source: "Generated Sidearm baseball roster pool",
    note:
      "This compact roster-only pool captures public school-site baseball rosters so non-appearing players can still enter coverage before they log a reachable NCAA boxscore.",
    schoolCount: schools.length,
    schools,
    coverage: {
      schoolsRequested: schools.length + failures.length,
      schoolsLoaded: schools.length,
      schoolsFailed: failures.length,
      totalPlayers: players.length,
      roleCounts,
      failures,
    },
    players,
  };
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.manifest) {
    setManifestData(await loadManifestFromPath(options.manifest));
  }

  const target = resolveTargetTeams(options);
  const results = await mapWithConcurrency(target.teamConfigs, options.concurrency, async (config) => {
    const rosterUrl = new URL(config.rosterPath, config.schoolSiteBase).toString();

    try {
      const rosterHtml = await fetchText(rosterUrl);
      const rosterBundle = parseSidearmRosterPage(rosterHtml, config);
      return {
        school: {
          slug: config.schoolSlug,
          name: config.schoolName,
          longName: config.schoolLongName,
        },
        rosterUrl: rosterBundle.rosterUrl,
        players: rosterBundle.players,
      };
    } catch (error) {
      return {
        school: {
          slug: config.schoolSlug,
          name: config.schoolName,
          longName: config.schoolLongName,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const successes = results.filter((entry) => !entry.error);
  const failures = results
    .filter((entry) => entry.error)
    .map((entry) => ({
      schoolSlug: entry.school.slug,
      schoolName: entry.school.name,
      message: entry.error,
    }));

  const dataset = buildRosterPoolDataset(successes, failures, target.season);
  await mkdir(path.dirname(target.outputPath), { recursive: true });
  await writeFile(target.outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

  console.log(`Wrote ${target.outputPath}`);
  console.log(`Schools loaded: ${dataset.coverage.schoolsLoaded}/${dataset.coverage.schoolsRequested}`);
  console.log(`Roster players: ${dataset.coverage.totalPlayers}`);
  console.log(`Role counts: ${dataset.coverage.roleCounts.Hitter} hitters / ${dataset.coverage.roleCounts.Pitcher} pitchers`);
  if (failures.length) {
    console.log(`Failures: ${failures.map((failure) => `${failure.schoolName} (${failure.message})`).join("; ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});