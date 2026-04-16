import { buildPlayerUniverse, getUniversePlayerById, queryPlayerUniverse } from "./player-universe.js";
import macStandingsSnapshot from "./generated/mac-baseball-standings.js";

const NCAA_API_BASE = "https://ncaa-api.henrygd.me";
const ESPN_SITE_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball";
const ESPN_CORE_API_BASE = "https://sports.core.api.espn.com/v2/sports/baseball/leagues/college-baseball";
const ESPN_DIVISION_I_GROUP_ID = 26;
const MAC_STANDINGS_URL = "https://getsomemaction.com/standings.aspx?path=baseball";
const MAC_STANDINGS_MIRROR_URL = "https://r.jina.ai/http://getsomemaction.com/standings.aspx?path=baseball";
const MAC_STANDINGS_SNAPSHOT_URL =
  "https://raw.githubusercontent.com/bryanhkwan/baseball-dashboard/main/backend/toledo-baseball-api/src/generated/mac-baseball-standings.json";
const ET_TIMEZONE = "America/New_York";
const DEFAULT_SCHOOL_SLUG = "toledo";
const DEFAULT_SCHOOL_NAME = "Toledo";
const RECENT_LOOKBACK_DAYS = 2;
const UPCOMING_LOOKAHEAD_DAYS = 5;
const BOX_SCORE_LOOKBACK_DAYS = 14;
const RECENT_FORM_LOOKBACK_DAYS = 10;
const RECENT_FORM_DEFAULT_GAMES = 3;
const OPPONENT_SCOUT_LOOKBACK_DAYS = 6;
const OPPONENT_SCOUT_DEFAULT_GAMES = 3;
const LIVE_SCOREBOARD_LIMIT = 12;
const SCHOOL_SEARCH_LIMIT = 16;
const NATIONAL_PLAYER_CACHE_TTL_MS = 1000 * 60 * 15;
const NATIONAL_PLAYER_MAX_PAGES_PER_SPEC = 2;
const PLAYER_UNIVERSE_CACHE_TTL_MS = 1000 * 60 * 15;
const PLAYER_SNAPSHOT_CACHE_TTL_MS = 1000 * 60 * 15;
const MEMORY_CACHE_TTL_MS = 1000 * 60 * 10;
const SCHOOLS_INDEX_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MAC_STANDINGS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PLAYER_SNAPSHOT_BASE_URL =
  "https://raw.githubusercontent.com/bryanhkwan/baseball-dashboard/main/data/generated";
const PLAYER_SNAPSHOT_FILES = {
  toledoDataset: "toledo-baseball-2026.json",
  sidearmPoolDataset: "sidearm-pool-baseball-2026.json",
  sidearmRosterPoolDataset: "sidearm-roster-pool-baseball-2026.json",
  ncaaBoxscorePoolDataset: "ncaa-boxscore-pool-2026.json",
};
const MAC_BASEBALL_MEMBER_SCHOOLS = [
  { name: "Akron", long: "Akron" },
  { name: "Ball State", long: "Ball State" },
  { name: "Bowling Green", long: "Bowling Green" },
  { name: "Central Michigan", long: "Central Michigan" },
  { name: "Eastern Michigan", long: "Eastern Michigan" },
  { name: "Kent State", long: "Kent State" },
  { name: "Massachusetts", long: "Massachusetts" },
  { name: "Miami", long: "Miami (OH)" },
  { name: "Northern Illinois", long: "Northern Illinois" },
  { name: "Ohio", long: "Ohio" },
  { name: "Toledo", long: "Toledo" },
  { name: "Western Michigan", long: "Western Michigan" },
];

const NATIONAL_PLAYER_STAT_SPECS = [
  { id: 200, role: "Hitter", key: "battingAverage", label: "Batting Average", field: "BA" },
  { id: 504, role: "Hitter", key: "onBasePercentage", label: "On Base Percentage", field: "PCT" },
  { id: 470, role: "Hitter", key: "homeRuns", label: "Home Runs", field: "HR" },
  { id: 487, role: "Hitter", key: "runsBattedIn", label: "Runs Batted In", field: "RBI" },
  { id: 483, role: "Hitter", key: "hits", label: "Hits", field: "H" },
  { id: 495, role: "Hitter", key: "walks", label: "Base on Balls", field: "BB" },
  { id: 492, role: "Hitter", key: "stolenBases", label: "Stolen Bases", field: "SB" },
  { id: 494, role: "Hitter", key: "totalBases", label: "Total Bases", field: "TB" },
  { id: 205, role: "Pitcher", key: "earnedRunAverage", label: "Earned Run Average", field: "ERA" },
  { id: 207, role: "Pitcher", key: "strikeoutsPerNine", label: "Strikeouts Per Nine Innings", field: "K/9" },
  { id: 208, role: "Pitcher", key: "wins", label: "Victories", field: "W" },
  { id: 209, role: "Pitcher", key: "saves", label: "Saves", field: "SV" },
  { id: 505, role: "Pitcher", key: "hitsAllowedPerNine", label: "Hits Allowed Per Nine Innings", field: "PG" },
  { id: 508, role: "Pitcher", key: "walksAllowedPerNine", label: "Walks Allowed Per Nine Innings", field: "PG" },
];

let nationalPlayerBoardCache = {
  generatedAt: "",
  expiresAt: 0,
  payload: null,
};

let playerUniverseCache = {
  generatedAt: "",
  expiresAt: 0,
  payload: null,
};

let playerSnapshotDatasetsCache = {
  expiresAt: 0,
  payload: null,
};

let schoolsIndexCache = {
  expiresAt: 0,
  payload: null,
};

let espnTeamsDirectoryCache = {
  expiresAt: 0,
  payload: null,
};

let espnConferenceGroupsCache = {
  expiresAt: 0,
  payload: null,
};

let macStandingsCache = {
  expiresAt: 0,
  payload: null,
};

const scoreboardDateCache = new Map();
const gameSummaryCache = new Map();
const normalizedBoxscoreCache = new Map();
const normalizedPlayByPlayCache = new Map();
const gameLiveSummaryCache = new Map();
const schoolGamesWindowCache = new Map();
const recentFormCache = new Map();
const opponentScoutCache = new Map();
const espnTeamScheduleCache = new Map();
const espnConferenceStandingsCache = new Map();
const schoolConferenceStandingsCache = new Map();

const demoPlayers = [
  {
    id: "p1",
    name: "Demo Toledo CF",
    role: "Hitter",
    position: "CF",
    classYear: "JR",
    handedness: "L/L",
    avg: 0.324,
    obp: 0.421,
    slg: 0.552,
    bb: 31,
    so: 28,
    sb: 18,
  },
  {
    id: "p5",
    name: "Demo Toledo SP1",
    role: "Pitcher",
    position: "SP",
    classYear: "JR",
    handedness: "R/R",
    era: 3.14,
    whip: 1.08,
    k9: 10.2,
    bb9: 2.6,
    hr9: 0.64,
    ip: 74.1,
  },
];

const positions = [
  { group: "Pitchers", items: ["SP", "RP", "Closer"] },
  { group: "Battery", items: ["Catcher"] },
  { group: "Infield", items: ["1B", "2B", "3B", "SS"] },
  { group: "Outfield", items: ["LF", "CF", "RF"] },
  { group: "Lineup-only role", items: ["DH"] },
];

function readTimedCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeTimedCache(cache, key, payload, ttlMs = MEMORY_CACHE_TTL_MS) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    payload,
  });
  return payload;
}

function readObjectCache(cache) {
  if (!cache.payload || cache.expiresAt <= Date.now()) {
    return null;
  }
  return cache.payload;
}

function writeObjectCache(cache, payload, ttlMs = MEMORY_CACHE_TTL_MS) {
  cache.payload = payload;
  cache.expiresAt = Date.now() + ttlMs;
  return payload;
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization");
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers,
  });
}

function notFound(message = "Not found") {
  return json({ error: message }, { status: 404 });
}

async function fetchJson(url, init) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === "AbortError") {
      throw new Error(
        "NCAA data feed timed out — the upstream service did not respond. Try again in a few minutes.",
      );
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (!response.ok) {
    const status = response.status;
    if (status >= 520 && status <= 530) {
      throw new Error(
        `NCAA data feed is temporarily unavailable (CDN error ${status}). Try again in a few minutes.`,
      );
    }
    throw new Error(`Upstream request failed: ${status}`);
  }
  return response.json();
}

async function fetchText(url, init) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  let response;
  const requestInit = { ...init, signal: controller.signal };
  if (String(url || "") === MAC_STANDINGS_URL) {
    requestInit.headers = {
      ...(init?.headers || {}),
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    };
    requestInit.redirect = "follow";
    requestInit.cf = {
      cacheTtl: Math.floor(MAC_STANDINGS_CACHE_TTL_MS / 1000),
      cacheEverything: true,
    };
  }
  try {
    response = await fetch(url, requestInit);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err && err.name === "AbortError") {
      throw new Error("Standings source timed out before responding.");
    }
    throw err;
  }
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(`Standings source request failed: ${response.status}`);
  }
  return response.text();
}

function baseUrl(env) {
  return env?.NCAA_API_BASE || NCAA_API_BASE;
}

function isLikelyLocalHostname(hostname = "") {
  return (
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "localhost" ||
    hostname.endsWith(".local")
  );
}

function getPlayerSnapshotBaseUrl(env) {
  return String(env?.PLAYER_SNAPSHOT_BASE_URL || PLAYER_SNAPSHOT_BASE_URL || "").replace(/\/$/, "");
}

function shouldUseRemotePlayerSnapshots(env, requestUrl = "") {
  if (!env?.PLAYER_SNAPSHOT_BASE_URL) {
    return false;
  }

  try {
    const url = new URL(requestUrl);
    if (url.protocol === "http:" && isLikelyLocalHostname(url.hostname)) {
      return false;
    }
  } catch (_) {}

  return true;
}

async function fetchPlayerSnapshotDatasets(env) {
  const snapshotBaseUrl = getPlayerSnapshotBaseUrl(env);
  const entries = await Promise.all(
    Object.entries(PLAYER_SNAPSHOT_FILES).map(async ([key, fileName]) => [
      key,
      await fetchJson(`${snapshotBaseUrl}/${fileName}`, {
        cf: {
          cacheTtl: Math.floor(PLAYER_SNAPSHOT_CACHE_TTL_MS / 1000),
          cacheEverything: true,
        },
      }),
    ]),
  );

  return {
    ...Object.fromEntries(entries),
    snapshotSource: `GitHub raw snapshots (${snapshotBaseUrl})`,
    snapshotWarning: "",
  };
}

async function getPlayerSnapshotDatasets(env, options = {}) {
  if (!shouldUseRemotePlayerSnapshots(env, options.requestUrl)) {
    return {
      snapshotSource: "Embedded repository snapshots",
      snapshotWarning: "",
    };
  }

  const cached = readObjectCache(playerSnapshotDatasetsCache);
  if (cached) {
    return cached;
  }

  try {
    const payload = await fetchPlayerSnapshotDatasets(env);
    return writeObjectCache(playerSnapshotDatasetsCache, payload, PLAYER_SNAPSHOT_CACHE_TTL_MS);
  } catch (error) {
    const payload = {
      snapshotSource: "Embedded repository snapshots",
      snapshotWarning: `Remote player snapshot refresh unavailable right now: ${
        error instanceof Error ? error.message : String(error)
      } Using embedded repository files instead.`,
    };
    return writeObjectCache(playerSnapshotDatasetsCache, payload, PLAYER_SNAPSHOT_CACHE_TTL_MS);
  }
}

function macStandingsSnapshotUrl(env) {
  return env?.MAC_STANDINGS_SNAPSHOT_URL || MAC_STANDINGS_SNAPSHOT_URL;
}

function espnSiteUrl(path) {
  return `${ESPN_SITE_API_BASE}${path}`;
}

function espnCoreUrl(path) {
  return `${ESPN_CORE_API_BASE}${path}`;
}

function currentSeasonYear() {
  return new Date().getUTCFullYear();
}

function readInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function shiftDate(date, offsetDays) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return shifted;
}

function formatEtDate(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "/");
}

function normalizeSlug(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeNameKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(the|university|college|campus|at)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSchool(school, fallback = {}) {
  const fallbackSlug = fallback.slug || "";
  const fallbackName = fallback.name || "";
  const fallbackLong = fallback.long || fallbackName;

  return {
    slug: school?.slug || fallbackSlug,
    name: school?.name || school?.long || fallbackName,
    long: school?.long || school?.name || fallbackLong,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scale(value, min, max) {
  if (!Number.isFinite(value) || max === min) {
    return 0;
  }
  return ((clamp(value, min, max) - min) / (max - min)) * 100;
}

function inverseScale(value, bad, good) {
  return scale(bad - value, bad - good, bad - good);
}

function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

function weightedAverage(entries = []) {
  let totalWeight = 0;
  let totalValue = 0;

  for (const entry of entries) {
    if (!entry || !Number.isFinite(entry.value) || !Number.isFinite(entry.weight) || entry.weight <= 0) {
      continue;
    }
    totalWeight += entry.weight;
    totalValue += entry.value * entry.weight;
  }

  if (!totalWeight) {
    return null;
  }

  return totalValue / totalWeight;
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

function roundTo(value, decimals = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function compactText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function fitLabel(score) {
  if (score >= 50) {
    return { label: "Impact", className: "fit-priority" };
  }
  if (score >= 35) {
    return { label: "Strong", className: "fit-pursue" };
  }
  if (score >= 20) {
    return { label: "Useful", className: "fit-monitor" };
  }
  return { label: "Quiet", className: "fit-depth" };
}

function slugifyKey(value = "") {
  return normalizeSlug(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nationalPlayerKey(row = {}, role = "") {
  return [
    slugifyKey(row.Name || "player"),
    slugifyKey(row.Team || "team"),
    slugifyKey(row.Cl || "na"),
    slugifyKey(row.Position || role || "na"),
    slugifyKey(role || "player"),
  ].join("::");
}

function mapScoreboardSide(side = {}) {
  const names = side.names || {};
  const conference = Array.isArray(side.conferences) ? side.conferences[0] || {} : {};
  return {
    short: names.short || "",
    seo: names.seo || "",
    full: names.full || "",
    score: side.score ?? "",
    winner: Boolean(side.winner),
    conferenceSeo: conference.conferenceSeo || "",
    conferenceName: conference.conferenceName || "",
  };
}

function matchesSchoolSide(side = {}, schoolSlug = "") {
  return normalizeSlug(side.seo) === normalizeSlug(schoolSlug);
}

function mapScoreboardGame(entry, date, offsetDays) {
  const game = entry?.game || entry || {};
  const home = mapScoreboardSide(game.home);
  const away = mapScoreboardSide(game.away);
  const gameState = String(game.gameState || "").toLowerCase();

  return {
    gameId: String(game.gameID || ""),
    title: game.title || "",
    url: game.url || "",
    date,
    startDate: game.startDate || "",
    startTime: game.startTime || "",
    startTimeEpoch: Number(game.startTimeEpoch || 0),
    gameState,
    currentPeriod: game.currentPeriod || "",
    finalMessage: game.finalMessage || "",
    home,
    away,
    isHomeWinner: home.winner,
    isAwayWinner: away.winner,
    network: game.network || "",
    liveVideoEnabled: Boolean(game.liveVideoEnabled),
    windowBucket:
      offsetDays < 0 ? "recent" : offsetDays > 0 ? "upcoming" : gameState === "final" ? "recent" : "upcoming",
  };
}

function sortGames(left, right) {
  if (left.startTimeEpoch && right.startTimeEpoch && left.startTimeEpoch !== right.startTimeEpoch) {
    return left.startTimeEpoch - right.startTimeEpoch;
  }
  return `${left.date}-${left.gameId}`.localeCompare(`${right.date}-${right.gameId}`);
}

function schoolViewFromGame(game, schoolSlug) {
  const isHome = matchesSchoolSide(game.home, schoolSlug);
  const team = isHome ? game.home : game.away;
  const opponent = isHome ? game.away : game.home;

  return {
    ...game,
    schoolSlug,
    isSchoolHome: isHome,
    team,
    opponent,
  };
}

function simplifyStats(stats) {
  if (!stats || typeof stats !== "object") {
    return null;
  }

  const entries = Object.entries(stats).filter(([, value]) => {
    if (value === null || value === undefined || value === "") {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function playerName(player = {}) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ").trim() || "Unknown Player";
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
  const teams = (boxscore.teamBoxscore || []).map((teamBox) => {
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
      teamStats: simplifyStats(teamBox.teamStats) || {},
    };
  });

  return {
    contestId: String(boxscore.contestId || ""),
    description: boxscore.description || "",
    status: boxscore.status || "",
    period: boxscore.period || "",
    divisionName: boxscore.divisionName || "",
    sportCode: boxscore.sportCode || "",
    teams,
  };
}

function mapContestTeam(team = {}) {
  return {
    teamId: String(team.teamId || ""),
    isHome: Boolean(team.isHome),
    color: team.color || "",
    seoname: team.seoname || "",
    nameFull: team.nameFull || "",
    nameShort: team.nameShort || "",
    teamName: team.teamName || "",
    score: team.score ?? null,
    record: team.record || "",
    divisionName: team.divisionName || "",
    division: team.division ?? null,
    isWinner: Boolean(team.isWinner),
  };
}

function normalizeGameSummaryPayload(payload) {
  const contest = payload?.contests?.[0];
  if (!contest) {
    return null;
  }

  return {
    gameId: String(contest.id || ""),
    sportCode: contest.sportCode || "",
    sportUrl: contest.sportUrl || "",
    division: contest.division ?? null,
    seasonYear: contest.seasonYear ?? null,
    currentPeriod: contest.currentPeriod || "",
    finalMessage: contest.finalMessage || "",
    gameState: contest.gameState || "",
    statusCodeDisplay: contest.statusCodeDisplay || "",
    startTime: contest.startTime || "",
    startTimeEpoch: contest.startTimeEpoch ?? null,
    hasBoxscore: Boolean(contest.hasBoxscore),
    hasPbp: Boolean(contest.hasPbp),
    hasTeamStats: Boolean(contest.hasTeamStats),
    hasScoringSummary: Boolean(contest.hasScoringSummary),
    teams: (contest.teams || []).map(mapContestTeam),
    linescores: contest.linescores || [],
    location: contest.location || null,
  };
}

function normalizePbpScore(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function cleanPlayText(value = "") {
  return compactText(String(value || "").replace(/\d+a\s+/gi, "; "));
}

function normalizePbpTeam(team = {}) {
  return {
    teamId: String(team.teamId || ""),
    isHome: Boolean(team.isHome),
    seoname: team.seoname || "",
    nameFull: team.nameFull || "",
    nameShort: team.nameShort || "",
    teamName: team.teamName || "",
    color: team.color || "",
  };
}

function extractLeadPlayerName(playText = "") {
  const match = cleanPlayText(playText).match(
    /^(.+?)\s+(?=singled|doubled|tripled|homered|walked|struck out|flied out|grounded out|popped up|lined out|fouled out|reached|stole|advanced|hit by pitch|intentionally walked|to\s+[a-z0-9]+\s+for|picked off|caught stealing|balked)/i,
  );
  return compactText(match?.[1] || "");
}

function extractScoredPlayers(playText = "") {
  return [...new Set(
    [...cleanPlayText(playText).matchAll(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+)\s+scored\b/g)].map((match) =>
      compactText(match[1]),
    ),
  )];
}

function derivePlayTags(playText = "") {
  const text = cleanPlayText(playText);
  const tags = [];

  if (/\sto\s+[a-z0-9]+\s+for\s+/i.test(text)) {
    tags.push("substitution");
  }
  if (/homered|home run/i.test(text)) {
    tags.push("homeRun", "hit", "extraBaseHit");
  } else if (/tripled\b/i.test(text)) {
    tags.push("triple", "hit", "extraBaseHit");
  } else if (/doubled\b/i.test(text)) {
    tags.push("double", "hit", "extraBaseHit");
  } else if (/singled\b/i.test(text)) {
    tags.push("single", "hit");
  }
  if (/walked\b|intentional walk|intentionally walked/i.test(text)) {
    tags.push("walk", "freeBase");
  }
  if (/hit by pitch/i.test(text)) {
    tags.push("hitByPitch", "freeBase");
  }
  if (/struck out/i.test(text)) {
    tags.push("strikeout");
  }
  if (/stole (?:second|third|home)/i.test(text)) {
    tags.push("stolenBase");
  }
  if (/caught stealing/i.test(text)) {
    tags.push("caughtStealing");
  }
  if (/wild pitch/i.test(text)) {
    tags.push("wildPitch");
  }
  if (/passed ball/i.test(text)) {
    tags.push("passedBall");
  }
  if (/\bbalk\b/i.test(text)) {
    tags.push("balk");
  }
  if (/double play/i.test(text)) {
    tags.push("doublePlay");
  }
  if (/triple play/i.test(text)) {
    tags.push("triplePlay");
  }
  if (/fielder'?s choice/i.test(text)) {
    tags.push("fieldersChoice");
  }
  if (/reached (?:first )?on an error|error by/i.test(text)) {
    tags.push("errorReach");
  }
  if (/\bSAC\b|sacrifice/i.test(text)) {
    tags.push("sacrifice");
  }
  if (/flied out/i.test(text)) {
    tags.push("flyOut");
  }
  if (/grounded out/i.test(text)) {
    tags.push("groundOut");
  }
  if (/popped up/i.test(text)) {
    tags.push("popOut");
  }
  if (/lined out/i.test(text)) {
    tags.push("lineOut");
  }
  if (/fouled out/i.test(text)) {
    tags.push("foulOut");
  }
  if (/picked off/i.test(text)) {
    tags.push("pickoff");
  }
  if (/out at/i.test(text)) {
    tags.push("runnerOut");
  }

  return [...new Set(tags)];
}

function normalizePlayByPlay(payload) {
  const teams = (payload?.teams || []).map(normalizePbpTeam);
  const teamById = new Map(teams.map((team) => [String(team.teamId), team]));
  const events = [];
  let currentHomeScore = 0;
  let currentVisitorScore = 0;

  for (const period of payload?.periods || []) {
    for (const stat of period.playbyplayStats || []) {
      const teamId = String(stat.teamId || "");
      const team = teamById.get(teamId) || {
        teamId,
        isHome: false,
        seoname: "",
        nameFull: "",
        nameShort: "Unknown Team",
        teamName: "",
        color: "",
      };

      for (const play of stat.plays || []) {
        const homeScore = normalizePbpScore(play.homeScore);
        const visitorScore = normalizePbpScore(play.visitorScore);
        const homeDelta = homeScore === null ? 0 : Math.max(0, homeScore - currentHomeScore);
        const visitorDelta = visitorScore === null ? 0 : Math.max(0, visitorScore - currentVisitorScore);

        if (homeScore !== null) {
          currentHomeScore = homeScore;
        }
        if (visitorScore !== null) {
          currentVisitorScore = visitorScore;
        }

        const playText = cleanPlayText(play.playText || "");
        const tags = derivePlayTags(playText);
        const primaryPlayer = extractLeadPlayerName(playText);
        const scoredPlayers = extractScoredPlayers(playText);

        events.push({
          eventId: `${period.periodNumber || 0}-${events.length + 1}`,
          periodNumber: period.periodNumber ?? null,
          periodDisplay: period.periodDisplay || "",
          teamId,
          team,
          playText,
          tags,
          primaryPlayer,
          scoredPlayers,
          rbiTagged: /\bRBI\b/i.test(playText),
          homeScore: currentHomeScore,
          visitorScore: currentVisitorScore,
          scoreChange: {
            home: homeDelta,
            visitor: visitorDelta,
          },
          battingRuns: team.isHome ? homeDelta : visitorDelta,
          isScoringPlay: homeDelta > 0 || visitorDelta > 0,
        });
      }
    }
  }

  return {
    contestId: String(payload?.contestId || ""),
    title: payload?.title || "",
    description: payload?.description || "",
    divisionName: payload?.divisionName || "",
    status: payload?.status || "",
    period: payload?.period ?? null,
    teams,
    periodsTracked: (payload?.periods || []).length,
    totalEvents: events.length,
    events,
  };
}

function createPbpEventTotals() {
  return {
    totalPlays: 0,
    scoringPlays: 0,
    runsFromScoringPlays: 0,
    hits: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    extraBaseHits: 0,
    walks: 0,
    hitByPitch: 0,
    freeBases: 0,
    strikeouts: 0,
    stolenBases: 0,
    caughtStealing: 0,
    sacrificePlays: 0,
    doublePlays: 0,
    reachedOnError: 0,
    wildPitchAdvances: 0,
    passedBallAdvances: 0,
  };
}

function applyPlayTagsToTotals(totals, tags = []) {
  if (tags.includes("hit")) {
    totals.hits += 1;
  }
  if (tags.includes("single")) {
    totals.singles += 1;
  }
  if (tags.includes("double")) {
    totals.doubles += 1;
  }
  if (tags.includes("triple")) {
    totals.triples += 1;
  }
  if (tags.includes("homeRun")) {
    totals.homeRuns += 1;
  }
  if (tags.includes("extraBaseHit")) {
    totals.extraBaseHits += 1;
  }
  if (tags.includes("walk")) {
    totals.walks += 1;
  }
  if (tags.includes("hitByPitch")) {
    totals.hitByPitch += 1;
  }
  if (tags.includes("freeBase")) {
    totals.freeBases += 1;
  }
  if (tags.includes("strikeout")) {
    totals.strikeouts += 1;
  }
  if (tags.includes("stolenBase")) {
    totals.stolenBases += 1;
  }
  if (tags.includes("caughtStealing")) {
    totals.caughtStealing += 1;
  }
  if (tags.includes("sacrifice")) {
    totals.sacrificePlays += 1;
  }
  if (tags.includes("doublePlay") || tags.includes("triplePlay")) {
    totals.doublePlays += 1;
  }
  if (tags.includes("errorReach")) {
    totals.reachedOnError += 1;
  }
  if (tags.includes("wildPitch")) {
    totals.wildPitchAdvances += 1;
  }
  if (tags.includes("passedBall")) {
    totals.passedBallAdvances += 1;
  }
}

function buildImpactPlayerKey(name = "", teamId = "") {
  return `${String(teamId || "team")}::${slugifyKey(name || "player")}`;
}

function createImpactPlayer(name, team) {
  return {
    playerId: buildImpactPlayerKey(name, team?.teamId),
    name,
    teamId: String(team?.teamId || ""),
    teamShort: team?.nameShort || "",
    teamFull: team?.nameFull || team?.nameShort || "",
    counts: createPbpEventTotals(),
    runsScored: 0,
    runsBattedIn: 0,
    scoringPlays: 0,
    impactScore: 0,
    highlights: [],
  };
}

function eventImpactFromTags(tags = []) {
  let score = 0;
  if (tags.includes("homeRun")) {
    score += 8;
  } else if (tags.includes("triple")) {
    score += 6;
  } else if (tags.includes("double")) {
    score += 4;
  } else if (tags.includes("single")) {
    score += 3;
  }
  if (tags.includes("walk")) {
    score += 2;
  }
  if (tags.includes("hitByPitch")) {
    score += 2;
  }
  if (tags.includes("stolenBase")) {
    score += 2;
  }
  if (tags.includes("sacrifice")) {
    score += 1;
  }
  if (tags.includes("fieldersChoice") || tags.includes("errorReach")) {
    score += 1;
  }
  if (tags.includes("strikeout")) {
    score -= 1;
  }
  if (tags.includes("doublePlay") || tags.includes("triplePlay")) {
    score -= 3;
  }
  return score;
}

function addPlayerHighlight(player, playText) {
  if (!playText || player.highlights.includes(playText) || player.highlights.length >= 3) {
    return;
  }
  player.highlights.push(playText);
}

function buildImpactKeyLine(player) {
  const parts = [];
  if (player.counts.homeRuns) {
    parts.push(`${player.counts.homeRuns} HR`);
  }
  if (player.counts.extraBaseHits && !player.counts.homeRuns) {
    parts.push(`${player.counts.extraBaseHits} XBH`);
  }
  if (player.counts.hits && !player.counts.extraBaseHits) {
    parts.push(`${player.counts.hits} H`);
  }
  if (player.runsBattedIn) {
    parts.push(`${player.runsBattedIn} RBI`);
  }
  if (player.runsScored) {
    parts.push(`${player.runsScored} R`);
  }
  if (player.counts.walks) {
    parts.push(`${player.counts.walks} BB`);
  }
  if (player.counts.stolenBases) {
    parts.push(`${player.counts.stolenBases} SB`);
  }
  if (player.counts.strikeouts && parts.length === 0) {
    parts.push(`${player.counts.strikeouts} K`);
  }
  return parts.join(" / ") || "Tracked through play-by-play";
}

function buildGameInsights(teamSummaries, topPlayers, busiestPeriod, leadChanges) {
  const insights = [];
  const xbhLeader = [...teamSummaries]
    .filter((team) => team.eventTotals.extraBaseHits > 0)
    .sort((left, right) => right.eventTotals.extraBaseHits - left.eventTotals.extraBaseHits)[0];
  if (xbhLeader) {
    insights.push(
      `${xbhLeader.nameShort} created ${xbhLeader.eventTotals.extraBaseHits} extra-base-hit events and turned them into ${xbhLeader.eventTotals.runsFromScoringPlays} run(s).`,
    );
  }

  const pressureLeader = [...teamSummaries]
    .filter((team) => team.eventTotals.freeBases + team.eventTotals.stolenBases > 0)
    .sort(
      (left, right) =>
        right.eventTotals.freeBases + right.eventTotals.stolenBases - (left.eventTotals.freeBases + left.eventTotals.stolenBases),
    )[0];
  if (pressureLeader) {
    insights.push(
      `${pressureLeader.nameShort} forced pressure with ${pressureLeader.eventTotals.freeBases} free bases and ${pressureLeader.eventTotals.stolenBases} stolen-base events.`,
    );
  }

  if (topPlayers[0]) {
    insights.push(`${topPlayers[0].name} posted the strongest event profile: ${topPlayers[0].keyLine}.`);
  }

  if (busiestPeriod) {
    insights.push(`${busiestPeriod.periodDisplay} carried the heaviest scoring load with ${busiestPeriod.runs} total run(s).`);
  }

  if (leadChanges > 0) {
    insights.push(`${leadChanges} lead change${leadChanges === 1 ? "" : "s"} showed up in the scoring timeline.`);
  }

  return insights.slice(0, 4);
}

function buildGameAnalysis(summary, boxscore, playByPlay) {
  const summaryTeams = (summary?.teams || []).map((team) => ({
    teamId: String(team.teamId || ""),
    isHome: Boolean(team.isHome),
    seoname: team.seoname || "",
    nameFull: team.nameFull || "",
    nameShort: team.nameShort || "",
    teamName: team.teamName || "",
    color: team.color || "",
    score: team.score ?? null,
    record: team.record || "",
  }));
  const teamById = new Map(summaryTeams.map((team) => [String(team.teamId), team]));
  for (const team of playByPlay?.teams || []) {
    if (!teamById.has(String(team.teamId))) {
      teamById.set(String(team.teamId), { ...team, score: null, record: "" });
    }
  }

  const boxscoreTeamById = new Map((boxscore?.teams || []).map((team) => [String(team.teamId), team]));
  const teamSummaries = new Map();
  for (const team of teamById.values()) {
    const boxscoreTeam = boxscoreTeamById.get(String(team.teamId)) || null;
    teamSummaries.set(String(team.teamId), {
      teamId: String(team.teamId),
      isHome: Boolean(team.isHome),
      nameShort: team.nameShort || team.nameFull || "Team",
      nameFull: team.nameFull || team.nameShort || "Team",
      seoname: team.seoname || "",
      finalScore: team.score ?? null,
      record: team.record || "",
      eventTotals: createPbpEventTotals(),
      boxscoreTotals: {
        batterTotals: boxscoreTeam?.teamStats?.batterTotals || null,
        pitcherTotals: boxscoreTeam?.teamStats?.pitcherTotals || null,
      },
      topPlayers: [],
    });
  }

  if (!playByPlay?.events?.length) {
    return {
      available: false,
      note: summary?.hasPbp ? "Play-by-play exists upstream but could not be parsed for this game." : "Play-by-play is not available for this game yet.",
      totalEvents: 0,
      scoringPlays: 0,
      leadChanges: 0,
      periodsTracked: 0,
      busiestPeriod: null,
      insights: [],
      topPlayers: [],
      scoringTimeline: [],
      teamSummaries: [...teamSummaries.values()],
    };
  }

  const playerMap = new Map();
  const scoringTimeline = [];
  const periodRunTotals = new Map();
  let leadChanges = 0;
  let lastNonTieLeader = 0;
  // momentum timeline: cumulative impact per team across events
  const momentumTimeline = [];
  const cumulativeImpact = new Map();
  // identify home/visitor team ids for net impact calculations
  let homeTeamId = null;
  let visitorTeamId = null;
  for (const t of teamById.values()) {
    if (t.isHome) {
      homeTeamId = String(t.teamId || "");
    } else {
      visitorTeamId = visitorTeamId || String(t.teamId || "");
    }
    cumulativeImpact.set(String(t.teamId || ""), 0);
  }

  for (const event of playByPlay.events) {
    const teamSummary = teamSummaries.get(String(event.teamId));
    if (!teamSummary) {
      continue;
    }

    teamSummary.eventTotals.totalPlays += 1;
    applyPlayTagsToTotals(teamSummary.eventTotals, event.tags);

    if (event.isScoringPlay) {
      teamSummary.eventTotals.scoringPlays += 1;
      teamSummary.eventTotals.runsFromScoringPlays += event.battingRuns;
      const periodKey = event.periodDisplay || String(event.periodNumber || "?");
      periodRunTotals.set(periodKey, (periodRunTotals.get(periodKey) || 0) + event.battingRuns);

      const leader = Math.sign((event.homeScore || 0) - (event.visitorScore || 0));
      if (leader !== 0) {
        if (lastNonTieLeader !== 0 && leader !== lastNonTieLeader) {
          leadChanges += 1;
        }
        lastNonTieLeader = leader;
      }
    }

    const rbiCount = event.battingRuns > 0 && (event.rbiTagged || event.tags.includes("homeRun")) ? event.battingRuns : 0;

    // compute a simple event impact using the tag-based impact plus RBIs
    const eventImpact = eventImpactFromTags(event.tags || []) + (rbiCount * 3);
    cumulativeImpact.set(String(event.teamId || ""), (cumulativeImpact.get(String(event.teamId || "")) || 0) + eventImpact);
    const cumulativeHome = cumulativeImpact.get(homeTeamId) || 0;
    const cumulativeVisitor = cumulativeImpact.get(visitorTeamId) || 0;
    const netImpact = roundTo((cumulativeHome - cumulativeVisitor), 2);

    momentumTimeline.push({
      eventId: event.eventId,
      periodNumber: event.periodNumber,
      periodDisplay: event.periodDisplay,
      teamId: event.teamId,
      teamShort: event.team?.nameShort || "",
      playText: event.playText,
      impactChange: eventImpact,
      cumulativeHome,
      cumulativeVisitor,
      netImpact,
      scoreLine: `${event.visitorScore}-${event.homeScore}`,
    });

    const primaryCanCredit = event.primaryPlayer && !event.tags.includes("substitution");
    if (primaryCanCredit) {
      const playerKey = buildImpactPlayerKey(event.primaryPlayer, event.teamId);
      const player = playerMap.get(playerKey) || createImpactPlayer(event.primaryPlayer, event.team);
      player.counts.totalPlays += 1;
      applyPlayTagsToTotals(player.counts, event.tags);
      player.runsBattedIn += rbiCount;
      if (event.isScoringPlay) {
        player.scoringPlays += 1;
      }
      player.impactScore += eventImpactFromTags(event.tags) + rbiCount * 3;
      if (event.isScoringPlay || event.tags.includes("homeRun") || event.tags.includes("double") || event.tags.includes("triple")) {
        addPlayerHighlight(player, event.playText);
      }
      playerMap.set(playerKey, player);
    }

    for (const scoredPlayerName of event.scoredPlayers || []) {
      const scoredKey = buildImpactPlayerKey(scoredPlayerName, event.teamId);
      const scoredPlayer = playerMap.get(scoredKey) || createImpactPlayer(scoredPlayerName, event.team);
      scoredPlayer.runsScored += 1;
      scoredPlayer.scoringPlays += 1;
      scoredPlayer.impactScore += 3;
      addPlayerHighlight(scoredPlayer, event.playText);
      playerMap.set(scoredKey, scoredPlayer);
    }

    if (event.isScoringPlay) {
      scoringTimeline.push({
        eventId: event.eventId,
        periodNumber: event.periodNumber,
        periodDisplay: event.periodDisplay,
        teamId: event.teamId,
        teamShort: event.team.nameShort || "Team",
        teamFull: event.team.nameFull || event.team.nameShort || "Team",
        playText: event.playText,
        primaryPlayer: event.primaryPlayer,
        scoredPlayers: event.scoredPlayers,
        runsScored: event.battingRuns,
        rbiCount,
        scoreLine: `${event.visitorScore}-${event.homeScore}`,
      });
    }
  }

  const topPlayers = [...playerMap.values()]
    .map((player) => ({
      ...player,
      keyLine: buildImpactKeyLine(player),
    }))
    .filter(
      (player) =>
        player.impactScore > 0 ||
        player.runsScored > 0 ||
        player.runsBattedIn > 0 ||
        player.counts.hits > 0 ||
        player.counts.walks > 0 ||
        player.counts.stolenBases > 0,
    )
    .sort((left, right) => {
      if (right.impactScore !== left.impactScore) {
        return right.impactScore - left.impactScore;
      }
      if (right.runsBattedIn !== left.runsBattedIn) {
        return right.runsBattedIn - left.runsBattedIn;
      }
      if (right.runsScored !== left.runsScored) {
        return right.runsScored - left.runsScored;
      }
      return left.name.localeCompare(right.name);
    });

  const finalizedTeamSummaries = [...teamSummaries.values()].map((team) => ({
    ...team,
    topPlayers: topPlayers.filter((player) => player.teamId === team.teamId).slice(0, 5),
  }));

  const busiestPeriodEntry = [...periodRunTotals.entries()].sort((left, right) => right[1] - left[1])[0] || null;
  const busiestPeriod = busiestPeriodEntry
    ? {
        periodDisplay: busiestPeriodEntry[0],
        runs: busiestPeriodEntry[1],
      }
    : null;

  return {
    available: true,
    note: "Derived from NCAA play-by-play text, running score updates, and the normalized boxscore totals.",
    totalEvents: playByPlay.totalEvents,
    scoringPlays: scoringTimeline.length,
    leadChanges,
    periodsTracked: playByPlay.periodsTracked,
    busiestPeriod,
    insights: buildGameInsights(finalizedTeamSummaries, topPlayers.slice(0, 8), busiestPeriod, leadChanges),
    topPlayers: topPlayers.slice(0, 8),
    scoringTimeline: scoringTimeline,
    momentumTimeline: momentumTimeline,
    teamSummaries: finalizedTeamSummaries,
  };
}

function clonePbpEventTotals(source = {}) {
  return {
    totalPlays: source.totalPlays || 0,
    scoringPlays: source.scoringPlays || 0,
    runsFromScoringPlays: source.runsFromScoringPlays || 0,
    hits: source.hits || 0,
    singles: source.singles || 0,
    doubles: source.doubles || 0,
    triples: source.triples || 0,
    homeRuns: source.homeRuns || 0,
    extraBaseHits: source.extraBaseHits || 0,
    walks: source.walks || 0,
    hitByPitch: source.hitByPitch || 0,
    freeBases: source.freeBases || 0,
    strikeouts: source.strikeouts || 0,
    stolenBases: source.stolenBases || 0,
    caughtStealing: source.caughtStealing || 0,
    sacrificePlays: source.sacrificePlays || 0,
    doublePlays: source.doublePlays || 0,
    reachedOnError: source.reachedOnError || 0,
    wildPitchAdvances: source.wildPitchAdvances || 0,
    passedBallAdvances: source.passedBallAdvances || 0,
  };
}

function mergePbpEventTotals(target, source = {}) {
  for (const [key, value] of Object.entries(clonePbpEventTotals(source))) {
    target[key] += value;
  }
}

function createRecentFormAggregate() {
  return {
    record: {
      wins: 0,
      losses: 0,
      ties: 0,
    },
    totals: {
      runsScored: 0,
      runsAllowed: 0,
      runDifferential: 0,
      hits: 0,
      walks: 0,
      strikeouts: 0,
      stolenBases: 0,
      inningsPitched: 0,
      hitsAllowed: 0,
      walksAllowed: 0,
      pitchingStrikeouts: 0,
    },
    averages: {
      runsScored: 0,
      runsAllowed: 0,
      runDifferential: 0,
      hits: 0,
      walks: 0,
      strikeouts: 0,
      stolenBases: 0,
      walksAllowed: 0,
      pitchingStrikeouts: 0,
    },
    eventTotals: createPbpEventTotals(),
  };
}

function createEmptyInningProfile() {
  return {
    runsFor: {},
    runsAgainst: {},
  };
}

function normalizeInningLabel(value = "") {
  const raw = String(value || "").trim();
  const match = raw.match(/(\d+)/);
  if (match) {
    return String(Number.parseInt(match[1], 10));
  }
  return raw || "?";
}

function mergeInningProfile(target, source = {}) {
  for (const key of Object.keys(source.runsFor || {})) {
    target.runsFor[key] = (target.runsFor[key] || 0) + Number(source.runsFor[key] || 0);
  }
  for (const key of Object.keys(source.runsAgainst || {})) {
    target.runsAgainst[key] = (target.runsAgainst[key] || 0) + Number(source.runsAgainst[key] || 0);
  }
}

function buildInningProfile(analysis = null, schoolTeamId = "") {
  const profile = createEmptyInningProfile();
  for (const event of analysis?.scoringTimeline || []) {
    const inning = normalizeInningLabel(event.periodDisplay || event.periodNumber);
    if (!inning) {
      continue;
    }
    if (String(event.teamId || "") === String(schoolTeamId || "")) {
      profile.runsFor[inning] = (profile.runsFor[inning] || 0) + Number(event.runsScored || 0);
    } else {
      profile.runsAgainst[inning] = (profile.runsAgainst[inning] || 0) + Number(event.runsScored || 0);
    }
  }
  return profile;
}

function inningSortValue(label = "") {
  const parsed = Number.parseInt(String(label || ""), 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return 999;
}

function finalizeInningProfile(profile = {}, gameCount = 1) {
  const innings = [...new Set([...Object.keys(profile.runsFor || {}), ...Object.keys(profile.runsAgainst || {})])]
    .sort((left, right) => {
      const sortDelta = inningSortValue(left) - inningSortValue(right);
      return sortDelta !== 0 ? sortDelta : String(left).localeCompare(String(right));
    });

  const runsForTotals = innings.map((inning) => Number(profile.runsFor?.[inning] || 0));
  const runsAgainstTotals = innings.map((inning) => Number(profile.runsAgainst?.[inning] || 0));
  const runsForPerGame = runsForTotals.map((value) => roundTo(value / Math.max(gameCount, 1), 1));
  const runsAgainstPerGame = runsAgainstTotals.map((value) => roundTo(value / Math.max(gameCount, 1), 1));
  const strongestScoringIndex = runsForTotals.reduce(
    (bestIndex, value, index, values) => (value > (values[bestIndex] || 0) ? index : bestIndex),
    0,
  );
  const weakestRunPreventionIndex = runsAgainstTotals.reduce(
    (bestIndex, value, index, values) => (value > (values[bestIndex] || 0) ? index : bestIndex),
    0,
  );

  return {
    innings,
    runsForTotals,
    runsAgainstTotals,
    runsForPerGame,
    runsAgainstPerGame,
    maxValue: Math.max(...runsForTotals, ...runsAgainstTotals, 0),
    strongestScoringInning: innings[strongestScoringIndex]
      ? {
          inning: innings[strongestScoringIndex],
          totalRuns: runsForTotals[strongestScoringIndex],
          runsPerGame: runsForPerGame[strongestScoringIndex],
        }
      : null,
    weakestRunPreventionInning: innings[weakestRunPreventionIndex]
      ? {
          inning: innings[weakestRunPreventionIndex],
          totalRuns: runsAgainstTotals[weakestRunPreventionIndex],
          runsPerGame: runsAgainstPerGame[weakestRunPreventionIndex],
        }
      : null,
  };
}

function extractPitcherUsage(team = null, gameDate = "", gameId = "") {
  return (team?.players || [])
    .filter((player) => hasPitchingLine(player))
    .map((player) => {
      const stats = player.pitcherStats || {};
      const inningsPitchedRaw = String(stats.inningsPitched || "0");
      const inningsPitched = parseInningsPitched(inningsPitchedRaw);
      const strikeouts = parseNumericStat(stats.strikeouts);
      const walksAllowed = parseNumericStat(stats.walksAllowed);
      const hitsAllowed = parseNumericStat(stats.hitsAllowed);
      const battersFaced = parseNumericStat(stats.battersFaced);
      const earnedRunsAllowed = parseNumericStat(stats.earnedRunsAllowed);
      return {
        playerId: slugifyKey(player.name || "pitcher"),
        name: player.name || "Unknown Pitcher",
        starter: Boolean(player.starter),
        inningsPitchedRaw,
        inningsPitched,
        strikeouts,
        walksAllowed,
        hitsAllowed,
        earnedRunsAllowed,
        battersFaced,
        gameDate,
        gameId,
        keyLine: `${inningsPitchedRaw} IP / ${strikeouts} K / ${walksAllowed} BB / ${hitsAllowed} H`,
      };
    });
}

function createStaffUsageRecord(row = {}) {
  return {
    playerId: row.playerId || slugifyKey(row.name || "pitcher"),
    name: row.name || "Unknown Pitcher",
    starts: row.starter ? 1 : 0,
    appearances: 0,
    inningsPitched: 0,
    strikeouts: 0,
    walksAllowed: 0,
    hitsAllowed: 0,
    earnedRunsAllowed: 0,
    battersFaced: 0,
    lastGameDate: "",
    lastGameId: "",
    latestKeyLine: "",
  };
}

function mergeStaffUsageRecord(target, row = {}) {
  target.appearances += 1;
  target.starts += row.starter ? 1 : 0;
  target.inningsPitched = roundTo(target.inningsPitched + Number(row.inningsPitched || 0), 1);
  target.strikeouts += Number(row.strikeouts || 0);
  target.walksAllowed += Number(row.walksAllowed || 0);
  target.hitsAllowed += Number(row.hitsAllowed || 0);
  target.earnedRunsAllowed += Number(row.earnedRunsAllowed || 0);
  target.battersFaced += Number(row.battersFaced || 0);
  target.lastGameDate = row.gameDate || target.lastGameDate;
  target.lastGameId = row.gameId || target.lastGameId;
  target.latestKeyLine = row.keyLine || target.latestKeyLine;
}

function createEmptyRecentForm(school, requestedGames, note) {
  return {
    available: false,
    source: "NCAA wrapper recent form",
    school,
    generatedAt: new Date().toISOString(),
    requestedGames,
    includedGames: 0,
    games: [],
    aggregate: createRecentFormAggregate(),
    topPlayers: [],
    staffUsage: [],
    inningProfile: finalizeInningProfile(createEmptyInningProfile(), 1),
    insights: [],
    note,
  };
}

function findOpponentTeam(teams = [], schoolTeam = null) {
  if (!schoolTeam) {
    return teams[0] || null;
  }
  return teams.find((team) => String(team.teamId || "") !== String(schoolTeam.teamId || "")) || null;
}

function getSchoolAnalysisTeam(analysis = null, schoolSlug = "", schoolTeamId = "") {
  return (
    (analysis?.teamSummaries || []).find(
      (team) =>
        String(team.teamId || "") === String(schoolTeamId || "") || normalizeSlug(team.seoname) === normalizeSlug(schoolSlug),
    ) || null
  );
}

function mergeRecentImpactPlayer(target, source = {}, gameSummary = null) {
  target.gamesTracked += 1;
  mergePbpEventTotals(target.counts, source.counts || {});
  target.runsScored += source.runsScored || 0;
  target.runsBattedIn += source.runsBattedIn || 0;
  target.scoringPlays += source.scoringPlays || 0;
  target.impactScore += source.impactScore || 0;
  if (gameSummary?.gameId) {
    target.gameIds.push(gameSummary.gameId);
  }
  for (const highlight of source.highlights || []) {
    if (!highlight || target.highlights.includes(highlight) || target.highlights.length >= 4) {
      continue;
    }
    target.highlights.push(highlight);
  }
}

function createRecentImpactPlayer(source = {}, gameSummary = null) {
  return {
    playerId: source.playerId || slugifyKey(source.name || "player"),
    name: source.name || "Unknown Player",
    teamId: String(source.teamId || ""),
    teamShort: source.teamShort || "",
    teamFull: source.teamFull || source.teamShort || "",
    counts: createPbpEventTotals(),
    runsScored: 0,
    runsBattedIn: 0,
    scoringPlays: 0,
    impactScore: 0,
    highlights: [],
    gamesTracked: 0,
    gameIds: [],
    lastGameId: gameSummary?.gameId || "",
    lastGameDate: gameSummary?.date || "",
  };
}

function summarizeSchoolGamePerspective(gameMeta, schoolSlug, gameData) {
  const summaryTeams = gameData?.summary?.teams || [];
  const schoolSummaryTeam =
    findTeamBySlug(summaryTeams, schoolSlug) ||
    summaryTeams.find((team) => String(team.teamId || "") === String(gameMeta?.team?.teamId || "")) ||
    null;
  const opponentSummaryTeam = findOpponentTeam(summaryTeams, schoolSummaryTeam);

  const boxscoreTeams = gameData?.boxscore?.error ? [] : gameData?.boxscore?.teams || [];
  const schoolBoxscoreTeam =
    findTeamBySlug(boxscoreTeams, schoolSlug) ||
    boxscoreTeams.find((team) => String(team.teamId || "") === String(schoolSummaryTeam?.teamId || "")) ||
    null;
  const schoolAnalysisTeam = getSchoolAnalysisTeam(gameData?.analysis, schoolSlug, schoolSummaryTeam?.teamId);
  const inningProfile = buildInningProfile(gameData?.analysis, schoolSummaryTeam?.teamId);
  const pitcherUsage = extractPitcherUsage(schoolBoxscoreTeam, gameMeta?.date || "", gameMeta?.gameId || "");

  const runsScored = Number(schoolSummaryTeam?.score ?? schoolAnalysisTeam?.finalScore ?? 0);
  const runsAllowed = Number(opponentSummaryTeam?.score ?? 0);
  const runDifferential = runsScored - runsAllowed;
  const result = runDifferential > 0 ? "W" : runDifferential < 0 ? "L" : "T";
  const opponentLabel = opponentSummaryTeam?.nameShort || gameMeta?.opponent?.short || "Opponent";

  return {
    gameId: gameMeta?.gameId || gameData?.summary?.gameId || "",
    date: gameMeta?.date || "",
    startTime: gameMeta?.startTime || gameData?.summary?.startTime || "",
    venueLabel: gameMeta?.isSchoolHome ? "vs" : "at",
    opponent: opponentLabel,
    opponentFull: opponentSummaryTeam?.nameFull || opponentLabel,
    result,
    scoreLine: `${runsScored}-${runsAllowed}`,
    runsScored,
    runsAllowed,
    runDifferential,
    boxscoreTotals: {
      batterTotals: schoolBoxscoreTeam?.teamStats?.batterTotals || null,
      pitcherTotals: schoolBoxscoreTeam?.teamStats?.pitcherTotals || null,
    },
    eventTotals: clonePbpEventTotals(schoolAnalysisTeam?.eventTotals || {}),
    topPlayers: (schoolAnalysisTeam?.topPlayers || []).map((player) => ({
      ...player,
      counts: clonePbpEventTotals(player.counts || {}),
    })),
    inningProfile,
    pitcherUsage,
    analysisNote: gameData?.analysis?.note || "",
  };
}

function buildRecentFormInsights(aggregate, games, topPlayers) {
  const insights = [];
  const totalGames = games.length;
  if (!totalGames) {
    return insights;
  }

  insights.push(
    `Recent record: ${aggregate.record.wins}-${aggregate.record.losses}${aggregate.record.ties ? `-${aggregate.record.ties}` : ""} across ${totalGames} final game${totalGames === 1 ? "" : "s"}.`,
  );
  insights.push(
    `Scored ${aggregate.averages.runsScored.toFixed(1)} and allowed ${aggregate.averages.runsAllowed.toFixed(1)} runs per game for a ${aggregate.averages.runDifferential >= 0 ? "+" : ""}${aggregate.averages.runDifferential.toFixed(1)} average differential.`,
  );

  if (aggregate.eventTotals.extraBaseHits || aggregate.eventTotals.freeBases || aggregate.eventTotals.stolenBases) {
    insights.push(
      `Created ${aggregate.eventTotals.extraBaseHits} extra-base-hit events, ${aggregate.eventTotals.freeBases} free-base events, and ${aggregate.eventTotals.stolenBases} stolen-base events in the tracked PBP sample.`,
    );
  }

  if (topPlayers[0]) {
    insights.push(
      `${topPlayers[0].name} led the recent form sample with ${topPlayers[0].keyLine} across ${topPlayers[0].gamesTracked} game${topPlayers[0].gamesTracked === 1 ? "" : "s"}.`,
    );
  }

  return insights.slice(0, 4);
}

async function getSchoolRecentForm(env, schoolSlug, options = {}) {
  const requestedGames = options.gameCount ?? RECENT_FORM_DEFAULT_GAMES;
  const lookbackDays = options.lookbackDays ?? RECENT_FORM_LOOKBACK_DAYS;
  const cacheKey = `${normalizeSlug(schoolSlug)}|${requestedGames}|${lookbackDays}`;
  const cached = readTimedCache(recentFormCache, cacheKey);
  if (cached) {
    return cached;
  }
  const school = options.school || (await getSchoolIdentity(env, schoolSlug));
  if (!school) {
    return null;
  }

  let gamesWindow = options.recentWindow || null;
  let recentFinalGames = (gamesWindow?.recentGames || []).filter((game) => normalizeSlug(game.gameState) === "final");

  if (!gamesWindow || recentFinalGames.length < requestedGames) {
    gamesWindow = await getSchoolGamesWindow(env, school.slug, {
      lookbackDays,
      lookaheadDays: 0,
    });
    recentFinalGames = (gamesWindow.recentGames || []).filter((game) => normalizeSlug(game.gameState) === "final");
  }

  const selectedGames = recentFinalGames.slice(-requestedGames);
  if (!selectedGames.length) {
    return writeTimedCache(
      recentFormCache,
      cacheKey,
      createEmptyRecentForm(school, requestedGames, "No recent final games were available for the selected school."),
    );
  }

  const gameSummaries = await mapWithConcurrency(selectedGames, 2, async (game) => {
    const gameData = await getGameLiveSummary(env, game.gameId);
    return summarizeSchoolGamePerspective(game, school.slug, gameData);
  });

  const aggregate = createRecentFormAggregate();
  const playerMap = new Map();
  const pitcherMap = new Map();
  const inningProfile = createEmptyInningProfile();

  for (const game of gameSummaries) {
    if (game.result === "W") {
      aggregate.record.wins += 1;
    } else if (game.result === "L") {
      aggregate.record.losses += 1;
    } else {
      aggregate.record.ties += 1;
    }

    aggregate.totals.runsScored += game.runsScored;
    aggregate.totals.runsAllowed += game.runsAllowed;
    aggregate.totals.runDifferential += game.runDifferential;
    aggregate.totals.hits += parseNumericStat(game.boxscoreTotals.batterTotals?.hits);
    aggregate.totals.walks += parseNumericStat(game.boxscoreTotals.batterTotals?.walks);
    aggregate.totals.strikeouts += parseNumericStat(game.boxscoreTotals.batterTotals?.strikeouts);
    aggregate.totals.stolenBases += parseNumericStat(game.boxscoreTotals.batterTotals?.stolenBases);
    aggregate.totals.inningsPitched += parseInningsPitched(game.boxscoreTotals.pitcherTotals?.inningsPitched);
    aggregate.totals.hitsAllowed += parseNumericStat(game.boxscoreTotals.pitcherTotals?.hitsAllowed);
    aggregate.totals.walksAllowed += parseNumericStat(game.boxscoreTotals.pitcherTotals?.walksAllowed);
    aggregate.totals.pitchingStrikeouts += parseNumericStat(game.boxscoreTotals.pitcherTotals?.strikeouts);
    mergePbpEventTotals(aggregate.eventTotals, game.eventTotals);

    for (const player of game.topPlayers || []) {
      const key = slugifyKey(player.name || player.playerId || "player");
      const aggregatePlayer = playerMap.get(key) || createRecentImpactPlayer(player, game);
      mergeRecentImpactPlayer(aggregatePlayer, player, game);
      aggregatePlayer.lastGameId = game.gameId;
      aggregatePlayer.lastGameDate = game.date;
      playerMap.set(key, aggregatePlayer);
    }
  }

  const gameCount = gameSummaries.length;
  aggregate.averages.runsScored = roundTo(aggregate.totals.runsScored / gameCount, 1);
  aggregate.averages.runsAllowed = roundTo(aggregate.totals.runsAllowed / gameCount, 1);
    aggregate.averages.runDifferential = roundTo(aggregate.totals.runDifferential / gameCount, 1);
    aggregate.averages.hits = roundTo(aggregate.totals.hits / gameCount, 1);
    aggregate.averages.walks = roundTo(aggregate.totals.walks / gameCount, 1);
    aggregate.averages.strikeouts = roundTo(aggregate.totals.strikeouts / gameCount, 1);
    aggregate.averages.stolenBases = roundTo(aggregate.totals.stolenBases / gameCount, 1);
    aggregate.averages.walksAllowed = roundTo(aggregate.totals.walksAllowed / gameCount, 1);
    aggregate.averages.pitchingStrikeouts = roundTo(aggregate.totals.pitchingStrikeouts / gameCount, 1);
    aggregate.totals.inningsPitched = roundTo(aggregate.totals.inningsPitched, 1);

  for (const game of gameSummaries) {
    mergeInningProfile(inningProfile, game.inningProfile || {});
    for (const pitcher of game.pitcherUsage || []) {
      const key = slugifyKey(pitcher.name || pitcher.playerId || "pitcher");
      const record = pitcherMap.get(key) || createStaffUsageRecord(pitcher);
      mergeStaffUsageRecord(record, pitcher);
      pitcherMap.set(key, record);
    }
  }

  const topPlayers = [...playerMap.values()]
    .map((player) => ({
      ...player,
      keyLine: buildImpactKeyLine(player),
    }))
    .sort((left, right) => {
      if (right.impactScore !== left.impactScore) {
        return right.impactScore - left.impactScore;
      }
      if (right.runsBattedIn !== left.runsBattedIn) {
        return right.runsBattedIn - left.runsBattedIn;
      }
      if (right.runsScored !== left.runsScored) {
        return right.runsScored - left.runsScored;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 8);

  const staffUsage = [...pitcherMap.values()]
    .sort((left, right) => {
      if (right.inningsPitched !== left.inningsPitched) {
        return right.inningsPitched - left.inningsPitched;
      }
      if (right.appearances !== left.appearances) {
        return right.appearances - left.appearances;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 8)
    .map((pitcher) => ({
      ...pitcher,
      inningsPitched: roundTo(pitcher.inningsPitched, 1),
      inningsPerAppearance: roundTo(pitcher.inningsPitched / Math.max(pitcher.appearances, 1), 1),
      keyLine: `${roundTo(pitcher.inningsPitched, 1)} IP / ${pitcher.strikeouts} K / ${pitcher.walksAllowed} BB / ${pitcher.hitsAllowed} H`,
    }));

  return writeTimedCache(recentFormCache, cacheKey, {
    available: true,
    source: "NCAA wrapper recent form",
    school,
    generatedAt: new Date().toISOString(),
    requestedGames,
    includedGames: gameSummaries.length,
    games: [...gameSummaries].reverse(),
    aggregate,
    topPlayers,
    staffUsage,
    inningProfile: finalizeInningProfile(inningProfile, gameCount),
    insights: buildRecentFormInsights(aggregate, gameSummaries, topPlayers),
    note: "Aggregated from recent final games using normalized boxscores and play-by-play-derived event summaries.",
  });
}

function formatScoutNumber(value, decimals = 1) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) || decimals === 0 ? String(Math.round(numeric)) : numeric.toFixed(decimals);
}

function getScoutAdvantage(schoolValue, opponentValue, higherBetter = true, threshold = 0.25) {
  const schoolBetter = higherBetter ? schoolValue - opponentValue : opponentValue - schoolValue;
  const opponentBetter = higherBetter ? opponentValue - schoolValue : schoolValue - opponentValue;
  if (Math.abs(schoolValue - opponentValue) <= threshold) {
    return "even";
  }
  if (schoolBetter > 0) {
    return "school";
  }
  if (opponentBetter > 0) {
    return "opponent";
  }
  return "even";
}

function buildScoutCompareMetrics(schoolRecentForm, opponentRecentForm) {
  const schoolAggregate = schoolRecentForm?.aggregate || createRecentFormAggregate();
  const opponentAggregate = opponentRecentForm?.aggregate || createRecentFormAggregate();
  const schoolGames = Math.max(Number(schoolRecentForm?.includedGames || 0), 1);
  const opponentGames = Math.max(Number(opponentRecentForm?.includedGames || 0), 1);
  const schoolExtraBaseRate = schoolAggregate.eventTotals.extraBaseHits / schoolGames;
  const opponentExtraBaseRate = opponentAggregate.eventTotals.extraBaseHits / opponentGames;
  const schoolFreeBaseRate = schoolAggregate.eventTotals.freeBases / schoolGames;
  const opponentFreeBaseRate = opponentAggregate.eventTotals.freeBases / opponentGames;

  const metrics = [
    {
      label: "Runs / game",
      schoolValue: Number(schoolAggregate.averages.runsScored || 0),
      opponentValue: Number(opponentAggregate.averages.runsScored || 0),
      higherBetter: true,
      note: "Current scoring pace over the recent final-game sample.",
    },
    {
      label: "Runs allowed / game",
      schoolValue: Number(schoolAggregate.averages.runsAllowed || 0),
      opponentValue: Number(opponentAggregate.averages.runsAllowed || 0),
      higherBetter: false,
      note: "Lower is better here — this is the quickest run-prevention read.",
    },
    {
      label: "XBH pressure / game",
      schoolValue: schoolExtraBaseRate,
      opponentValue: opponentExtraBaseRate,
      higherBetter: true,
      note: "Extra-base-hit events from tracked play-by-play.",
    },
    {
      label: "Free bases / game",
      schoolValue: schoolFreeBaseRate,
      opponentValue: opponentFreeBaseRate,
      higherBetter: true,
      note: "Walks, hit batters, and other free-base events created.",
    },
    {
      label: "Staff K / game",
      schoolValue: Number(schoolAggregate.averages.pitchingStrikeouts || 0),
      opponentValue: Number(opponentAggregate.averages.pitchingStrikeouts || 0),
      higherBetter: true,
      note: "Strikeout volume from the recent pitching sample.",
    },
    {
      label: "Walks allowed / game",
      schoolValue: Number(schoolAggregate.averages.walksAllowed || 0),
      opponentValue: Number(opponentAggregate.averages.walksAllowed || 0),
      higherBetter: false,
      note: "Lower is better — free passes often become attack points.",
    },
  ];

  return metrics.map((metric) => ({
    ...metric,
    schoolDisplay: formatScoutNumber(metric.schoolValue),
    opponentDisplay: formatScoutNumber(metric.opponentValue),
    advantage: getScoutAdvantage(metric.schoolValue, metric.opponentValue, metric.higherBetter),
  }));
}

function buildOpponentWeaknessFlags(opponentRecentForm) {
  if (!opponentRecentForm?.available) {
    return [];
  }

  const aggregate = opponentRecentForm.aggregate || createRecentFormAggregate();
  const games = Math.max(Number(opponentRecentForm.includedGames || 0), 1);
  const weaknessFlags = [];
  const runsAllowed = Number(aggregate.averages.runsAllowed || 0);
  const runsScored = Number(aggregate.averages.runsScored || 0);
  const walksAllowed = Number(aggregate.averages.walksAllowed || 0);
  const strikeouts = Number(aggregate.averages.strikeouts || 0);
  const extraBaseRate = aggregate.eventTotals.extraBaseHits / games;
  const freeBaseRate = aggregate.eventTotals.freeBases / games;
  const weakInning = opponentRecentForm.inningProfile?.weakestRunPreventionInning || null;

  if (runsAllowed >= 6) {
    weaknessFlags.push({
      title: "Run prevention leak",
      detail: `They have allowed ${formatScoutNumber(runsAllowed)} runs per game in the recent sample.`,
      emphasis: "attack",
    });
  }
  if (walksAllowed >= 4) {
    weaknessFlags.push({
      title: "Free bases available",
      detail: `Opponents are getting ${formatScoutNumber(walksAllowed)} walks per game against this staff.`,
      emphasis: "attack",
    });
  }
  if (runsScored <= 4.2) {
    weaknessFlags.push({
      title: "Offense can stall",
      detail: `They are scoring only ${formatScoutNumber(runsScored)} runs per game right now.`,
      emphasis: "watch",
    });
  }
  if (extraBaseRate <= 2.2) {
    weaknessFlags.push({
      title: "Limited damage profile",
      detail: `Only ${formatScoutNumber(extraBaseRate)} extra-base-hit events per game in tracked PBP.`,
      emphasis: "watch",
    });
  }
  if (strikeouts >= 8.5 && freeBaseRate <= 3.2) {
    weaknessFlags.push({
      title: "Swing-and-miss offense",
      detail: `They are averaging ${formatScoutNumber(strikeouts)} strikeouts per game without offsetting it with many free bases.`,
      emphasis: "watch",
    });
  }
  if (weakInning?.runsPerGame >= 1.2) {
    weaknessFlags.push({
      title: `Inning ${weakInning.inning} vulnerability`,
      detail: `They are allowing ${formatScoutNumber(weakInning.runsPerGame)} runs per game in inning ${weakInning.inning}.`,
      emphasis: "attack",
    });
  }

  if (!weaknessFlags.length) {
    weaknessFlags.push({
      title: "No soft spot yet",
      detail: "The recent sample is balanced enough that coaches should lean more on matchup video and personnel eval.",
      emphasis: "steady",
    });
  }

  return weaknessFlags.slice(0, 4);
}

function buildOpponentScoutInsights(school, opponent, compareMetrics, weaknessFlags, opponentRecentForm) {
  const insights = [];
  const schoolEdges = compareMetrics.filter((metric) => metric.advantage === "school").slice(0, 2);
  const opponentEdges = compareMetrics.filter((metric) => metric.advantage === "opponent").slice(0, 2);

  if (schoolEdges.length) {
    insights.push(
      `${school.name || school.slug} holds the cleaner recent edge in ${schoolEdges.map((metric) => metric.label.toLowerCase()).join(" and ")}.`,
    );
  }
  if (opponentEdges.length) {
    insights.push(
      `${opponent.name || opponent.slug} has been stronger in ${opponentEdges.map((metric) => metric.label.toLowerCase()).join(" and ")} over the recent sample.`,
    );
  }
  if (weaknessFlags[0]) {
    insights.push(`${opponent.name || opponent.slug} weakness to pressure first: ${weaknessFlags[0].title.toLowerCase()}.`);
  }
  if (opponentRecentForm?.topPlayers?.[0]) {
    insights.push(
      `${opponentRecentForm.topPlayers[0].name} is the top recent impact threat with ${opponentRecentForm.topPlayers[0].keyLine}.`,
    );
  }

  return insights.slice(0, 4);
}

async function getSchoolOpponentScout(env, schoolSlug, options = {}) {
  const scoutGameCount = options.gameCount ?? OPPONENT_SCOUT_DEFAULT_GAMES;
  const scoutLookbackDays = options.lookbackDays ?? OPPONENT_SCOUT_LOOKBACK_DAYS;
  const cacheKey = `${normalizeSlug(schoolSlug)}|${scoutGameCount}|${scoutLookbackDays}`;
  const cached = readTimedCache(opponentScoutCache, cacheKey);
  if (cached) {
    return cached;
  }
  const school = options.school || (await getSchoolIdentity(env, schoolSlug));
  if (!school) {
    return null;
  }

  const gamesWindow =
    options.gamesWindow ||
    (await getSchoolGamesWindow(env, school.slug, {
      lookbackDays: scoutLookbackDays,
      lookaheadDays: UPCOMING_LOOKAHEAD_DAYS,
    }));
  const recentForm =
    options.recentForm ||
    (await getSchoolRecentForm(env, school.slug, {
      school,
      recentWindow: gamesWindow,
      gameCount: scoutGameCount,
      lookbackDays: scoutLookbackDays,
    }));

  const nextGame = gamesWindow?.nextGame || null;
  const opponentSlug = normalizeSlug(nextGame?.opponent?.seo || "");
  if (!nextGame || !opponentSlug) {
    return writeTimedCache(opponentScoutCache, cacheKey, {
      available: false,
      source: "NCAA wrapper opponent scout",
      school,
      opponent: null,
      compareMetrics: [],
      weaknessFlags: [],
      dangerPlayers: [],
      staffUsage: { school: recentForm?.staffUsage || [], opponent: [] },
      inningHeatmap: null,
      insights: [],
      note: "No upcoming opponent is available in the current schedule window.",
    });
  }

  const opponentSchool = (await getSchoolIdentity(env, opponentSlug)) || {
    slug: opponentSlug,
    name: nextGame.opponent?.short || opponentSlug,
    long: nextGame.opponent?.full || nextGame.opponent?.short || opponentSlug,
  };
  const opponentRecentForm = await getSchoolRecentForm(env, opponentSlug, {
    school: opponentSchool,
    gameCount: scoutGameCount,
    lookbackDays: scoutLookbackDays,
  });
  const compareMetrics = buildScoutCompareMetrics(recentForm, opponentRecentForm);
  const weaknessFlags = buildOpponentWeaknessFlags(opponentRecentForm);
  const inningSet = [
    ...(recentForm?.inningProfile?.innings || []),
    ...(opponentRecentForm?.inningProfile?.innings || []),
  ];
  const innings = [...new Set(inningSet)].sort((left, right) => {
    const sortDelta = inningSortValue(left) - inningSortValue(right);
    return sortDelta !== 0 ? sortDelta : String(left).localeCompare(String(right));
  });
  const schoolInningMap = new Map((recentForm?.inningProfile?.innings || []).map((inning, index) => [inning, index]));
  const opponentInningMap = new Map((opponentRecentForm?.inningProfile?.innings || []).map((inning, index) => [inning, index]));
  const inningHeatmap = innings.length
    ? {
        innings,
        schoolScored: innings.map((inning) => recentForm?.inningProfile?.runsForPerGame?.[schoolInningMap.get(inning)] || 0),
        schoolAllowed: innings.map((inning) => recentForm?.inningProfile?.runsAgainstPerGame?.[schoolInningMap.get(inning)] || 0),
        opponentScored: innings.map(
          (inning) => opponentRecentForm?.inningProfile?.runsForPerGame?.[opponentInningMap.get(inning)] || 0,
        ),
        opponentAllowed: innings.map(
          (inning) => opponentRecentForm?.inningProfile?.runsAgainstPerGame?.[opponentInningMap.get(inning)] || 0,
        ),
        maxValue: Math.max(
          ...(innings.map((inning) => recentForm?.inningProfile?.runsForPerGame?.[schoolInningMap.get(inning)] || 0)),
          ...(innings.map((inning) => recentForm?.inningProfile?.runsAgainstPerGame?.[schoolInningMap.get(inning)] || 0)),
          ...(innings.map((inning) => opponentRecentForm?.inningProfile?.runsForPerGame?.[opponentInningMap.get(inning)] || 0)),
          ...(innings.map((inning) => opponentRecentForm?.inningProfile?.runsAgainstPerGame?.[opponentInningMap.get(inning)] || 0)),
          0,
        ),
      }
    : null;

  return writeTimedCache(opponentScoutCache, cacheKey, {
    available: true,
    source: "NCAA wrapper opponent scout",
    school,
    opponent: opponentSchool,
    nextGame: {
      gameId: nextGame.gameId,
      date: nextGame.date,
      startTime: nextGame.startTime,
      venueLabel: nextGame.isSchoolHome ? "vs" : "at",
      opponent: nextGame.opponent?.short || opponentSchool.name,
      title: `${nextGame.isSchoolHome ? "vs" : "at"} ${nextGame.opponent?.short || opponentSchool.name}`,
    },
    compareMetrics,
    weaknessFlags,
    dangerPlayers: (opponentRecentForm?.topPlayers || []).slice(0, 4),
    staffUsage: {
      school: (recentForm?.staffUsage || []).slice(0, 4),
      opponent: (opponentRecentForm?.staffUsage || []).slice(0, 4),
    },
    inningHeatmap,
    insights: buildOpponentScoutInsights(school, opponentSchool, compareMetrics, weaknessFlags, opponentRecentForm),
    note: "Built from each team's recent-form sample, normalized boxscores, and play-by-play-derived event summaries.",
  });
}

function buildLatestGameImpactMap(game = null) {
  const map = new Map();
  for (const player of game?.topPlayers || []) {
    map.set(slugifyKey(player.name || "player"), {
      ...player,
      counts: clonePbpEventTotals(player.counts || {}),
    });
  }
  return map;
}

function buildRecentTrendMap(recentForm = null) {
  const map = new Map();
  for (const player of recentForm?.topPlayers || []) {
    map.set(slugifyKey(player.name || "player"), {
      ...player,
      counts: clonePbpEventTotals(player.counts || {}),
    });
  }
  return map;
}

function findTeamBySlug(teams = [], schoolSlug = "") {
  return teams.find((team) => normalizeSlug(team.seoname) === normalizeSlug(schoolSlug)) || null;
}

function summarizeLiveTeam(team) {
  if (!team) {
    return null;
  }

  return {
    teamId: team.teamId,
    seoname: team.seoname,
    nameFull: team.nameFull,
    nameShort: team.nameShort,
    teamName: team.teamName,
    color: team.color,
    playerCount: team.players.length,
    players: team.players.map((player) => ({
      name: player.name,
      position: player.position,
      number: player.number,
      starter: player.starter,
    })),
    teamStats: {
      batterTotals: team.teamStats?.batterTotals || null,
      pitcherTotals: team.teamStats?.pitcherTotals || null,
    },
  };
}

function hasPitchingLine(player = {}) {
  const stats = player.pitcherStats || {};
  return ["inningsPitched", "hitsAllowed", "runsAllowed", "walksAllowed", "strikeouts"].some((key) => {
    const value = stats[key];
    return value !== null && value !== undefined && value !== "";
  });
}

function formatPlayerPosition(player = {}) {
  const position = String(player.position || "").toUpperCase();
  if (position === "P") {
    return player.starter ? "SP" : "RP";
  }
  return position || "UTIL";
}

function buildPlayerId(player = {}, sourceGame = null) {
  const gameKey = sourceGame?.gameId || "latest";
  const number = player.number || "na";
  return `${gameKey}:${number}:${slugifyKey(player.name || "player")}`;
}

function defaultDefenseComponent(field = {}) {
  const chances = parseNumericStat(field.putouts) + parseNumericStat(field.assists) + parseNumericStat(field.errors);
  if (!chances) {
    return 55;
  }
  return inverseScale(parseNumericStat(field.errors), 2, 0);
}

function buildHitterBoardPlayer(player, context) {
  const batter = player.batterStats || {};
  const hitting = player.hittingSeason || {};
  const field = player.fieldStats || {};

  const atBats = parseNumericStat(batter.atBats);
  const hits = parseNumericStat(batter.hits);
  const runs = parseNumericStat(batter.runsScored);
  const runsBattedIn = parseNumericStat(batter.runsBattedIn);
  const walks = parseNumericStat(batter.walks);
  const strikeouts = parseNumericStat(batter.strikeouts);
  const doubles = parseNumericStat(hitting.doubles);
  const triples = parseNumericStat(hitting.triples);
  const homeRuns = parseNumericStat(hitting.homeRuns);
  const extraBaseHits = doubles + triples + homeRuns;
  const errors = parseNumericStat(field.errors);
  const putouts = parseNumericStat(field.putouts);
  const assists = parseNumericStat(field.assists);

  const components = {
    Production: scale(hits + runs + runsBattedIn, 0, 8),
    "Base pressure": scale(hits + walks, 0, 5),
    Impact: scale(doubles + triples * 2 + homeRuns * 2.5, 0, 5),
    Discipline: scale(walks - strikeouts * 0.35 + 2, 0, 4),
    Defense: defaultDefenseComponent(field),
  };

  const score =
    components.Production * 0.34 +
    components["Base pressure"] * 0.26 +
    components.Impact * 0.18 +
    components.Discipline * 0.12 +
    components.Defense * 0.1;

  const productionParts = [];
  if (hits) {
    productionParts.push(`${hits} H`);
  }
  if (runs) {
    productionParts.push(`${runs} R`);
  }
  if (runsBattedIn) {
    productionParts.push(`${runsBattedIn} RBI`);
  }
  if (walks) {
    productionParts.push(`${walks} BB`);
  }
  if (extraBaseHits) {
    productionParts.push(`${extraBaseHits} XBH`);
  }

  const quickLine = productionParts.length
    ? productionParts.join(" / ")
    : `${atBats || 0} AB / ${strikeouts || 0} SO`;

  const summary = productionParts.length
    ? `${player.name} ${player.starter ? "started" : "appeared"} in the latest available final and produced ${productionParts.join(", ")}.`
    : `${player.name} ${player.starter ? "started" : "appeared"} in the latest available final but did not post offensive production in the boxscore.`;

  const defenseNote = errors
    ? `${errors} error${errors === 1 ? "" : "s"}`
    : putouts || assists
      ? `${putouts} PO / ${assists} A`
      : "Limited fielding sample";

  return {
    id: buildPlayerId(player, context.sourceGame),
    name: player.name,
    school: context.school?.name || DEFAULT_SCHOOL_NAME,
    role: "Hitter",
    position: formatPlayerPosition(player),
    rawPosition: player.position || "",
    number: player.number || "",
    starter: Boolean(player.starter),
    metaLine: [player.starter ? "Starter" : "Bench", player.number ? `#${player.number}` : "", context.modeLabel]
      .filter(Boolean)
      .join(" / "),
    summary,
    summaryMetrics: [quickLine, `${atBats} AB`, defenseNote],
    components: Object.fromEntries(Object.entries(components).map(([label, value]) => [label, Math.round(value)])),
    score: Math.round(score),
    fit: fitLabel(Math.round(score)),
    detailBadges: [
      context.school?.name || DEFAULT_SCHOOL_NAME,
      formatPlayerPosition(player),
      player.starter ? "Starter" : "Bench",
      player.number ? `#${player.number}` : "",
      context.sourceGame?.date || "",
    ].filter(Boolean),
    statCards: [
      { label: "AB", value: String(atBats) },
      { label: "H", value: String(hits) },
      { label: "R", value: String(runs) },
      { label: "RBI", value: String(runsBattedIn) },
      { label: "BB", value: String(walks) },
      { label: "SO", value: String(strikeouts) },
      { label: "XBH", value: String(extraBaseHits) },
      { label: "Errors", value: String(errors) },
    ],
    sourceSummary: `Latest boxscore and play-by-play window for ${context.school?.name || DEFAULT_SCHOOL_NAME}`,
    sourceGame: context.sourceGame,
  };
}

function buildPitcherBoardPlayer(player, context) {
  const pitching = player.pitcherStats || {};

  const inningsPitchedRaw = String(pitching.inningsPitched || "0");
  const inningsPitched = parseInningsPitched(inningsPitchedRaw);
  const hitsAllowed = parseNumericStat(pitching.hitsAllowed);
  const runsAllowed = parseNumericStat(pitching.runsAllowed);
  const earnedRunsAllowed = parseNumericStat(pitching.earnedRunsAllowed);
  const walksAllowed = parseNumericStat(pitching.walksAllowed);
  const strikeouts = parseNumericStat(pitching.strikeouts);
  const battersFaced = parseNumericStat(pitching.battersFaced);
  const era = parseNumericStat(pitching.earnedRunAverage);

  const components = {
    "Run prevention": inverseScale(earnedRunsAllowed, 6, 0),
    Workload: scale(inningsPitched, 0, 9),
    "Miss bats": scale(strikeouts, 0, 12),
    Command: scale(safeDivide(strikeouts + 1, walksAllowed + 1, 0), 0.5, 5),
    "Traffic control": inverseScale(hitsAllowed + walksAllowed, 12, 0),
  };

  const score =
    components["Run prevention"] * 0.28 +
    components.Workload * 0.24 +
    components["Miss bats"] * 0.22 +
    components.Command * 0.16 +
    components["Traffic control"] * 0.1;

  const quickLine = `${inningsPitchedRaw} IP / ${strikeouts} K / ${walksAllowed} BB / ${earnedRunsAllowed} ER`;
  const summary = `${player.name} ${player.starter ? "opened" : "relieved"} in the latest available final and worked ${inningsPitchedRaw} innings with ${strikeouts} strikeouts, ${walksAllowed} walks, and ${earnedRunsAllowed} earned runs allowed.`;

  return {
    id: buildPlayerId(player, context.sourceGame),
    name: player.name,
    school: context.school?.name || DEFAULT_SCHOOL_NAME,
    role: "Pitcher",
    position: formatPlayerPosition(player),
    rawPosition: player.position || "",
    number: player.number || "",
    starter: Boolean(player.starter),
    metaLine: [player.starter ? "Starter" : "Relief", player.number ? `#${player.number}` : "", context.modeLabel]
      .filter(Boolean)
      .join(" / "),
    summary,
    summaryMetrics: [quickLine, `${hitsAllowed} H allowed`, battersFaced ? `${battersFaced} BF` : ""].filter(Boolean),
    components: Object.fromEntries(Object.entries(components).map(([label, value]) => [label, Math.round(value)])),
    score: Math.round(score),
    fit: fitLabel(Math.round(score)),
    detailBadges: [
      context.school?.name || DEFAULT_SCHOOL_NAME,
      formatPlayerPosition(player),
      player.starter ? "Starter" : "Relief",
      player.number ? `#${player.number}` : "",
      context.sourceGame?.date || "",
    ].filter(Boolean),
    statCards: [
      { label: "IP", value: inningsPitchedRaw },
      { label: "K", value: String(strikeouts) },
      { label: "BB", value: String(walksAllowed) },
      { label: "H", value: String(hitsAllowed) },
      { label: "R", value: String(runsAllowed) },
      { label: "ER", value: String(earnedRunsAllowed) },
      { label: "BF", value: String(battersFaced) },
      { label: "ERA", value: Number.isFinite(era) ? roundTo(era, 2).toFixed(2) : "--" },
    ],
    sourceSummary: `Latest boxscore and play-by-play window for ${context.school?.name || DEFAULT_SCHOOL_NAME}`,
    sourceGame: context.sourceGame,
  };
}

function buildPlayerBoardPlayers(team, context) {
  const players = (team?.players || [])
    .map((player) => (hasPitchingLine(player) ? buildPitcherBoardPlayer(player, context) : buildHitterBoardPlayer(player, context)))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.name.localeCompare(right.name);
    });

  const roleCounts = players.reduce(
    (counts, player) => {
      counts[player.role] += 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  return {
    players,
    roleCounts,
  };
}

function createNationalPlayerRecord(row, role) {
  return {
    id: nationalPlayerKey(row, role),
    name: compactText(row.Name || "Unknown Player"),
    school: compactText(row.Team || "Unknown Team"),
    classYear: compactText(row.Cl || ""),
    position: compactText(row.Position || (role === "Pitcher" ? "P" : "UT")),
    role,
    trackedStats: {},
    leaderboardRanks: {},
    leaderboards: [],
  };
}

function mergeNationalPlayerRow(record, spec, row) {
  record.trackedStats[spec.key] = parseNumericStat(row[spec.field]);
  const rank = Number.parseInt(String(row.Rank || "").replace(/[^0-9]/g, ""), 10);
  if (!Number.isNaN(rank)) {
    record.leaderboardRanks[spec.key] = rank;
  }
  if (!record.leaderboards.includes(spec.label)) {
    record.leaderboards.push(spec.label);
  }

  if (record.role === "Hitter") {
    record.games = Math.max(record.games || 0, parseNumericStat(row.G));
    record.atBats = Math.max(record.atBats || 0, parseNumericStat(row.AB));
    record.hits = Math.max(record.hits || 0, parseNumericStat(row.H));
    record.walks = Math.max(record.walks || 0, parseNumericStat(row.BB));
    record.hitByPitch = Math.max(record.hitByPitch || 0, parseNumericStat(row.HBP));
    record.sacrificeFlies = Math.max(record.sacrificeFlies || 0, parseNumericStat(row.SF));
    record.sacrificeHits = Math.max(record.sacrificeHits || 0, parseNumericStat(row.SH));
    record.homeRuns = Math.max(record.homeRuns || 0, parseNumericStat(row.HR));
    record.runsBattedIn = Math.max(record.runsBattedIn || 0, parseNumericStat(row.RBI));
    record.stolenBases = Math.max(record.stolenBases || 0, parseNumericStat(row.SB));
    record.caughtStealing = Math.max(record.caughtStealing || 0, parseNumericStat(row.CS));
    record.totalBases = Math.max(record.totalBases || 0, parseNumericStat(row.TB));
  } else {
    record.appearances = Math.max(record.appearances || 0, parseNumericStat(row.App));
    const inningsPitchedRaw = compactText(row.IP || "");
    if (!record.inningsPitchedRaw || parseInningsPitched(inningsPitchedRaw) > parseInningsPitched(record.inningsPitchedRaw)) {
      record.inningsPitchedRaw = inningsPitchedRaw || record.inningsPitchedRaw || "0.0";
    }
    record.inningsPitched = Math.max(record.inningsPitched || 0, parseInningsPitched(row.IP));
    record.runsAllowed = Math.max(record.runsAllowed || 0, parseNumericStat(row.R));
    record.earnedRuns = Math.max(record.earnedRuns || 0, parseNumericStat(row.ER));
    record.strikeouts = Math.max(record.strikeouts || 0, parseNumericStat(row.SO));
    record.wins = Math.max(record.wins || 0, parseNumericStat(row.W));
    record.losses = Math.max(record.losses || 0, parseNumericStat(row.L));
    record.saves = Math.max(record.saves || 0, parseNumericStat(row.SV));
    record.hitsAllowed = Math.max(record.hitsAllowed || 0, parseNumericStat(row.HA));
    record.walksAllowed = Math.max(record.walksAllowed || 0, parseNumericStat(row.BB));
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function fetchNationalStatPages(env, spec) {
  const firstPage = await fetchJson(`${baseUrl(env)}/stats/baseball/d1/current/individual/${spec.id}`);
  const totalPages = readInt(firstPage.pages, 1, 1, 50);
  const pages = Math.min(totalPages, NATIONAL_PLAYER_MAX_PAGES_PER_SPEC);
  const rows = [...(firstPage.data || [])];

  if (pages > 1) {
    const remainingPages = Array.from({ length: pages - 1 }, (_, index) => index + 2);
    const otherPages = await mapWithConcurrency(remainingPages, 2, async (pageNumber) =>
      fetchJson(`${baseUrl(env)}/stats/baseball/d1/current/individual/${spec.id}?page=${pageNumber}`),
    );
    for (const page of otherPages) {
      rows.push(...(page.data || []));
    }
  }

  return {
    spec,
    updated: compactText(firstPage.updated || ""),
    pagesFetched: pages,
    totalPages,
    rows,
  };
}

function finalizeNationalHitter(record) {
  const contact = weightedAverage([
    { value: scale(record.trackedStats.battingAverage, 0.24, 0.44), weight: 0.7 },
    { value: scale(record.trackedStats.hits, 8, 65), weight: 0.3 },
  ]);
  const onBase = weightedAverage([
    { value: scale(record.trackedStats.onBasePercentage, 0.31, 0.55), weight: 0.7 },
    { value: scale(record.trackedStats.walks, 0, 40), weight: 0.3 },
  ]);
  const impact = weightedAverage([
    { value: scale(record.trackedStats.homeRuns, 0, 22), weight: 0.35 },
    { value: scale(record.trackedStats.runsBattedIn, 0, 70), weight: 0.3 },
    { value: scale(record.trackedStats.totalBases, 10, 140), weight: 0.35 },
  ]);
  const speed = scale(record.trackedStats.stolenBases, 0, 35);

  const componentEntries = [
    { label: "Contact", value: contact, weight: 0.28 },
    { label: "On-base", value: onBase, weight: 0.26 },
    { label: "Impact", value: impact, weight: 0.28 },
    { label: "Speed", value: Number.isFinite(speed) ? speed : null, weight: 0.18 },
  ].filter((entry) => Number.isFinite(entry.value));

  const baseScore = weightedAverage(componentEntries);
  const coverageFactor = 0.55 + (componentEntries.length / 4) * 0.45;
  const score = Math.round((baseScore || 0) * coverageFactor);
  const fit = fitLabel(score);

  const summaryMetrics = [
    record.trackedStats.battingAverage ? `AVG ${record.trackedStats.battingAverage.toFixed(3)}` : "",
    record.trackedStats.onBasePercentage ? `OBP ${record.trackedStats.onBasePercentage.toFixed(3)}` : "",
    record.homeRuns ? `${record.homeRuns} HR` : "",
    record.runsBattedIn ? `${record.runsBattedIn} RBI` : "",
    record.stolenBases ? `${record.stolenBases} SB` : "",
    record.walks ? `${record.walks} BB` : "",
  ].filter(Boolean);

  return {
    ...record,
    metaLine: [record.school, record.classYear, `${record.leaderboards.length} tracked categories`].filter(Boolean).join(" / "),
    summary: `${record.name} appears on ${record.leaderboards.length} NCAA national leaderboards for hitters, led by ${
      summaryMetrics.slice(0, 3).join(", ") || "tracked offensive production"
    }.`,
    summaryMetrics,
    components: Object.fromEntries(componentEntries.map((entry) => [entry.label, Math.round(entry.value)])),
    score,
    fit,
    detailBadges: [record.school, record.classYear, record.position, "National hitter", `${record.leaderboards.length} categories`].filter(Boolean),
    statCards: [
      record.trackedStats.battingAverage ? { label: "AVG", value: record.trackedStats.battingAverage.toFixed(3) } : null,
      record.trackedStats.onBasePercentage ? { label: "OBP", value: record.trackedStats.onBasePercentage.toFixed(3) } : null,
      record.homeRuns ? { label: "HR", value: String(record.homeRuns) } : null,
      record.runsBattedIn ? { label: "RBI", value: String(record.runsBattedIn) } : null,
      record.hits ? { label: "Hits", value: String(record.hits) } : null,
      record.walks ? { label: "BB", value: String(record.walks) } : null,
      record.stolenBases ? { label: "SB", value: String(record.stolenBases) } : null,
      record.totalBases ? { label: "TB", value: String(record.totalBases) } : null,
    ].filter(Boolean),
  };
}

function finalizeNationalPitcher(record) {
  const runPrevention = weightedAverage([
    { value: inverseScale(record.trackedStats.earnedRunAverage, 8, 0.5), weight: 0.65 },
    { value: inverseScale(record.trackedStats.hitsAllowedPerNine, 12, 3), weight: 0.35 },
  ]);
  const missBats = scale(record.trackedStats.strikeoutsPerNine, 5, 18);
  const command = inverseScale(record.trackedStats.walksAllowedPerNine, 8, 0.4);
  const results = weightedAverage([
    { value: scale(record.wins, 0, 9), weight: 0.6 },
    { value: scale(record.saves, 0, 12), weight: 0.4 },
  ]);

  const componentEntries = [
    { label: "Run prevention", value: runPrevention, weight: 0.34 },
    { label: "Miss bats", value: Number.isFinite(missBats) ? missBats : null, weight: 0.28 },
    { label: "Command", value: Number.isFinite(command) ? command : null, weight: 0.2 },
    { label: "Result value", value: results, weight: 0.18 },
  ].filter((entry) => Number.isFinite(entry.value));

  const baseScore = weightedAverage(componentEntries);
  const coverageFactor = 0.55 + (componentEntries.length / 4) * 0.45;
  const score = Math.round((baseScore || 0) * coverageFactor);
  const fit = fitLabel(score);

  const summaryMetrics = [
    record.trackedStats.earnedRunAverage ? `ERA ${record.trackedStats.earnedRunAverage.toFixed(2)}` : "",
    record.trackedStats.strikeoutsPerNine ? `K/9 ${record.trackedStats.strikeoutsPerNine.toFixed(2)}` : "",
    record.wins ? `${record.wins} W` : "",
    record.saves ? `${record.saves} SV` : "",
    record.trackedStats.hitsAllowedPerNine ? `H/9 ${record.trackedStats.hitsAllowedPerNine.toFixed(2)}` : "",
    record.trackedStats.walksAllowedPerNine ? `BB/9 ${record.trackedStats.walksAllowedPerNine.toFixed(2)}` : "",
  ].filter(Boolean);

  return {
    ...record,
    metaLine: [record.school, record.classYear, `${record.leaderboards.length} tracked categories`].filter(Boolean).join(" / "),
    summary: `${record.name} appears on ${record.leaderboards.length} NCAA national leaderboards for pitchers, led by ${
      summaryMetrics.slice(0, 3).join(", ") || "tracked run prevention"
    }.`,
    summaryMetrics,
    components: Object.fromEntries(componentEntries.map((entry) => [entry.label, Math.round(entry.value)])),
    score,
    fit,
    detailBadges: [record.school, record.classYear, record.position, "National pitcher", `${record.leaderboards.length} categories`].filter(Boolean),
    statCards: [
      record.trackedStats.earnedRunAverage ? { label: "ERA", value: record.trackedStats.earnedRunAverage.toFixed(2) } : null,
      record.trackedStats.strikeoutsPerNine ? { label: "K/9", value: record.trackedStats.strikeoutsPerNine.toFixed(2) } : null,
      record.wins ? { label: "Wins", value: String(record.wins) } : null,
      record.saves ? { label: "Saves", value: String(record.saves) } : null,
      record.trackedStats.hitsAllowedPerNine ? { label: "H/9", value: record.trackedStats.hitsAllowedPerNine.toFixed(2) } : null,
      record.trackedStats.walksAllowedPerNine ? { label: "BB/9", value: record.trackedStats.walksAllowedPerNine.toFixed(2) } : null,
      record.inningsPitchedRaw ? { label: "IP", value: record.inningsPitchedRaw } : null,
      record.strikeouts ? { label: "SO", value: String(record.strikeouts) } : null,
    ].filter(Boolean),
  };
}

function finalizeNationalPlayer(record) {
  const finalized = record.role === "Pitcher" ? finalizeNationalPitcher(record) : finalizeNationalHitter(record);
  return {
    ...finalized,
    nationalRank:
      Object.values(finalized.leaderboardRanks || {})
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((left, right) => left - right)[0] || null,
  };
}

async function buildNationalPlayerBoard(env) {
  const playerMap = new Map();
  const updatedSet = new Set();
  const truncatedCategories = [];

  for (const spec of NATIONAL_PLAYER_STAT_SPECS) {
    const leaderboard = await fetchNationalStatPages(env, spec);
    if (leaderboard.updated) {
      updatedSet.add(leaderboard.updated);
    }
    if (leaderboard.totalPages > leaderboard.pagesFetched) {
      truncatedCategories.push(spec.label);
    }

    for (const row of leaderboard.rows) {
      const key = nationalPlayerKey(row, spec.role);
      const record = playerMap.get(key) || createNationalPlayerRecord(row, spec.role);
      mergeNationalPlayerRow(record, spec, row);
      playerMap.set(key, record);
    }
  }

  const players = [...playerMap.values()]
    .map(finalizeNationalPlayer)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if ((left.nationalRank || 9999) !== (right.nationalRank || 9999)) {
        return (left.nationalRank || 9999) - (right.nationalRank || 9999);
      }
      return left.name.localeCompare(right.name);
    });

  const roleCounts = players.reduce(
    (counts, player) => {
      counts[player.role] += 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  return {
    source: "NCAA wrapper individual stats leaderboards",
    generatedAt: new Date().toISOString(),
    note:
      truncatedCategories.length
        ? `This national board is built from NCAA individual leaderboard categories and is capped at ${NATIONAL_PLAYER_MAX_PAGES_PER_SPEC} pages per category to stay within Cloudflare Worker limits. Truncated categories: ${truncatedCategories.join(", ")}.`
        : "This national board is built from NCAA individual leaderboard categories, so it covers tracked national stat qualifiers and leaders rather than every rostered player in Division I.",
    trackedCategories: {
      Hitter: NATIONAL_PLAYER_STAT_SPECS.filter((spec) => spec.role === "Hitter").map((spec) => spec.label),
      Pitcher: NATIONAL_PLAYER_STAT_SPECS.filter((spec) => spec.role === "Pitcher").map((spec) => spec.label),
    },
    updates: [...updatedSet],
    totalPlayers: players.length,
    roleCounts,
    players,
  };
}

async function getNationalPlayerBoard(env) {
  const now = Date.now();
  if (nationalPlayerBoardCache.payload && nationalPlayerBoardCache.expiresAt > now) {
    return nationalPlayerBoardCache.payload;
  }

  const payload = await buildNationalPlayerBoard(env);
  nationalPlayerBoardCache = {
    generatedAt: payload.generatedAt,
    expiresAt: now + NATIONAL_PLAYER_CACHE_TTL_MS,
    payload,
  };
  return payload;
}

async function getStoredPlayerUniverse(env, options = {}) {
  const now = Date.now();
  if (playerUniverseCache.payload && playerUniverseCache.expiresAt > now) {
    return playerUniverseCache.payload;
  }

  const datasets = await getPlayerSnapshotDatasets(env, options);
  let nationalPayload = null;
  let nationalError = "";
  try {
    nationalPayload = await getNationalPlayerBoard(env);
  } catch (error) {
    nationalError = error instanceof Error ? error.message : String(error);
  }

  const payload = buildPlayerUniverse({ nationalPayload, nationalError, datasets });
  playerUniverseCache = {
    generatedAt: payload.generatedAt,
    expiresAt: now + PLAYER_UNIVERSE_CACHE_TTL_MS,
    payload,
  };
  return payload;
}

function buildCoverage(latestBoxscore, schoolName = DEFAULT_SCHOOL_NAME) {
  const schoolTeamPlayers = latestBoxscore?.schoolTeam?.players || [];
  const verifiedNames = schoolTeamPlayers.slice(0, 5).map((player) => `${player.name} (${player.position || "UTIL"})`);

  return [
    {
      label: "School index",
      value: "The NCAA school index includes school slug, short name, and long name for searchable school discovery.",
    },
    {
      label: "Scoreboard",
      value: "Scoreboard responses include game IDs, team names, start dates, start times, scores, game state, and matchup URLs.",
    },
    {
      label: "Boxscore",
      value: verifiedNames.length
        ? `Boxscores include team names, player names, positions, starter flags, and team totals. Verified ${schoolName} names include ${verifiedNames.join(", ")}.`
        : "Boxscores include team names, player names, positions, starter flags, and team totals when a recent final is available.",
    },
    {
      label: "Play-by-play",
      value: "Play-by-play is available for completed games and includes inning-by-inning event text with player names and score changes.",
    },
  ];
}

async function getSchoolsIndex(env) {
  const cached = readObjectCache(schoolsIndexCache);
  if (cached) {
    return cached;
  }
  const schools = await fetchJson(`${baseUrl(env)}/schools-index`);
  return writeObjectCache(schoolsIndexCache, schools, SCHOOLS_INDEX_CACHE_TTL_MS);
}

async function getSchoolIdentity(env, schoolSlug) {
  const normalizedSlug = normalizeSlug(schoolSlug);
  const schools = await getSchoolsIndex(env);
  const match = schools.find((school) => normalizeSlug(school.slug) === normalizedSlug) || null;
  if (!match) {
    return null;
  }
  return normalizeSchool(match);
}

function normalizeMacStandingRow(rowHtml, index) {
  const cellMatches = [...String(rowHtml || "").matchAll(/<td class="hide-on-medium-down"[^>]*>([\s\S]*?)<\/td>/gi)];
  const cells = cellMatches.map((match) => stripHtml(match[1]));
  if (cells.length < 9) {
    return null;
  }

  const [schoolName, conferenceRecord, conferencePct, overallRecord, overallPct, homeRecord, awayRecord, neutralRecord, streak] =
    cells;

  return {
    rank: index + 1,
    teamId: normalizeSlug(schoolName),
    displayName: schoolName,
    fullName: schoolName,
    abbreviation: "",
    logo: "",
    conferenceRecord,
    conferencePct,
    overallRecord,
    overallPct,
    homeRecord,
    awayRecord,
    neutralRecord,
    streak,
  };
}

function stripMarkdownLink(value = "") {
  const match = String(value || "").match(/\[([^\]]+)\]\([^)]+\)/);
  return (match ? match[1] : value).trim();
}

function normalizeMacStandingMarkdownRow(line = "", index) {
  const parts = String(line || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 13 || parts[0] === "---") {
    return null;
  }

  return {
    rank: index + 1,
    teamId: normalizeSlug(stripMarkdownLink(parts[0])),
    displayName: stripMarkdownLink(parts[0]),
    fullName: stripMarkdownLink(parts[0]),
    abbreviation: "",
    logo: "",
    conferenceRecord: parts[2],
    conferencePct: parts[4],
    overallRecord: parts[5],
    overallPct: parts[8],
    homeRecord: parts[9],
    awayRecord: parts[10],
    neutralRecord: parts[11],
    streak: parts[12],
  };
}

async function getMacStandingsFromMirror() {
  const markdown = await fetchText(MAC_STANDINGS_MIRROR_URL);
  const lines = markdown.split("\n");
  const headerIndex = lines.findIndex((line) => line.includes("| School | School | Conf |"));
  const firstDataIndex = lines.findIndex((line) => /^\|\s*\[/.test(line.trim()));
  const tableStart = headerIndex !== -1 ? headerIndex + 2 : firstDataIndex;
  if (tableStart === -1) {
    throw new Error("MAC standings mirror did not include any recognizable baseball table rows.");
  }

  const tableLines = [];
  for (let index = tableStart; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("|")) {
      if (tableLines.length) {
        break;
      }
      continue;
    }
    if (!/^\|\s*\[/.test(line) && tableLines.length === 0) {
      break;
    }
    tableLines.push(line);
  }

  const table = tableLines.map((line, index) => normalizeMacStandingMarkdownRow(line, index)).filter(Boolean);
  if (!table.length) {
    throw new Error("MAC standings mirror did not include any baseball table rows.");
  }

  return {
    source: "Mid-American Conference standings page",
    fetchedAt: new Date().toISOString(),
    conference: {
      id: "mac",
      name: "Mid-American Conference",
      shortName: "MAC",
    },
    table,
    note:
      "Read from the official MAC baseball standings page through a mirrored text endpoint and cached weekly in the backend.",
  };
}

async function getMacStandingsFromRepoSnapshot(env) {
  const raw = await fetchText(macStandingsSnapshotUrl(env), {
    headers: {
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    },
    cf: {
      cacheTtl: Math.floor(MAC_STANDINGS_CACHE_TTL_MS / 1000),
      cacheEverything: true,
    },
  });

  const snapshot = JSON.parse(raw);
  if (!snapshot?.table?.length) {
    throw new Error("Repository snapshot did not include any MAC standings rows.");
  }

  return {
    ...snapshot,
    note:
      "Loaded from the weekly official MAC standings snapshot stored in the repo and cached for one week in the backend.",
  };
}

async function getMacStandingsTable(env) {
  const cached = readObjectCache(macStandingsCache);
  if (cached) {
    return cached;
  }

  try {
    const html = await fetchText(MAC_STANDINGS_URL);
    const tableMatch = html.match(/<table[^>]*sidearm-standings-table[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) {
      throw new Error("MAC baseball standings table was not found on getsomemaction.com.");
    }

    const bodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!bodyMatch) {
      throw new Error("MAC baseball standings rows were not found on getsomemaction.com.");
    }

    const rowMatches = [...bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
    const table = rowMatches
      .map((match, index) => normalizeMacStandingRow(match[1], index))
      .filter(Boolean);

    const payload = {
      source: "Mid-American Conference standings page",
      fetchedAt: new Date().toISOString(),
      conference: {
        id: "mac",
        name: "Mid-American Conference",
        shortName: "MAC",
      },
      table,
      note:
        "Scraped from the official MAC baseball standings page and cached for one week in the Worker runtime before refreshing.",
    };

    return writeObjectCache(macStandingsCache, payload, MAC_STANDINGS_CACHE_TTL_MS);
  } catch (error) {
    try {
      const payload = await getMacStandingsFromMirror();
      return writeObjectCache(macStandingsCache, payload, MAC_STANDINGS_CACHE_TTL_MS);
    } catch (mirrorError) {
      try {
        const payload = await getMacStandingsFromRepoSnapshot(env);
        payload.warning = `Direct scrape: ${error instanceof Error ? error.message : String(error)}. Mirror scrape: ${
          mirrorError instanceof Error ? mirrorError.message : String(mirrorError)
        }.`;
        return writeObjectCache(macStandingsCache, payload, MAC_STANDINGS_CACHE_TTL_MS);
      } catch (repoSnapshotError) {
        if (macStandingsSnapshot?.table?.length) {
          const payload = {
            ...macStandingsSnapshot,
            note:
              "Live MAC standings scraping is currently unavailable from the deployed Worker, so the backend is serving the bundled official snapshot instead.",
            warning:
              `Direct scrape: ${error instanceof Error ? error.message : String(error)}. Mirror scrape: ${
                mirrorError instanceof Error ? mirrorError.message : String(mirrorError)
              }. Repo snapshot: ${
                repoSnapshotError instanceof Error ? repoSnapshotError.message : String(repoSnapshotError)
              }.`,
          };
          return writeObjectCache(macStandingsCache, payload, MAC_STANDINGS_CACHE_TTL_MS);
        }
        const table = await buildMacStandingsFromEspn();
        const payload = {
          source: "Computed MAC standings from ESPN schedules",
          fetchedAt: new Date().toISOString(),
          conference: {
            id: "mac",
            name: "Mid-American Conference",
            shortName: "MAC",
          },
          table,
          note:
            "The official MAC standings page and weekly snapshot were unavailable, so this table is computed from ESPN team schedules and cached weekly instead.",
          warning:
            `Direct scrape: ${error instanceof Error ? error.message : String(error)}. Mirror scrape: ${
              mirrorError instanceof Error ? mirrorError.message : String(mirrorError)
            }. Repo snapshot: ${
              repoSnapshotError instanceof Error ? repoSnapshotError.message : String(repoSnapshotError)
            }.`,
        };
        return writeObjectCache(macStandingsCache, payload, MAC_STANDINGS_CACHE_TTL_MS);
      }
    }
  }
}

async function getMacConferenceStandings(env, schoolSlug) {
  const school = await getSchoolIdentity(env, schoolSlug);
  if (!school) {
    return null;
  }

  const payload = await getMacStandingsTable(env);
  const schoolKeys = getSchoolKeyVariants(school);
  const schoolEntry =
    payload.table.find((entry) => schoolKeys.some((key) => key === normalizeNameKey(entry.displayName))) || null;

  if (!schoolEntry) {
    return null;
  }

  return {
    available: true,
    source: "Mid-American Conference standings page",
    format: "mac",
    school,
    conference: payload.conference,
    schoolEntry,
    table: payload.table,
    note: payload.note,
  };
}

function normalizeEspnRef(url = "") {
  return String(url || "").replace(/^http:/i, "https:");
}

function extractEspnTeamId(ref = "") {
  const match = String(ref || "").match(/\/teams\/(\d+)\?/i);
  return match ? String(match[1]) : "";
}

function getEspnTeamVariants(team = {}) {
  const slugBase = String(team.slug || "")
    .split("-")
    .slice(0, -1)
    .join(" ");
  return [
    team.location,
    team.shortDisplayName,
    team.displayName,
    team.nickname,
    slugBase,
    team.slug,
    team.abbreviation,
  ]
    .map(normalizeNameKey)
    .filter(Boolean);
}

function getSchoolKeyVariants(school = {}) {
  const longName = String(school.long || "");
  const shortName = String(school.name || "");
  return [
    school.slug,
    shortName,
    longName,
    longName.replace(/^University of\s+/i, ""),
    longName.replace(/^The\s+/i, ""),
    longName.replace(/\s+University$/i, ""),
  ]
    .map(normalizeNameKey)
    .filter(Boolean);
}

async function getEspnTeamsDirectory() {
  const cached = readObjectCache(espnTeamsDirectoryCache);
  if (cached) {
    return cached;
  }

  const payload = await fetchJson(espnSiteUrl(`/teams?limit=400`));
  const teams = (((payload?.sports || [])[0]?.leagues || [])[0]?.teams || [])
    .map((entry) => entry?.team || null)
    .filter(Boolean)
    .map((team) => ({
      id: String(team.id || ""),
      slug: team.slug || "",
      abbreviation: team.abbreviation || "",
      displayName: team.displayName || "",
      shortDisplayName: team.shortDisplayName || team.displayName || "",
      nickname: team.nickname || "",
      location: team.location || "",
      logo: (team.logos || []).find((logo) => (logo.rel || []).includes("full"))?.href || "",
      variants: getEspnTeamVariants(team),
    }));

  const byId = Object.fromEntries(teams.map((team) => [team.id, team]));
  return writeObjectCache(
    espnTeamsDirectoryCache,
    {
      teams,
      byId,
    },
    SCHOOLS_INDEX_CACHE_TTL_MS,
  );
}

async function getEspnTeamSchedule(teamId) {
  const cacheKey = String(teamId || "");
  const cached = readTimedCache(espnTeamScheduleCache, cacheKey);
  if (cached) {
    return cached;
  }
  const payload = await fetchJson(espnSiteUrl(`/teams/${cacheKey}/schedule`));
  return writeTimedCache(espnTeamScheduleCache, cacheKey, payload, MAC_STANDINGS_CACHE_TTL_MS);
}

async function getMacEspnTeams() {
  const { teams } = await getEspnTeamsDirectory();
  return MAC_BASEBALL_MEMBER_SCHOOLS.map((school) => {
    const matched = findBestEspnTeamForSchool(teams, school);
    return matched
      ? {
          ...matched,
          canonicalName: school.name,
        }
      : null;
  }).filter(Boolean);
}

function buildRecordString(wins = 0, losses = 0, ties = 0) {
  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
}

function buildPercentString(wins = 0, losses = 0, ties = 0) {
  const games = wins + losses + ties;
  if (!games) {
    return ".000";
  }
  const pct = (wins + ties * 0.5) / games;
  return pct.toFixed(3).replace(/^0/, "");
}

function createMacComputedRecord(team) {
  return {
    teamId: team.id,
    displayName: team.shortDisplayName || team.displayName || team.canonicalName,
    fullName: team.displayName || team.canonicalName,
    abbreviation: team.abbreviation || "",
    logo: team.logo || "",
    conferenceWins: 0,
    conferenceLosses: 0,
    conferenceTies: 0,
    overallWins: 0,
    overallLosses: 0,
    overallTies: 0,
    homeWins: 0,
    homeLosses: 0,
    homeTies: 0,
    awayWins: 0,
    awayLosses: 0,
    awayTies: 0,
    neutralWins: 0,
    neutralLosses: 0,
    neutralTies: 0,
    recentResults: [],
  };
}

function applyGameResult(record, scope, result) {
  if (scope === "conference") {
    if (result === "W") record.conferenceWins += 1;
    else if (result === "L") record.conferenceLosses += 1;
    else record.conferenceTies += 1;
    return;
  }
  if (scope === "overall") {
    if (result === "W") record.overallWins += 1;
    else if (result === "L") record.overallLosses += 1;
    else record.overallTies += 1;
    return;
  }
  if (scope === "home") {
    if (result === "W") record.homeWins += 1;
    else if (result === "L") record.homeLosses += 1;
    else record.homeTies += 1;
    return;
  }
  if (scope === "away") {
    if (result === "W") record.awayWins += 1;
    else if (result === "L") record.awayLosses += 1;
    else record.awayTies += 1;
    return;
  }
  if (scope === "neutral") {
    if (result === "W") record.neutralWins += 1;
    else if (result === "L") record.neutralLosses += 1;
    else record.neutralTies += 1;
  }
}

function finalizeComputedMacRecord(record, index) {
  const streakSource = [...record.recentResults].sort((left, right) => new Date(right.date) - new Date(left.date));
  let streakType = "";
  let streakCount = 0;
  for (const game of streakSource) {
    if (!streakType) {
      streakType = game.result;
      streakCount = 1;
      continue;
    }
    if (game.result !== streakType) {
      break;
    }
    streakCount += 1;
  }

  return {
    rank: index + 1,
    teamId: record.teamId,
    displayName: record.displayName,
    fullName: record.fullName,
    abbreviation: record.abbreviation,
    logo: record.logo,
    conferenceRecord: buildRecordString(record.conferenceWins, record.conferenceLosses, record.conferenceTies),
    conferencePct: buildPercentString(record.conferenceWins, record.conferenceLosses, record.conferenceTies),
    overallRecord: buildRecordString(record.overallWins, record.overallLosses, record.overallTies),
    overallPct: buildPercentString(record.overallWins, record.overallLosses, record.overallTies),
    homeRecord: buildRecordString(record.homeWins, record.homeLosses, record.homeTies),
    awayRecord: buildRecordString(record.awayWins, record.awayLosses, record.awayTies),
    neutralRecord: buildRecordString(record.neutralWins, record.neutralLosses, record.neutralTies),
    streak: streakType ? `${streakType}${streakCount}` : "--",
    overallPctValue:
      (record.overallWins + record.overallTies * 0.5) /
      Math.max(record.overallWins + record.overallLosses + record.overallTies, 1),
    conferencePctValue:
      (record.conferenceWins + record.conferenceTies * 0.5) /
      Math.max(record.conferenceWins + record.conferenceLosses + record.conferenceTies, 1),
  };
}

async function buildMacStandingsFromEspn() {
  const macTeams = await getMacEspnTeams();
  const macTeamIds = new Set(macTeams.map((team) => String(team.id)));
  const rows = await mapWithConcurrency(macTeams, 3, async (team) => {
    const schedule = await getEspnTeamSchedule(team.id);
    const events = (schedule.events || []).filter((event) => Number(event?.seasonType?.type) === 2);
    const record = createMacComputedRecord(team);

    for (const event of events) {
      const competition = event?.competitions?.[0];
      if (!competition?.status?.type?.completed) {
        continue;
      }
      const competitors = competition.competitors || [];
      const teamSide = competitors.find((entry) => String(entry?.team?.id || "") === String(team.id));
      const opponentSide = competitors.find((entry) => String(entry?.team?.id || "") !== String(team.id));
      if (!teamSide || !opponentSide) {
        continue;
      }

      const teamScore = Number(teamSide?.score?.value);
      const opponentScore = Number(opponentSide?.score?.value);
      if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
        continue;
      }

      const result = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T";
      applyGameResult(record, "overall", result);

      if (competition.neutralSite) {
        applyGameResult(record, "neutral", result);
      } else if (teamSide.homeAway === "home") {
        applyGameResult(record, "home", result);
      } else {
        applyGameResult(record, "away", result);
      }

      if (macTeamIds.has(String(opponentSide?.team?.id || ""))) {
        applyGameResult(record, "conference", result);
      }

      record.recentResults.push({
        date: event.date,
        result,
      });
    }

    return record;
  });

  return rows
    .map((record, index) => finalizeComputedMacRecord(record, index))
    .sort((left, right) => {
      if (right.conferencePctValue !== left.conferencePctValue) {
        return right.conferencePctValue - left.conferencePctValue;
      }
      if (right.overallPctValue !== left.overallPctValue) {
        return right.overallPctValue - left.overallPctValue;
      }
      return left.displayName.localeCompare(right.displayName);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function findBestEspnTeamForSchool(teams = [], school = {}) {
  const schoolKeys = getSchoolKeyVariants(school);
  let bestMatch = null;
  let bestScore = 0;

  for (const team of teams) {
    let score = 0;
    for (const schoolKey of schoolKeys) {
      for (const variant of team.variants || []) {
        if (!schoolKey || !variant) {
          continue;
        }
        if (variant === schoolKey) {
          score = Math.max(score, 10);
        } else if (variant.includes(schoolKey) || schoolKey.includes(variant)) {
          score = Math.max(score, 6);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = team;
    }
  }

  return bestScore >= 6 ? bestMatch : null;
}

async function getEspnConferenceGroups() {
  const cached = readObjectCache(espnConferenceGroupsCache);
  if (cached) {
    return cached;
  }

  const seasonYear = currentSeasonYear();
  const childrenPayload = await fetchJson(
    espnCoreUrl(`/seasons/${seasonYear}/types/1/groups/${ESPN_DIVISION_I_GROUP_ID}/children?lang=en&region=us`),
  );
  const groups = await mapWithConcurrency(childrenPayload.items || [], 4, async (item) => {
    const group = await fetchJson(normalizeEspnRef(item.$ref));
    return {
      id: String(group.id || ""),
      name: group.name || "",
      shortName: group.shortName || group.abbreviation || group.name || "",
      isConference: Boolean(group.isConference),
    };
  });

  return writeObjectCache(
    espnConferenceGroupsCache,
    groups.filter((group) => group.isConference && group.id),
    SCHOOLS_INDEX_CACHE_TTL_MS,
  );
}

function readEspnStandingStat(record = {}, statName = "") {
  return (record.stats || []).find((stat) => stat.name === statName) || null;
}

function normalizeEspnStandingEntry(entry, index, teamsById) {
  const teamId = extractEspnTeamId(entry?.team?.$ref);
  const team = teamsById?.[teamId] || {};
  const record = entry?.records || {};
  const gamesBehind = readEspnStandingStat(record, "gamesBehind");
  const streak = readEspnStandingStat(record, "streak");
  const leagueWinPercent = readEspnStandingStat(record, "leagueWinPercent");
  const runDifferential = readEspnStandingStat(record, "pointDifferential");

  return {
    rank: index + 1,
    teamId,
    displayName: team.shortDisplayName || team.displayName || team.location || teamId,
    fullName: team.displayName || team.shortDisplayName || teamId,
    abbreviation: team.abbreviation || "",
    logo: team.logo || "",
    overallRecord: record.summary || record.displayValue || "",
    leagueWinPct: leagueWinPercent?.displayValue || "",
    gamesBack: gamesBehind?.displayValue || "-",
    streak: streak?.displayValue || "",
    runDifferential: runDifferential?.displayValue || "",
  };
}

async function getEspnConferenceStandings(groupId, teamsById) {
  const cacheKey = String(groupId || "");
  const cached = readTimedCache(espnConferenceStandingsCache, cacheKey);
  if (cached) {
    return cached;
  }

  const seasonYear = currentSeasonYear();
  const payload = await fetchJson(
    espnCoreUrl(`/seasons/${seasonYear}/types/2/groups/${cacheKey}/standings/0?lang=en&region=us`),
  );
  const standings = (payload.standings || []).map((entry, index) => normalizeEspnStandingEntry(entry, index, teamsById));
  return writeTimedCache(espnConferenceStandingsCache, cacheKey, standings);
}

async function getSchoolConferenceStandings(env, schoolSlug) {
  const cacheKey = normalizeSlug(schoolSlug);
  const cached = readTimedCache(schoolConferenceStandingsCache, cacheKey);
  if (cached) {
    return cached;
  }

  const macPayload = await getMacConferenceStandings(env, schoolSlug);
  if (macPayload?.available) {
    return writeTimedCache(schoolConferenceStandingsCache, cacheKey, macPayload, MAC_STANDINGS_CACHE_TTL_MS);
  }

  const school = await getSchoolIdentity(env, schoolSlug);
  if (!school) {
    return null;
  }

  const { teams, byId } = await getEspnTeamsDirectory();
  const matchedTeam = findBestEspnTeamForSchool(teams, school);
  if (!matchedTeam) {
    return writeTimedCache(schoolConferenceStandingsCache, cacheKey, {
      available: false,
      source: "ESPN core standings",
      format: "unavailable",
      school,
      conference: null,
      table: [],
      schoolEntry: null,
      note: "No ESPN college baseball team mapping was found for this school.",
    });
  }

  const conferenceGroups = await getEspnConferenceGroups();
  const standingsGroups = await mapWithConcurrency(conferenceGroups, 3, async (group) => ({
    ...group,
    table: await getEspnConferenceStandings(group.id, byId),
  }));

  const matchedGroup =
    standingsGroups.find((group) => group.table.some((entry) => entry.teamId === matchedTeam.id)) || null;

  if (!matchedGroup) {
    return writeTimedCache(schoolConferenceStandingsCache, cacheKey, {
      available: false,
      source: "ESPN core standings",
      format: "unavailable",
      school,
      espnTeam: matchedTeam,
      conference: null,
      table: [],
      schoolEntry: null,
      note:
        `${school.name || school.slug} does not appear in ESPN's current college baseball conference standings feed. This usually means the program is outside a conference table in this source.`,
    });
  }

  const schoolEntry = matchedGroup.table.find((entry) => entry.teamId === matchedTeam.id) || null;
  return writeTimedCache(schoolConferenceStandingsCache, cacheKey, {
    available: true,
    source: "ESPN core standings",
    format: "espn",
    school,
    espnTeam: matchedTeam,
    conference: {
      id: matchedGroup.id,
      name: matchedGroup.name,
      shortName: matchedGroup.shortName,
    },
    schoolEntry,
    table: matchedGroup.table,
    note:
      "ESPN college baseball standings expose overall record, league win percentage, games back, streak, and run differential. The feed does not currently return a clean conference W-L column here.",
  });
}

function schoolMatchesQuery(school, query) {
  const normalizedQuery = normalizeSlug(query);
  const haystack = [school.slug, school.name, school.long].map(normalizeSlug).join(" ");
  return haystack.includes(normalizedQuery);
}

function featuredSchoolsFromGames(games, limit) {
  const seen = new Set();
  const schools = [];

  for (const game of games) {
    for (const side of [game.away, game.home]) {
      const slug = normalizeSlug(side.seo);
      if (!slug || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      schools.push(
        normalizeSchool(
          {
            slug,
            name: side.short || slug,
            long: side.full || side.short || slug,
          },
          {
            slug,
            name: side.short || slug,
            long: side.short || slug,
          },
        ),
      );
      if (schools.length >= limit) {
        return schools;
      }
    }
  }

  return schools;
}

async function getScoreboardForDate(env, date) {
  const cached = readTimedCache(scoreboardDateCache, date);
  if (cached) {
    return cached;
  }
  const scoreboard = await fetchJson(`${baseUrl(env)}/scoreboard/baseball/d1/${date}/all-conf`);
  return writeTimedCache(scoreboardDateCache, date, scoreboard);
}

async function getNormalizedScoreboard(env, date) {
  if (date) {
    const scoreboard = await getScoreboardForDate(env, date);
    return {
      source: "dated-scoreboard",
      updatedAt: scoreboard.updated_at || null,
      date,
      games: (scoreboard.games || []).map((entry) => mapScoreboardGame(entry, date, 0)),
    };
  }

  const resolvedDate = formatEtDate(new Date());
  try {
    const scoreboard = await getScoreboardForDate(env, resolvedDate);
    return {
      source: "dated-scoreboard",
      updatedAt: scoreboard.updated_at || null,
      date: resolvedDate,
      games: (scoreboard.games || []).map((entry) => mapScoreboardGame(entry, resolvedDate, 0)),
    };
  } catch {
    const scoreboard = await fetchJson(`${baseUrl(env)}/scoreboard/baseball/d1`);
    return {
      source: "default-scoreboard",
      updatedAt: scoreboard.updated_at || null,
      date: resolvedDate,
      games: (scoreboard.games || []).map((entry) => mapScoreboardGame(entry, resolvedDate, 0)),
    };
  }
}

async function getSchoolGamesWindow(env, schoolSlug, options = {}) {
  const lookbackDays = options.lookbackDays ?? RECENT_LOOKBACK_DAYS;
  const lookaheadDays = options.lookaheadDays ?? UPCOMING_LOOKAHEAD_DAYS;
  const cacheKey = `${normalizeSlug(schoolSlug)}|${lookbackDays}|${lookaheadDays}`;
  const cached = readTimedCache(schoolGamesWindowCache, cacheKey);
  if (cached) {
    return cached;
  }
  const today = new Date();
  const dateRequests = [];

  for (let offset = -lookbackDays; offset <= lookaheadDays; offset += 1) {
    const date = formatEtDate(shiftDate(today, offset));
    dateRequests.push({ date, offset });
  }

  const allGames = [];
  const errors = [];

  for (const { date, offset } of dateRequests) {
    try {
      const scoreboard = await getScoreboardForDate(env, date);
      const games = (scoreboard.games || [])
        .map((entry) => mapScoreboardGame(entry, date, offset))
        .filter((game) => matchesSchoolSide(game.home, schoolSlug) || matchesSchoolSide(game.away, schoolSlug))
        .map((game) => schoolViewFromGame(game, schoolSlug));

      allGames.push(...games);
    } catch (error) {
      errors.push({
        date,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  allGames.sort(sortGames);

  const recentGames = allGames.filter((game) => game.windowBucket === "recent");
  const upcomingGames = allGames.filter((game) => game.windowBucket === "upcoming");
  const latestResult =
    [...recentGames].reverse().find((game) => game.gameState === "final") || recentGames[recentGames.length - 1] || null;
  const nextGame = upcomingGames.find((game) => game.gameState !== "final") || upcomingGames[0] || null;

  return writeTimedCache(schoolGamesWindowCache, cacheKey, {
    generatedAt: new Date().toISOString(),
    windowStart: dateRequests[0]?.date || null,
    windowEnd: dateRequests[dateRequests.length - 1]?.date || null,
    recentGames,
    upcomingGames,
    latestResult,
    nextGame,
    errors,
  });
}

async function getNormalizedBoxscore(env, gameId) {
  const cacheKey = String(gameId);
  const cached = readTimedCache(normalizedBoxscoreCache, cacheKey);
  if (cached) {
    return cached;
  }
  const boxscore = await fetchJson(`${baseUrl(env)}/game/${gameId}/boxscore`);
  return writeTimedCache(normalizedBoxscoreCache, cacheKey, normalizeBoxscore(boxscore));
}

async function getNormalizedPlayByPlay(env, gameId) {
  const cacheKey = String(gameId);
  const cached = readTimedCache(normalizedPlayByPlayCache, cacheKey);
  if (cached) {
    return cached;
  }
  const playByPlay = await fetchJson(`${baseUrl(env)}/game/${gameId}/play-by-play`);
  return writeTimedCache(normalizedPlayByPlayCache, cacheKey, normalizePlayByPlay(playByPlay));
}

async function getGameSummary(env, gameId) {
  const cacheKey = String(gameId);
  const cached = readTimedCache(gameSummaryCache, cacheKey);
  if (cached) {
    return cached;
  }
  const payload = await fetchJson(`${baseUrl(env)}/game/${gameId}`);
  const summary = normalizeGameSummaryPayload(payload);
  if (!summary) {
    throw new Error("Game summary was empty");
  }
  return writeTimedCache(gameSummaryCache, cacheKey, summary);
}

async function getGameLiveSummary(env, gameId) {
  const cacheKey = String(gameId);
  const cached = readTimedCache(gameLiveSummaryCache, cacheKey);
  if (cached) {
    return cached;
  }
  const summary = await getGameSummary(env, gameId);
  let boxscore = null;
  let analysis = null;

  if (summary.hasBoxscore) {
    try {
      boxscore = await getNormalizedBoxscore(env, gameId);
    } catch (error) {
      boxscore = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (summary.hasPbp) {
    try {
      const playByPlay = await getNormalizedPlayByPlay(env, gameId);
      analysis = buildGameAnalysis(summary, boxscore?.error ? null : boxscore, playByPlay);
    } catch (error) {
      analysis = {
        available: false,
        note: error instanceof Error ? error.message : String(error),
        totalEvents: 0,
        scoringPlays: 0,
        leadChanges: 0,
        periodsTracked: 0,
        busiestPeriod: null,
        insights: [],
        topPlayers: [],
        scoringTimeline: [],
        teamSummaries: buildGameAnalysis(summary, boxscore?.error ? null : boxscore, null).teamSummaries,
      };
    }
  } else {
    analysis = buildGameAnalysis(summary, boxscore?.error ? null : boxscore, null);
  }

  return writeTimedCache(gameLiveSummaryCache, cacheKey, {
    summary,
    boxscore,
    analysis,
  });
}

async function getLatestSchoolBoxscoreDetails(env, schoolSlug, recentWindow) {
  const recentGames = recentWindow?.recentGames || [];
  let sourceGame =
    [...recentGames].reverse().find((game) => game.gameState === "final") ||
    [...recentGames].reverse().find(Boolean) ||
    null;

  let mode = "recent-final";
  if (!sourceGame) {
    const fallbackWindow = await getSchoolGamesWindow(env, schoolSlug, {
      lookbackDays: BOX_SCORE_LOOKBACK_DAYS,
      lookaheadDays: 0,
    });

    sourceGame =
      [...(fallbackWindow.recentGames || [])].reverse().find((game) => game.gameState === "final") ||
      [...(fallbackWindow.recentGames || [])].reverse().find(Boolean) ||
      null;
    mode = "fallback-window";
  }

  if (!sourceGame) {
    return null;
  }

  const normalized = await getNormalizedBoxscore(env, sourceGame.gameId);
  const schoolTeam = findTeamBySlug(normalized.teams, schoolSlug);
  const opponent = normalized.teams.find((team) => team !== schoolTeam) || null;

  return {
    normalized,
    contestId: normalized.contestId,
    description: normalized.description,
    status: normalized.status,
    period: normalized.period,
    divisionName: normalized.divisionName,
    sportCode: normalized.sportCode,
    mode,
    modeLabel:
      mode === "recent-final"
        ? "Latest recent final"
        : "Older recent final used because no final existed in the default window",
    sourceGame,
    schoolTeam,
    opponent,
  };
}

async function getLatestSchoolBoxscore(env, schoolSlug, recentWindow) {
  const details = await getLatestSchoolBoxscoreDetails(env, schoolSlug, recentWindow);
  if (!details) {
    return null;
  }

  return {
    contestId: details.contestId,
    description: details.description,
    status: details.status,
    period: details.period,
    divisionName: details.divisionName,
    sportCode: details.sportCode,
    mode: details.mode,
    modeLabel: details.modeLabel,
    sourceGame: details.sourceGame,
    schoolTeam: summarizeLiveTeam(details.schoolTeam),
    opponent: summarizeLiveTeam(details.opponent),
  };
}

async function getSchoolPlayerBoard(env, schoolSlug) {
  const school = await getSchoolIdentity(env, schoolSlug);
  if (!school) {
    return null;
  }

  const gamesWindow = await getSchoolGamesWindow(env, school.slug);
  const latestBoxscore = await getLatestSchoolBoxscoreDetails(env, school.slug, gamesWindow);
  if (!latestBoxscore || !latestBoxscore.schoolTeam) {
    return {
      source: "NCAA wrapper latest school boxscore",
      school,
      generatedAt: new Date().toISOString(),
      sourceGame: null,
      mode: "none",
      modeLabel: "No recent final available",
      opponent: null,
      playerCount: 0,
      roleCounts: { Hitter: 0, Pitcher: 0 },
      teamStats: {
        batterTotals: null,
        pitcherTotals: null,
      },
      note: "No recent final with boxscore data was found for this school in the current search window.",
      players: [],
    };
  }

  let latestGameSummary = null;
  try {
    latestGameSummary = await getGameLiveSummary(env, latestBoxscore.sourceGame.gameId);
  } catch {
    latestGameSummary = null;
  }

  let recentForm = null;
  try {
    recentForm = await getSchoolRecentForm(env, school.slug, {
      school,
      recentWindow: gamesWindow,
      gameCount: RECENT_FORM_DEFAULT_GAMES,
    });
  } catch {
    recentForm = null;
  }

  const latestGamePerspective = latestGameSummary
    ? summarizeSchoolGamePerspective(latestBoxscore.sourceGame, school.slug, latestGameSummary)
    : null;
  const latestImpactMap = buildLatestGameImpactMap(latestGamePerspective);
  const recentTrendMap = buildRecentTrendMap(recentForm);

  const boardPlayers = buildPlayerBoardPlayers(latestBoxscore.schoolTeam, {
    school,
    sourceGame: latestBoxscore.sourceGame,
    modeLabel: latestBoxscore.modeLabel,
  });

  const enrichedPlayers = boardPlayers.players.map((player) => {
    const playerKey = slugifyKey(player.name || "player");
    const latestGameImpact = latestImpactMap.get(playerKey) || null;
    const recentTrend = recentTrendMap.get(playerKey) || null;
    const detailBadges = [...(player.detailBadges || [])];

    if (latestGameImpact?.impactScore) {
      detailBadges.push(`Latest impact ${latestGameImpact.impactScore}`);
    }
    if (recentTrend?.gamesTracked) {
      detailBadges.push(`${recentTrend.gamesTracked} recent tracked games`);
    }

    return {
      ...player,
      detailBadges,
      latestGameImpact,
      recentTrend,
    };
  });

  return {
    source: "NCAA wrapper live school board",
    school,
    generatedAt: new Date().toISOString(),
    sourceGame: latestBoxscore.sourceGame,
    mode: latestBoxscore.mode,
    modeLabel: latestBoxscore.modeLabel,
    schoolTeam: summarizeLiveTeam(latestBoxscore.schoolTeam),
    opponent: summarizeLiveTeam(latestBoxscore.opponent),
    playerCount: enrichedPlayers.length,
    roleCounts: boardPlayers.roleCounts,
    teamStats: {
      batterTotals: latestBoxscore.schoolTeam.teamStats?.batterTotals || null,
      pitcherTotals: latestBoxscore.schoolTeam.teamStats?.pitcherTotals || null,
    },
    latestGameAnalysis: latestGameSummary?.analysis || null,
    recentForm,
    note:
      "This board scores the latest available boxscore and layers in play-by-play impact from the latest final plus recent-form context across multiple recent games.",
    players: enrichedPlayers,
  };
}

async function searchSchools(env, query, limit) {
  const normalizedQuery = normalizeSlug(query);
  if (!normalizedQuery) {
    const scoreboard = await getNormalizedScoreboard(env);
    return featuredSchoolsFromGames(scoreboard.games, limit);
  }

  const schools = await getSchoolsIndex(env);
  return schools
    .map((school) => normalizeSchool(school))
    .filter((school) => schoolMatchesQuery(school, normalizedQuery))
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, limit);
}

async function getSchoolLiveSummary(env, schoolSlug) {
  const school = await getSchoolIdentity(env, schoolSlug);
  if (!school) {
    return null;
  }

  const gamesWindow = await getSchoolGamesWindow(env, school.slug, {
    lookbackDays: Math.max(RECENT_LOOKBACK_DAYS, RECENT_FORM_LOOKBACK_DAYS),
    lookaheadDays: UPCOMING_LOOKAHEAD_DAYS,
  });
  const latestBoxscore = await getLatestSchoolBoxscore(env, school.slug, gamesWindow);
  let recentForm = null;

  try {
    recentForm = await getSchoolRecentForm(env, school.slug, {
      school,
      recentWindow: gamesWindow,
      gameCount: RECENT_FORM_DEFAULT_GAMES,
    });
  } catch (error) {
    recentForm = createEmptyRecentForm(
      school,
      RECENT_FORM_DEFAULT_GAMES,
      error instanceof Error ? error.message : String(error),
    );
  }

  return {
    source: "NCAA wrapper",
    school,
    generatedAt: new Date().toISOString(),
    recentGames: gamesWindow.recentGames,
    upcomingGames: gamesWindow.upcomingGames,
    latestResult: gamesWindow.latestResult,
    nextGame: gamesWindow.nextGame,
    windowStart: gamesWindow.windowStart,
    windowEnd: gamesWindow.windowEnd,
    windowErrors: gamesWindow.errors,
    latestBoxscore,
    recentForm,
    coverage: buildCoverage(latestBoxscore, school.name),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({
          ok: true,
          service: "toledo-baseball-api",
          date: new Date().toISOString(),
        });
      }

      if (url.pathname === "/api/meta/sources") {
        return json({
          defaultSchool: DEFAULT_SCHOOL_NAME,
          playerSnapshots: {
            sourceBaseUrl: getPlayerSnapshotBaseUrl(env),
            refreshCadence: "Daily scheduled GitHub refresh plus manual workflow dispatch.",
            apiCacheTtlMinutes: Math.round(PLAYER_UNIVERSE_CACHE_TTL_MS / 60000),
          },
          sources: [
            {
              name: "NCAA wrapper",
              role: "Primary starting source",
              notes: "Verified for school identity, live scoreboard data, game detail, player names, boxscores, and play-by-play.",
            },
            {
              name: "BALLDONTLIE CBB",
              role: "Optional richer structured source",
              notes: "Useful if we later want a cleaner paid contract for teams, players, season stats, standings, and rankings.",
            },
          ],
          nextEndpoints: [
            "/api/players",
            "/api/players/:id",
            "/api/players/coverage",
            "/api/schools?query=",
            "/api/schools/:slug/live-summary",
            "/api/schools/:slug/standings",
            "/api/schools/:slug/opponent-scout",
            "/api/schools/:slug/recent-form",
            "/api/schools/:slug/player-board",
            "/api/players/national-board",
            "/api/scoreboard/baseball/d1/live",
            "/api/games/:id/live-summary",
            "/api/games/:id/analysis",
          ],
        });
      }

      if (url.pathname === "/api/baseball/positions") {
        return json({
          summary: "Baseball has many field positions, but the first modeling split should be hitters versus pitchers.",
          positions,
        });
      }

      if (url.pathname === "/api/demo/players") {
        return json({
          school: DEFAULT_SCHOOL_NAME,
          source: "seeded-demo",
          data: demoPlayers,
        });
      }

      if (url.pathname === "/api/players/national-board") {
        const payload = await getNationalPlayerBoard(env);
        return json(payload);
      }

      if (url.pathname === "/api/players/coverage") {
        const universe = await getStoredPlayerUniverse(env, { requestUrl: request.url });
        return json({
          source: universe.source,
          generatedAt: universe.generatedAt,
          dataGeneratedAt: universe.dataGeneratedAt || universe.generatedAt,
          rebuiltAt: universe.rebuiltAt || universe.generatedAt,
          boardCoverage: universe.boardCoverage,
          note: universe.note,
          snapshotSource: universe.snapshotSource || "",
          sourceSnapshots: universe.sourceSnapshots || [],
          data: universe.schoolCoverage,
        });
      }

      if (url.pathname === "/api/players") {
        const universe = await getStoredPlayerUniverse(env, { requestUrl: request.url });
        const payload = queryPlayerUniverse(universe, {
          query: url.searchParams.get("query") || "",
          role: url.searchParams.get("role") || "All",
          position: url.searchParams.get("position") || "",
          sort: url.searchParams.get("sort") || "score",
          page: readInt(url.searchParams.get("page"), 1, 1, 100000),
          pageSize: readInt(url.searchParams.get("pageSize"), 40, 10, 100),
        });
        return json(payload);
      }

      const playerMatch = url.pathname.match(/^\/api\/players\/([^/]+)$/);
      if (playerMatch) {
        const playerId = decodeURIComponent(playerMatch[1]);
        const universe = await getStoredPlayerUniverse(env, { requestUrl: request.url });
        const player = getUniversePlayerById(universe, playerId);
        if (!player) {
          return notFound(`Player "${playerId}" was not found in the stored player universe.`);
        }
        return json({
          source: universe.source,
          generatedAt: universe.generatedAt,
          dataGeneratedAt: universe.dataGeneratedAt || universe.generatedAt,
          rebuiltAt: universe.rebuiltAt || universe.generatedAt,
          boardCoverage: universe.boardCoverage,
          note: universe.note,
          snapshotSource: universe.snapshotSource || "",
          sourceSnapshots: universe.sourceSnapshots || [],
          data: player,
        });
      }

      if (url.pathname === "/api/schools") {
        const query = url.searchParams.get("query") || "";
        const limit = readInt(url.searchParams.get("limit"), SCHOOL_SEARCH_LIMIT, 1, 50);
        const data = await searchSchools(env, query, limit);
        return json({
          source: "NCAA school index",
          query,
          data,
        });
      }

      const schoolMatch = url.pathname.match(/^\/api\/schools\/([^/]+)$/);
      if (schoolMatch) {
        const schoolSlug = decodeURIComponent(schoolMatch[1]);
        const school = await getSchoolIdentity(env, schoolSlug);
        if (!school) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json({
          source: "NCAA wrapper school index",
          school,
        });
      }

      const schoolSummaryMatch = url.pathname.match(/^\/api\/schools\/([^/]+)\/live-summary$/);
      if (schoolSummaryMatch) {
        const schoolSlug = decodeURIComponent(schoolSummaryMatch[1]);
        const summary = await getSchoolLiveSummary(env, schoolSlug);
        if (!summary) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json(summary);
      }

      const schoolStandingsMatch = url.pathname.match(/^\/api\/schools\/([^/]+)\/standings$/);
      if (schoolStandingsMatch) {
        const schoolSlug = decodeURIComponent(schoolStandingsMatch[1]);
        const standings = await getSchoolConferenceStandings(env, schoolSlug);
        if (!standings) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json(standings);
      }

      const schoolRecentFormMatch = url.pathname.match(/^\/api\/schools\/([^/]+)\/recent-form$/);
      if (schoolRecentFormMatch) {
        const schoolSlug = decodeURIComponent(schoolRecentFormMatch[1]);
        const gameCount = readInt(url.searchParams.get("games"), RECENT_FORM_DEFAULT_GAMES, 1, 10);
        const recentForm = await getSchoolRecentForm(env, schoolSlug, { gameCount });
        if (!recentForm) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json(recentForm);
      }

      const schoolOpponentScoutMatch = url.pathname.match(/^\/api\/schools\/([^/]+)\/opponent-scout$/);
      if (schoolOpponentScoutMatch) {
        const schoolSlug = decodeURIComponent(schoolOpponentScoutMatch[1]);
        const scout = await getSchoolOpponentScout(env, schoolSlug, {
          gameCount: readInt(url.searchParams.get("games"), OPPONENT_SCOUT_DEFAULT_GAMES, 1, 5),
          lookbackDays: readInt(url.searchParams.get("lookback"), OPPONENT_SCOUT_LOOKBACK_DAYS, 3, 14),
        });
        if (!scout) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json(scout);
      }

      const schoolPlayerBoardMatch = url.pathname.match(/^\/api\/schools\/([^/]+)\/player-board$/);
      if (schoolPlayerBoardMatch) {
        const schoolSlug = decodeURIComponent(schoolPlayerBoardMatch[1]);
        const board = await getSchoolPlayerBoard(env, schoolSlug);
        if (!board) {
          return notFound(`School "${schoolSlug}" was not found in the NCAA school index.`);
        }
        return json(board);
      }

      if (url.pathname === "/api/toledo/live-summary") {
        const summary = await getSchoolLiveSummary(env, DEFAULT_SCHOOL_SLUG);
        if (!summary) {
          return notFound("Toledo was not found in the NCAA school index.");
        }
        return json(summary);
      }

      if (url.pathname === "/api/toledo/recent-form") {
        const gameCount = readInt(url.searchParams.get("games"), RECENT_FORM_DEFAULT_GAMES, 1, 10);
        const recentForm = await getSchoolRecentForm(env, DEFAULT_SCHOOL_SLUG, { gameCount });
        if (!recentForm) {
          return notFound("Toledo was not found in the NCAA school index.");
        }
        return json(recentForm);
      }

      if (url.pathname === "/api/toledo/recent-games") {
        const lookbackDays = readInt(url.searchParams.get("lookback"), RECENT_LOOKBACK_DAYS, 0, 21);
        const lookaheadDays = readInt(url.searchParams.get("lookahead"), UPCOMING_LOOKAHEAD_DAYS, 0, 21);
        const window = await getSchoolGamesWindow(env, DEFAULT_SCHOOL_SLUG, { lookbackDays, lookaheadDays });
        return json({
          source: "NCAA wrapper scoreboard date windows",
          school: DEFAULT_SCHOOL_NAME,
          ...window,
        });
      }

      if (url.pathname === "/api/scoreboard/baseball/d1") {
        const scoreboard = await getNormalizedScoreboard(env);
        return json({
          source: "NCAA wrapper scoreboard",
          data: scoreboard,
        });
      }

      if (url.pathname === "/api/scoreboard/baseball/d1/live") {
        const date = url.searchParams.get("date") || formatEtDate(new Date());
        const limit = readInt(url.searchParams.get("limit"), LIVE_SCOREBOARD_LIMIT, 1, 50);
        const scoreboard = await getNormalizedScoreboard(env, date);
        return json({
          source: "NCAA wrapper scoreboard",
          date: scoreboard.date,
          updatedAt: scoreboard.updatedAt,
          data: scoreboard.games.slice(0, limit),
        });
      }

      const gameSummaryMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/summary$/);
      if (gameSummaryMatch) {
        const gameId = decodeURIComponent(gameSummaryMatch[1]);
        const summary = await getGameSummary(env, gameId);
        return json({
          source: "NCAA wrapper game summary",
          gameId,
          data: summary,
        });
      }

      const gameLiveSummaryMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/live-summary$/);
      if (gameLiveSummaryMatch) {
        const gameId = decodeURIComponent(gameLiveSummaryMatch[1]);
        const data = await getGameLiveSummary(env, gameId);
        return json({
          source: "NCAA wrapper game detail",
          gameId,
          data,
        });
      }

      const gameAnalysisMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/analysis$/);
      if (gameAnalysisMatch) {
        const gameId = decodeURIComponent(gameAnalysisMatch[1]);
        const data = await getGameLiveSummary(env, gameId);
        return json({
          source: "NCAA wrapper derived game analysis",
          gameId,
          data: {
            summary: data.summary,
            analysis: data.analysis,
          },
        });
      }

      const boxscoreMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/boxscore$/);
      if (boxscoreMatch) {
        const gameId = decodeURIComponent(boxscoreMatch[1]);
        const boxscore = await getNormalizedBoxscore(env, gameId);
        return json({
          source: "NCAA wrapper game boxscore",
          gameId,
          data: boxscore,
        });
      }

      const playByPlayMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/play-by-play$/);
      if (playByPlayMatch) {
        const gameId = decodeURIComponent(playByPlayMatch[1]);
        const data = await fetchJson(`${baseUrl(env)}/game/${gameId}/play-by-play`);
        return json({
          source: "NCAA wrapper play-by-play",
          gameId,
          data,
        });
      }

      return notFound();
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : String(error),
          path: url.pathname,
        },
        { status: 502 },
      );
    }
  },
};
