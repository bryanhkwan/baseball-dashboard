import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_INPUT = path.join(REPO_ROOT, "data", "generated", "ncaa-boxscore-pool-2026.json");

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_INPUT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--input") {
      options.input = path.resolve(process.cwd(), argv[index + 1] || options.input);
      index += 1;
      continue;
    }

    if (token === "--output") {
      options.output = path.resolve(process.cwd(), argv[index + 1] || options.output);
      index += 1;
    }
  }

  return options;
}

function normalizeKeyPart(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueItems(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

function roundTo(value, decimals = 3) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function inningsToDisplay(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }
  const whole = Math.floor(value);
  const outs = Math.round((value - whole) * 3);
  return `${whole}.${outs}`;
}

function boxscoreRawPlayerRichness(player = {}) {
  return (
    String(player.name || "").length +
    Number(player.gamesTracked || 0) * 2 +
    Number(player.hittingGameTotals?.atBats || 0) +
    Number(player.hittingSeason?.atBats || 0) +
    Number(player.pitchingTotals?.inningsPitched || 0) * 9 +
    (player.positionsSeen?.length || 0)
  );
}

function chooseRicherBoxscoreLine(existing = null, incoming = null) {
  return boxscoreRawPlayerRichness(incoming) >= boxscoreRawPlayerRichness(existing) ? incoming : existing;
}

function mergeRawBoxscorePlayers(existing = {}, incoming = {}) {
  const primary = chooseRicherBoxscoreLine(existing, incoming);
  const secondary = primary === existing ? incoming : existing;
  const useIncomingMetadata = String(incoming.lastSeenDate || "") >= String(existing.lastSeenDate || "");

  return {
    ...secondary,
    ...primary,
    name: String(primary.name || "").length >= String(secondary.name || "").length ? primary.name : secondary.name,
    normalizedName: primary.normalizedName || secondary.normalizedName,
    school: primary.school || secondary.school,
    schoolLongName: primary.schoolLongName || secondary.schoolLongName,
    position: primary.position || secondary.position,
    positionsSeen: uniqueItems([...(primary.positionsSeen || []), ...(secondary.positionsSeen || [])]),
    appearances: Math.max(Number(existing.appearances || 0), Number(incoming.appearances || 0)),
    gamesStarted: Math.max(Number(existing.gamesStarted || 0), Number(incoming.gamesStarted || 0)),
    gamesTracked: Math.max(Number(existing.gamesTracked || 0), Number(incoming.gamesTracked || 0)),
    lastSeenDate: useIncomingMetadata ? incoming.lastSeenDate || existing.lastSeenDate : existing.lastSeenDate || incoming.lastSeenDate,
    latestGameId: useIncomingMetadata ? incoming.latestGameId || existing.latestGameId : existing.latestGameId || incoming.latestGameId,
    latestGameDescription: useIncomingMetadata
      ? incoming.latestGameDescription || existing.latestGameDescription
      : existing.latestGameDescription || incoming.latestGameDescription,
    hittingSeason:
      Number(incoming.hittingSeason?.atBats || 0) >= Number(existing.hittingSeason?.atBats || 0)
        ? incoming.hittingSeason || existing.hittingSeason
        : existing.hittingSeason || incoming.hittingSeason,
    hittingGameTotals:
      Number(incoming.hittingGameTotals?.atBats || 0) >= Number(existing.hittingGameTotals?.atBats || 0)
        ? incoming.hittingGameTotals || existing.hittingGameTotals
        : existing.hittingGameTotals || incoming.hittingGameTotals,
    fieldTotals:
      boxscoreRawPlayerRichness(incoming) >= boxscoreRawPlayerRichness(existing)
        ? incoming.fieldTotals || existing.fieldTotals
        : existing.fieldTotals || incoming.fieldTotals,
    pitchingTotals:
      Number(incoming.pitchingTotals?.inningsPitched || 0) >= Number(existing.pitchingTotals?.inningsPitched || 0)
        ? incoming.pitchingTotals || existing.pitchingTotals
        : existing.pitchingTotals || incoming.pitchingTotals,
  };
}

function getRawBoxscorePlayerKey(player = {}) {
  const schoolSlug = player.schoolSlug || normalizeKeyPart(player.school);
  const role = player.role === "Pitcher" ? "Pitcher" : "Hitter";
  const numberKey = normalizeKeyPart(player.number || "");
  const nameKey = normalizeKeyPart(player.normalizedName || player.name || "unknown-player");
  return `${schoolSlug}::${numberKey || nameKey}::${role}`;
}

function compactifyRawPlayers(dataset = {}) {
  const playerMap = new Map();

  for (const player of dataset.players || []) {
    const normalizedPlayer = {
      ...player,
      normalizedName: player.normalizedName || String(player.name || "").toLowerCase(),
      school: player.school || player.schoolSlug || "Unknown School",
      schoolLongName: player.schoolLongName || player.school || player.schoolSlug || "Unknown School",
    };
    const key = getRawBoxscorePlayerKey(normalizedPlayer);
    playerMap.set(key, mergeRawBoxscorePlayers(playerMap.get(key), normalizedPlayer));
  }

  return [...playerMap.values()].sort((left, right) => `${left.schoolSlug}:${left.role}:${left.name}`.localeCompare(`${right.schoolSlug}:${right.role}:${right.name}`));
}

function buildSchoolsMap(players = []) {
  return Object.fromEntries(
    [...new Map(players.map((player) => [player.schoolSlug, { name: player.school, longName: player.schoolLongName }])).entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  );
}

function buildHitterRows(players = []) {
  return players
    .filter((player) => player.role !== "Pitcher")
    .map((player) => {
      const hitting = player.hittingSeason || {};
      const atBats = Number(hitting.atBats || player.hittingGameTotals?.atBats || 0);
      const runsScored = Number(hitting.runsScored || player.hittingGameTotals?.runsScored || 0);
      const hits = Number(hitting.hits || player.hittingGameTotals?.hits || 0);
      const runsBattedIn = Number(hitting.runsBattedIn || player.hittingGameTotals?.runsBattedIn || 0);
      const walks = Number(hitting.walks || player.hittingGameTotals?.walks || 0);
      const strikeouts = Number(hitting.strikeouts || player.hittingGameTotals?.strikeouts || 0);
      const doubles = Number(hitting.doubles || 0);
      const triples = Number(hitting.triples || 0);
      const homeRuns = Number(hitting.homeRuns || 0);
      const totalBases = hits + doubles + triples * 2 + homeRuns * 3;
      const battingAverage = Number(hitting.battingAverage || (atBats > 0 ? hits / atBats : 0));
      const onBasePercentage = Number(hitting.onBasePercentage || (atBats + walks > 0 ? (hits + walks) / (atBats + walks) : 0));
      const sluggingPercentage = Number(hitting.sluggingPercentage || (atBats > 0 ? totalBases / atBats : 0));

      return [
        player.id,
        player.schoolSlug,
        player.name,
        player.position || player.positionsSeen?.[0] || "UTIL",
        player.number || "",
        Number(player.gamesTracked || 0),
        Number(player.gamesStarted || 0),
        player.lastSeenDate || "",
        player.latestGameId || "",
        atBats,
        runsScored,
        hits,
        runsBattedIn,
        walks,
        strikeouts,
        doubles,
        triples,
        homeRuns,
        roundTo(battingAverage),
        roundTo(onBasePercentage),
        roundTo(sluggingPercentage),
      ];
    });
}

function buildPitcherRows(players = []) {
  return players
    .filter((player) => player.role === "Pitcher")
    .map((player) => {
      const pitching = player.pitchingTotals || {};
      const inningsPitched = Number(pitching.inningsPitched || 0);

      return [
        player.id,
        player.schoolSlug,
        player.name,
        player.position || player.positionsSeen?.[0] || (player.gamesStarted ? "SP" : "RP"),
        player.number || "",
        Number(player.gamesTracked || 0),
        Number(player.gamesStarted || 0),
        player.lastSeenDate || "",
        player.latestGameId || "",
        roundTo(inningsPitched),
        Number(pitching.hitsAllowed || 0),
        Number(pitching.earnedRunsAllowed || 0),
        Number(pitching.walksAllowed || 0),
        Number(pitching.strikeouts || 0),
        Number(pitching.wins || 0),
        Number(pitching.losses || 0),
        Number(pitching.saves || 0),
      ];
    });
}

function buildCompactPayload(dataset = {}) {
  const dedupedPlayers = compactifyRawPlayers(dataset);
  const schools = buildSchoolsMap(dedupedPlayers);
  const hitters = buildHitterRows(dedupedPlayers);
  const pitchers = buildPitcherRows(dedupedPlayers);

  return {
    generatedAt: new Date().toISOString(),
    season: dataset.season,
    source: dataset.source,
    note: `${dataset.note || "Legacy raw NCAA boxscore pool compactified to hitters/pitchers rows."} Compactified from the legacy raw players snapshot so the backend can consume a stable compact schema without raw fallback inflation.`,
    coverage: {
      ...(dataset.coverage || {}),
      schoolsCovered: Object.keys(schools).length,
      playersCovered: hitters.length + pitchers.length,
      roleCounts: {
        Hitter: hitters.length,
        Pitcher: pitchers.length,
      },
    },
    schools,
    hitters,
    pitchers,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const raw = await readFile(options.input, "utf8");
  const dataset = JSON.parse(raw);

  if (Array.isArray(dataset.hitters) || Array.isArray(dataset.pitchers)) {
    const output = `${JSON.stringify(dataset, null, 2)}\n`;
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, output, "utf8");
    console.log(`Snapshot already compact: ${options.output}`);
    return;
  }

  if (!Array.isArray(dataset.players)) {
    throw new Error("Input dataset must contain either compact hitters/pitchers arrays or a legacy players array.");
  }

  const compactPayload = buildCompactPayload(dataset);
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(compactPayload, null, 2)}\n`, "utf8");

  console.log(`Wrote compact pool ${options.output}`);
  console.log(`Schools covered: ${compactPayload.coverage.schoolsCovered}`);
  console.log(`Players covered: ${compactPayload.coverage.playersCovered}`);
  console.log(`Role counts: ${compactPayload.coverage.roleCounts.Hitter} hitters / ${compactPayload.coverage.roleCounts.Pitcher} pitchers`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});