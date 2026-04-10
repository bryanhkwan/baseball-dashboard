import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const NCAA_API_BASE = "https://ncaa-api.henrygd.me";
const DEFAULT_SEASON = 2026;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 750;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const today = new Date();
  const options = {
    season: DEFAULT_SEASON,
    startDate: `${DEFAULT_SEASON}-02-01`,
    endDate: formatIsoDate(today),
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    output: path.join(REPO_ROOT, "data", "generated", `ncaa-boxscore-pool-${DEFAULT_SEASON}.json`),
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

    if (token === "--fetch-timeout-ms") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.fetchTimeoutMs = parsed;
      }
      index += 1;
    }
  }

  return options;
}

function formatIsoDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatApiDate(date) {
  return formatIsoDate(date).replace(/-/g, "/");
}

function parseIsoDate(value) {
  const parsed = new Date(`${String(value || "").trim()}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date \"${value}\". Use YYYY-MM-DD.`);
  }
  return parsed;
}

function enumerateDates(startDate, endDate) {
  const dates = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push({
      isoDate: formatIsoDate(cursor),
      apiDate: formatApiDate(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function compactText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeWhitespace(value = "") {
  return compactText(value);
}

function normalizeName(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKeyPart(value = "") {
  return slugify(value);
}

function playerNameRichness(name = "") {
  const compactName = compactText(name);
  const tokens = compactName.split(/\s+/).filter(Boolean);
  return (
    compactName.length +
    tokens.length * 12 -
    (compactName.includes(".") ? 8 : 0) -
    (tokens.length < 2 ? 14 : 0)
  );
}

function choosePreferredPlayerName(existingName = "", incomingName = "") {
  return playerNameRichness(incomingName) >= playerNameRichness(existingName) ? incomingName : existingName;
}

function parseNumericStat(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }
  const parsed = Number.parseFloat(raw.replace("%", ""));
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return raw.endsWith("%") ? parsed / 100 : parsed;
}

function parseInningsPitched(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }

  const [wholeRaw, outsRaw = "0"] = raw.split(".");
  const whole = Number.parseInt(wholeRaw, 10);
  const outs = Number.parseInt(outsRaw, 10);
  if (Number.isNaN(whole)) {
    return 0;
  }

  return whole + (Number.isNaN(outs) ? 0 : clamp(outs, 0, 2)) / 3;
}

function inningsToDisplay(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }
  const whole = Math.floor(value);
  const remainder = value - whole;
  const outs = Math.round(remainder * 3);
  return `${whole}.${outs}`;
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

function forEachWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });

  return Promise.all(runners);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const retries = Number.isFinite(options.retries) ? options.retries : DEFAULT_RETRIES;
  const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : DEFAULT_RETRY_DELAY_MS;
  const fetchTimeoutMs = Number.isFinite(options.fetchTimeoutMs) ? options.fetchTimeoutMs : DEFAULT_FETCH_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 baseball-dashboard/1.0",
          accept: "application/json,text/plain,*/*",
          "accept-encoding": "identity",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`Request failed for ${url}: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      const status = error?.status;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        error?.name === "AbortError" ||
        message.includes("aborted") ||
        message.includes("fetch failed") ||
        status === 428 ||
        status === 429 ||
        (Number.isFinite(status) && status >= 500);

      if (!retryable || attempt === retries) {
        break;
      }

      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError || new Error(`Request failed for ${url}`);
}

function playerName(player = {}) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ").trim() || "Unknown Player";
}

function simplifyStats(stats) {
  if (!stats || typeof stats !== "object") {
    return null;
  }

  const entries = Object.entries(stats).filter(([key, value]) => {
    if (key === "__typename") {
      return false;
    }
    return value !== null && value !== undefined && value !== "";
  });

  return entries.length ? Object.fromEntries(entries) : null;
}

function normalizePlayer(player = {}) {
  return {
    name: playerName(player),
    position: String(player.position || "").toUpperCase(),
    number: player.number ? String(player.number) : "",
    starter: Boolean(player.starter),
    participated: Boolean(player.participated),
    substitute: Boolean(player.substitute),
    batterStats: simplifyStats(player.batterStats),
    pitcherStats: simplifyStats(player.pitcherStats),
    fieldStats: simplifyStats(player.fieldStats),
    hittingSeason: simplifyStats(player.hittingSeason),
  };
}

function normalizeBoxscore(boxscore) {
  const teamMetaById = new Map((boxscore.teams || []).map((team) => [String(team.teamId), team]));
  return {
    contestId: String(boxscore.contestId || ""),
    description: boxscore.description || "",
    teams: (boxscore.teamBoxscore || []).map((teamBox) => {
      const meta = teamMetaById.get(String(teamBox.teamId)) || {};
      return {
        teamId: String(teamBox.teamId || meta.teamId || ""),
        isHome: Boolean(meta.isHome),
        seoname: meta.seoname || "",
        nameFull: meta.nameFull || "",
        nameShort: meta.nameShort || "",
        teamName: meta.teamName || "",
        color: meta.color || "",
        players: (teamBox.playerStats || []).map(normalizePlayer),
      };
    }),
  };
}

function hasPitchingLine(player = {}) {
  const stats = player.pitcherStats || {};
  return ["inningsPitched", "hitsAllowed", "runsAllowed", "walksAllowed", "strikeouts"].some((key) => {
    const value = stats[key];
    return value !== null && value !== undefined && value !== "";
  });
}

function normalizePosition(player = {}, role) {
  const position = compactText(player.position || "").toUpperCase();
  if (role === "Pitcher") {
    return player.starter ? "SP" : "RP";
  }
  return position || "UTIL";
}

function buildPlayerIdentityKeys(team = {}, player = {}, role = "") {
  const schoolSlug = normalizeKeyPart(compactText(team.seoname || "unknown-school")) || "unknown-school";
  const roleKey = role === "Pitcher" ? "pitcher" : "hitter";
  const numberKey = normalizeKeyPart(player.number || "");
  const nameKey = normalizeKeyPart(normalizeName(player.name) || player.name || "unknown-player") || "unknown-player";
  const aliasKeys = [...new Set([numberKey ? `${schoolSlug}::${numberKey}::${roleKey}` : "", `${schoolSlug}::${nameKey}::${roleKey}`].filter(Boolean))];
  return {
    canonicalKey: aliasKeys[0] || `${schoolSlug}::unknown-player::${roleKey}`,
    aliasKeys,
  };
}

function createAggregatePlayer(team, player, role, context, playerId) {
  const schoolSlug = compactText(team.seoname || "unknown-school");
  const school = compactText(team.nameShort || team.teamName || schoolSlug);
  const schoolLongName = compactText(team.nameFull || school);
  const position = normalizePosition(player, role);
  return {
    id: playerId,
    schoolSlug,
    school,
    schoolLongName,
    name: player.name,
    normalizedName: normalizeName(player.name),
    role,
    position,
    positionsSeen: [position],
    number: player.number || "",
    appearances: 0,
    gamesStarted: 0,
    gamesTracked: 0,
    lastSeenDate: context.date,
    latestGameId: context.gameId,
    latestGameDescription: context.description,
    latestSource: "NCAA boxscore pool",
    season: context.season,
    aliasKeys: new Set([playerId]),
    hittingSeason: null,
    hittingGameTotals: {
      atBats: 0,
      runsScored: 0,
      hits: 0,
      runsBattedIn: 0,
      walks: 0,
      strikeouts: 0,
    },
    fieldTotals: {
      putouts: 0,
      assists: 0,
      errors: 0,
    },
    pitchingTotals: {
      inningsPitched: 0,
      hitsAllowed: 0,
      runsAllowed: 0,
      earnedRunsAllowed: 0,
      walksAllowed: 0,
      strikeouts: 0,
      battersFaced: 0,
      wins: 0,
      losses: 0,
      saves: 0,
    },
  };
}

function updateAggregatePlayer(aggregate, player, role, context) {
  aggregate.appearances += 1;
  aggregate.gamesTracked += 1;
  if (player.starter) {
    aggregate.gamesStarted += 1;
  }

  const position = normalizePosition(player, role);
  if (position && !aggregate.positionsSeen.includes(position)) {
    aggregate.positionsSeen.push(position);
  }
  aggregate.position = aggregate.positionsSeen[0] || aggregate.position;

  const preferredName = choosePreferredPlayerName(aggregate.name, player.name);
  aggregate.name = preferredName;
  aggregate.normalizedName = normalizeName(preferredName);

  if (player.number && !aggregate.number) {
    aggregate.number = player.number;
  }

  if (context.date >= aggregate.lastSeenDate) {
    aggregate.lastSeenDate = context.date;
    aggregate.latestGameId = context.gameId;
    aggregate.latestGameDescription = context.description;
  }

  const field = player.fieldStats || {};
  aggregate.fieldTotals.putouts += parseNumericStat(field.putouts);
  aggregate.fieldTotals.assists += parseNumericStat(field.assists);
  aggregate.fieldTotals.errors += parseNumericStat(field.errors);

  if (role === "Pitcher") {
    const pitching = player.pitcherStats || {};
    aggregate.pitchingTotals.inningsPitched += parseInningsPitched(pitching.inningsPitched);
    aggregate.pitchingTotals.hitsAllowed += parseNumericStat(pitching.hitsAllowed);
    aggregate.pitchingTotals.runsAllowed += parseNumericStat(pitching.runsAllowed);
    aggregate.pitchingTotals.earnedRunsAllowed += parseNumericStat(pitching.earnedRunsAllowed);
    aggregate.pitchingTotals.walksAllowed += parseNumericStat(pitching.walksAllowed);
    aggregate.pitchingTotals.strikeouts += parseNumericStat(pitching.strikeouts);
    aggregate.pitchingTotals.battersFaced += parseNumericStat(pitching.battersFaced);
    aggregate.pitchingTotals.wins += parseNumericStat(pitching.win);
    aggregate.pitchingTotals.losses += parseNumericStat(pitching.loss);
    aggregate.pitchingTotals.saves += parseNumericStat(pitching.save);
    return;
  }

  const batter = player.batterStats || {};
  aggregate.hittingGameTotals.atBats += parseNumericStat(batter.atBats);
  aggregate.hittingGameTotals.runsScored += parseNumericStat(batter.runsScored);
  aggregate.hittingGameTotals.hits += parseNumericStat(batter.hits);
  aggregate.hittingGameTotals.runsBattedIn += parseNumericStat(batter.runsBattedIn);
  aggregate.hittingGameTotals.walks += parseNumericStat(batter.walks);
  aggregate.hittingGameTotals.strikeouts += parseNumericStat(batter.strikeouts);

  const hittingSeason = player.hittingSeason || null;
  if (!hittingSeason) {
    return;
  }

  const currentAtBats = parseNumericStat(aggregate.hittingSeason?.atBats);
  const nextAtBats = parseNumericStat(hittingSeason.atBats);
  if (!aggregate.hittingSeason || nextAtBats >= currentAtBats) {
    aggregate.hittingSeason = {
      atBats: parseNumericStat(hittingSeason.atBats),
      runsScored: parseNumericStat(hittingSeason.runsScored),
      hits: parseNumericStat(hittingSeason.hits),
      runsBattedIn: parseNumericStat(hittingSeason.runsBattedIn),
      walks: parseNumericStat(hittingSeason.walks),
      strikeouts: parseNumericStat(hittingSeason.strikeouts),
      battingAverage: parseNumericStat(hittingSeason.battingAverage),
      onBasePercentage: parseNumericStat(hittingSeason.onBasePercentage),
      doubles: parseNumericStat(hittingSeason.doubles),
      triples: parseNumericStat(hittingSeason.triples),
      homeRuns: parseNumericStat(hittingSeason.homeRuns),
    };
  }
}

function registerAggregateAliases(aliasKeyMap, aggregate, canonicalKey, aliasKeys = []) {
  aggregate.aliasKeys ||= new Set();
  aggregate.aliasKeys.add(canonicalKey);
  aliasKeys.forEach((aliasKey) => {
    if (aliasKey) {
      aggregate.aliasKeys.add(aliasKey);
    }
  });

  for (const aliasKey of aggregate.aliasKeys) {
    aliasKeyMap.set(aliasKey, canonicalKey);
  }
}

function promoteAggregateKey(playerMap, aliasKeyMap, currentKey, preferredKey) {
  if (!preferredKey || currentKey === preferredKey || !playerMap.has(currentKey)) {
    return currentKey;
  }

  if (playerMap.has(preferredKey)) {
    return preferredKey;
  }

  const aggregate = playerMap.get(currentKey);
  playerMap.delete(currentKey);
  aggregate.id = preferredKey;
  aggregate.aliasKeys ||= new Set();
  aggregate.aliasKeys.add(currentKey);
  aggregate.aliasKeys.add(preferredKey);
  playerMap.set(preferredKey, aggregate);

  for (const aliasKey of aggregate.aliasKeys) {
    aliasKeyMap.set(aliasKey, preferredKey);
  }

  return preferredKey;
}

function finalizeAggregatePlayer(player) {
  const { aliasKeys, ...serializablePlayer } = player;
  const positionsSeen = [...new Set(player.positionsSeen.filter(Boolean))];
  const position = positionsSeen[0] || player.position || (player.role === "Pitcher" ? "RP" : "UTIL");

  if (player.role === "Pitcher") {
    const inningsPitched = player.pitchingTotals.inningsPitched;
    const earnedRunsAllowed = player.pitchingTotals.earnedRunsAllowed;
    const hitsAllowed = player.pitchingTotals.hitsAllowed;
    const walksAllowed = player.pitchingTotals.walksAllowed;
    const strikeouts = player.pitchingTotals.strikeouts;
    return {
      ...serializablePlayer,
      position,
      positionsSeen,
      pitchingTotals: {
        ...player.pitchingTotals,
        inningsPitched: Number(inningsPitched.toFixed(3)),
        inningsPitchedRaw: inningsToDisplay(inningsPitched),
        earnedRunAverage: inningsPitched > 0 ? Number(((earnedRunsAllowed * 9) / inningsPitched).toFixed(3)) : 0,
        whip: inningsPitched > 0 ? Number((((hitsAllowed + walksAllowed) / inningsPitched).toFixed(3))) : 0,
        strikeoutsPerNine: inningsPitched > 0 ? Number(((strikeouts * 9) / inningsPitched).toFixed(3)) : 0,
        walksPerNine: inningsPitched > 0 ? Number(((walksAllowed * 9) / inningsPitched).toFixed(3)) : 0,
      },
    };
  }

  const season = player.hittingSeason || null;
  const atBats = season?.atBats ?? player.hittingGameTotals.atBats;
  const hits = season?.hits ?? player.hittingGameTotals.hits;
  const walks = season?.walks ?? player.hittingGameTotals.walks;
  const doubles = season?.doubles ?? 0;
  const triples = season?.triples ?? 0;
  const homeRuns = season?.homeRuns ?? 0;
  const totalBases = hits + doubles + (triples * 2) + (homeRuns * 3);
  const sluggingPercentage = atBats > 0 ? Number((totalBases / atBats).toFixed(3)) : 0;
  const battingAverage = Number((season?.battingAverage ?? (atBats > 0 ? hits / atBats : 0)).toFixed(3));
  const onBasePercentage = Number((season?.onBasePercentage ?? (atBats + walks > 0 ? (hits + walks) / (atBats + walks) : 0)).toFixed(3));

  return {
    ...serializablePlayer,
    position,
    positionsSeen,
    hittingSeason: {
      atBats,
      runsScored: season?.runsScored ?? player.hittingGameTotals.runsScored,
      hits,
      runsBattedIn: season?.runsBattedIn ?? player.hittingGameTotals.runsBattedIn,
      walks,
      strikeouts: season?.strikeouts ?? player.hittingGameTotals.strikeouts,
      battingAverage,
      onBasePercentage,
      doubles,
      triples,
      homeRuns,
      totalBases,
      sluggingPercentage,
    },
  };
}

function buildPoolPayload(players, meta) {
  const schools = Object.fromEntries(
    [...new Map(players.map((player) => [player.schoolSlug, { name: player.school, longName: player.schoolLongName }])).entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  );

  const hitters = players
    .filter((player) => player.role === "Hitter")
    .map((player) => {
      const hitting = player.hittingSeason || {};
      return [
        player.id,
        player.schoolSlug,
        player.name,
        player.position,
        player.number || "",
        player.gamesTracked || 0,
        player.gamesStarted || 0,
        player.lastSeenDate || "",
        player.latestGameId || "",
        Number(hitting.atBats || 0),
        Number(hitting.runsScored || 0),
        Number(hitting.hits || 0),
        Number(hitting.runsBattedIn || 0),
        Number(hitting.walks || 0),
        Number(hitting.strikeouts || 0),
        Number(hitting.doubles || 0),
        Number(hitting.triples || 0),
        Number(hitting.homeRuns || 0),
        Number(hitting.battingAverage || 0),
        Number(hitting.onBasePercentage || 0),
        Number(hitting.sluggingPercentage || 0),
      ];
    });

  const pitchers = players
    .filter((player) => player.role === "Pitcher")
    .map((player) => {
      const pitching = player.pitchingTotals || {};
      return [
        player.id,
        player.schoolSlug,
        player.name,
        player.position,
        player.number || "",
        player.gamesTracked || 0,
        player.gamesStarted || 0,
        player.lastSeenDate || "",
        player.latestGameId || "",
        Number(pitching.inningsPitched || 0),
        Number(pitching.hitsAllowed || 0),
        Number(pitching.earnedRunsAllowed || 0),
        Number(pitching.walksAllowed || 0),
        Number(pitching.strikeouts || 0),
        Number(pitching.wins || 0),
        Number(pitching.losses || 0),
        Number(pitching.saves || 0),
      ];
    });

  const roleCounts = {
    Hitter: hitters.length,
    Pitcher: pitchers.length,
  };

  const schoolsCovered = Object.keys(schools).length;

  return {
    generatedAt: new Date().toISOString(),
    season: meta.season,
    source: "NCAA D1 baseball scoreboards and boxscores",
    note:
      "This compact pool aggregates NCAA boxscores across the requested date range so the backend can serve a broader player universe without depending on leaderboard-only coverage.",
    coverage: {
      startDate: meta.startDate,
      endDate: meta.endDate,
      daysRequested: meta.daysRequested,
      scoreboardDaysLoaded: meta.scoreboardDaysLoaded,
      scoreboardFailures: meta.scoreboardFailures,
      uniqueGamesDiscovered: meta.uniqueGamesDiscovered,
      boxscoresLoaded: meta.boxscoresLoaded,
      boxscoreFailures: meta.boxscoreFailures,
      schoolsCovered,
      playersCovered: hitters.length + pitchers.length,
      roleCounts,
    },
    schools,
    hitters,
    pitchers,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const startDate = parseIsoDate(options.startDate);
  const endDate = parseIsoDate(options.endDate);
  if (endDate < startDate) {
    throw new Error("end-date must be on or after start-date.");
  }

  const days = enumerateDates(startDate, endDate);
  const scoreboardFailures = [];
  const gameMap = new Map();

  await forEachWithConcurrency(days, Math.min(options.concurrency, 5), async (day) => {
    try {
      const payload = await fetchJson(`${NCAA_API_BASE}/scoreboard/baseball/d1/${day.apiDate}/all-conf`, options);

      for (const wrapper of payload.games || []) {
        const game = wrapper?.game || wrapper;
        const gameId = compactText(game.gameID || "");
        const gameState = compactText(game.gameState || "").toLowerCase();
        if (!gameId || gameState === "pre") {
          continue;
        }

        if (!gameMap.has(gameId)) {
          gameMap.set(gameId, {
            gameId,
            date: day.isoDate,
            description: compactText(game.title || `${game.away?.names?.short || "Away"} at ${game.home?.names?.short || "Home"}`),
          });
        }
      }
    } catch (error) {
      scoreboardFailures.push({ date: day.isoDate, message: error instanceof Error ? error.message : String(error) });
    }
  });

  const games = [...gameMap.values()].sort((left, right) => `${left.date}:${left.gameId}`.localeCompare(`${right.date}:${right.gameId}`));
  const boxscoreFailures = [];
  const playerMap = new Map();
  const aliasKeyMap = new Map();
  let boxscoresProcessed = 0;
  await forEachWithConcurrency(games, Math.min(options.concurrency, 4), async (game) => {
    try {
      const payload = await fetchJson(`${NCAA_API_BASE}/game/${game.gameId}/boxscore`, options);
      const normalized = normalizeBoxscore(payload);

      for (const team of normalized.teams || []) {
        for (const rawPlayer of team.players || []) {
          if (!rawPlayer.participated && !rawPlayer.starter && !rawPlayer.batterStats && !rawPlayer.pitcherStats) {
            continue;
          }

          const role = hasPitchingLine(rawPlayer) ? "Pitcher" : "Hitter";
          const identity = buildPlayerIdentityKeys(team, rawPlayer, role);
          const knownKey = identity.aliasKeys.map((key) => aliasKeyMap.get(key) || (playerMap.has(key) ? key : "")).find(Boolean);
          let canonicalKey = knownKey || identity.canonicalKey;

          if (identity.canonicalKey !== canonicalKey && !playerMap.has(identity.canonicalKey)) {
            canonicalKey = promoteAggregateKey(playerMap, aliasKeyMap, canonicalKey, identity.canonicalKey);
          }

          const aggregate = playerMap.get(canonicalKey) || createAggregatePlayer(
            team,
            rawPlayer,
            role,
            {
              date: game.date,
              gameId: game.gameId,
              description: game.description,
              season: options.season,
            },
            canonicalKey,
          );
          registerAggregateAliases(aliasKeyMap, aggregate, canonicalKey, identity.aliasKeys);
          updateAggregatePlayer(aggregate, rawPlayer, role, {
            date: game.date,
            gameId: game.gameId,
            description: game.description,
            season: options.season,
          });
          playerMap.set(canonicalKey, aggregate);
        }
      }
    } catch (error) {
      boxscoreFailures.push({ gameId: game.gameId, date: game.date, message: error instanceof Error ? error.message : String(error) });
    } finally {
      boxscoresProcessed += 1;
      if (boxscoresProcessed % 50 === 0 || boxscoresProcessed === games.length) {
        console.log(`Processed ${boxscoresProcessed}/${games.length} boxscores for ${options.startDate} -> ${options.endDate}`);
      }
    }
  });

  const players = [...playerMap.values()]
    .map(finalizeAggregatePlayer)
    .sort((left, right) => {
      const schoolCompare = left.school.localeCompare(right.school);
      if (schoolCompare !== 0) {
        return schoolCompare;
      }
      const roleCompare = left.role.localeCompare(right.role);
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return left.name.localeCompare(right.name);
    });

  const payload = buildPoolPayload(players, {
    season: options.season,
    startDate: options.startDate,
    endDate: options.endDate,
    daysRequested: days.length,
    scoreboardDaysLoaded: days.length - scoreboardFailures.length,
    scoreboardFailures,
    uniqueGamesDiscovered: games.length,
    boxscoresLoaded: games.length - boxscoreFailures.length,
    boxscoreFailures,
  });

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${options.output}`);
  console.log(`Date range: ${options.startDate} -> ${options.endDate}`);
  console.log(`Scoreboards: ${payload.coverage.scoreboardDaysLoaded}/${payload.coverage.daysRequested}`);
  console.log(`Games: ${payload.coverage.boxscoresLoaded}/${payload.coverage.uniqueGamesDiscovered}`);
  console.log(`Schools covered: ${payload.coverage.schoolsCovered}`);
  console.log(`Players covered: ${payload.coverage.playersCovered}`);
  console.log(`Role counts: ${payload.coverage.roleCounts.Hitter} hitters / ${payload.coverage.roleCounts.Pitcher} pitchers`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});