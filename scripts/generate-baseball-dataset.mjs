import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

const TEAM_PRESETS = {
  toledo: {
    key: "toledo",
    season: 2026,
    schoolSlug: "toledo",
    schoolName: "Toledo",
    schoolLongName: "University of Toledo",
    schoolSiteBase: "https://utrockets.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "445",
  },
  "wake-forest": {
    key: "wake-forest",
    season: 2026,
    schoolSlug: "wake-forest",
    schoolName: "Wake Forest",
    schoolLongName: "Wake Forest University",
    schoolSiteBase: "https://godeacs.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "97",
  },
  tcu: {
    key: "tcu",
    season: 2026,
    schoolSlug: "tcu",
    schoolName: "TCU",
    schoolLongName: "Texas Christian University",
    schoolSiteBase: "https://gofrogs.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "198",
  },
  houston: {
    key: "houston",
    season: 2026,
    schoolSlug: "houston",
    schoolName: "Houston",
    schoolLongName: "University of Houston",
    schoolSiteBase: "https://uhcougars.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "124",
  },
  "middle-tennessee": {
    key: "middle-tennessee",
    season: 2026,
    schoolSlug: "middle-tenn",
    schoolName: "Middle Tennessee",
    schoolLongName: "Middle Tennessee State University",
    schoolSiteBase: "https://goblueraiders.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "177",
  },
  missouri: {
    key: "missouri",
    season: 2026,
    schoolSlug: "missouri",
    schoolName: "Missouri",
    schoolLongName: "University of Missouri",
    schoolSiteBase: "https://mutigers.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "91",
  },
  "sam-houston": {
    key: "sam-houston",
    season: 2026,
    schoolSlug: "sam-houston-st",
    schoolName: "Sam Houston",
    schoolLongName: "Sam Houston State University",
    schoolSiteBase: "https://gobearkats.com",
    rosterPath: "/sports/baseball/roster",
    statsPath: "/sports/baseball/stats/2026",
    espnTeamId: "190",
  },
};

function parseArgs(argv) {
  const options = {
    team: "toledo",
    season: 2026,
    output: "",
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
  }

  return options;
}

function resolveTeamConfig(options) {
  const requestedTeam = String(options.team || "").toLowerCase();
  if (requestedTeam === "all" || requestedTeam === "sidearm-pool") {
    return {
      mode: "all",
      season: options.season || 2026,
      outputPath:
        options.output ||
        path.join(REPO_ROOT, "data", "generated", `sidearm-pool-baseball-${options.season || 2026}.json`),
      teamConfigs: Object.values(TEAM_PRESETS).map((preset) => {
        const season = options.season || preset.season;
        return {
          ...preset,
          season,
          statsPath: `/sports/baseball/stats/${season}`,
          outputPath: path.join(REPO_ROOT, "data", "generated", `${preset.schoolSlug}-baseball-${season}.json`),
        };
      }),
    };
  }

  const preset = TEAM_PRESETS[requestedTeam];

  if (!preset) {
    throw new Error(`Unknown team preset "${options.team}". Add it to TEAM_PRESETS before running this script.`);
  }

  const season = options.season || preset.season;
  return {
    mode: "single",
    ...preset,
    season,
    statsPath: `/sports/baseball/stats/${season}`,
    outputPath:
      options.output ||
      path.join(REPO_ROOT, "data", "generated", `${preset.schoolSlug}-baseball-${season}.json`),
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 baseball-dashboard/1.0",
      accept: "application/json,text/plain,*/*",
      "accept-encoding": "identity",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json();
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

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function commaNameToDisplay(value = "") {
  const raw = normalizeWhitespace(value);
  if (!raw.includes(",")) {
    return raw;
  }

  const [lastName, firstName] = raw.split(",").map((part) => normalizeWhitespace(part));
  return normalizeWhitespace(`${firstName} ${lastName}`);
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

function parseNumeric(value, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--") {
    return fallback;
  }

  const parsed = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value, fallback = 0) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "--") {
    return fallback;
  }

  const parsed = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInningsPitched(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }

  const [wholeRaw, outsRaw = "0"] = raw.split(".");
  const whole = Number.parseInt(wholeRaw, 10);
  const outs = Number.parseInt(outsRaw, 10);

  if (!Number.isFinite(whole)) {
    return 0;
  }

  const cleanOuts = Number.isFinite(outs) ? Math.max(0, Math.min(2, outs)) : 0;
  return whole + cleanOuts / 3;
}

function roundTo(value, decimals = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function safeRatio(a, b, fallback = 0) {
  return !Number.isFinite(a) || !Number.isFinite(b) || b === 0 ? fallback : a / b;
}

function fitLabel(score) {
  if (score >= 80) {
    return { label: "Priority", className: "fit-priority" };
  }
  if (score >= 68) {
    return { label: "Pursue", className: "fit-pursue" };
  }
  if (score >= 55) {
    return { label: "Monitor", className: "fit-monitor" };
  }
  return { label: "Depth", className: "fit-depth" };
}

function formatAverage(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(3).replace(/^0(?=\.)/, "");
}

function formatMaybeNumber(value, decimals = 1) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "--";
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
  return map[raw] || raw || "N/A";
}

function buildHandedness(rosterPlayer, espnAthlete) {
  const rosterHandedness = normalizeWhitespace(rosterPlayer?.batsThrows);
  if (rosterHandedness) {
    return rosterHandedness;
  }

  const bat = normalizeWhitespace(espnAthlete?.bats?.abbreviation);
  const arm = normalizeWhitespace(espnAthlete?.throws?.abbreviation);

  if (bat || arm) {
    return `${bat || "?"}/${arm || "?"}`;
  }

  return "N/A";
}

function buildEspnPlayerIndex(athletes) {
  const byName = new Map();

  for (const athlete of athletes) {
    byName.set(normalizeName(athlete.fullName), athlete);
  }

  return byName;
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
      playerId: normalizeWhitespace(player.playerId),
      name: displayName,
      normalizedName: normalizeName(displayName),
      firstName: normalizeWhitespace(player.firstName),
      lastName: normalizeWhitespace(player.lastName),
      jersey: normalizeWhitespace(player.jerseyNumber),
      classYear: normalizeClassYear(player.academicYearShort || player.academicYearLong),
      position: normalizeWhitespace(player.positionShort),
      positionLong: normalizeWhitespace(player.positionLong),
      hometown: normalizeWhitespace(player.hometown),
      highSchool: normalizeWhitespace(player.highSchool),
      previousSchool: normalizeWhitespace(player.previousSchool),
      hometownHighSchool: normalizeWhitespace([player.hometown, player.highSchool].filter(Boolean).join(" / ")),
      batsThrows: normalizeWhitespace(player.custom1),
      imageUrl: normalizeWhitespace(player.image?.absoluteUrl || player.image?.url),
      profileUrl: rosterPath ? new URL(rosterPath, config.schoolSiteBase).toString() : "",
      source: `${config.schoolName} Athletics roster`,
    };
  });

  return {
    title: normalizeWhitespace(roster.displayTitle),
    rosterUrl: new URL(config.rosterPath, config.schoolSiteBase).toString(),
    players,
  };
}

function filterStatRows(rows = []) {
  return rows.filter((row) => !row?.isAFooterStat && normalizeWhitespace(row?.playerName));
}

function parseSidearmStatsPage(html, config) {
  const payload = hydrateNuxtPayload(extractNuxtPayload(html));
  const cumulative = Object.values(payload?.pinia?.statsSeason?.cumulativeStats || {})[0];

  if (!cumulative) {
    throw new Error(`No cumulative stats payload was found on ${config.schoolName}'s public stats page.`);
  }

  const individualStats = cumulative?.overallIndividualStats?.individualStats || {};
  const teamTotals = cumulative?.gameByGameStats?.ourGameByGameStats?.find((game) => game?.isAFooterStat) || null;

  const hitting = filterStatRows(individualStats.individualHittingStats).map((row) => ({
    rosterBioId: normalizeWhitespace(row.playerRosterBioId),
    name: commaNameToDisplay(row.playerName || row.nameFromStats),
    normalizedName: normalizeName(commaNameToDisplay(row.playerName || row.nameFromStats)),
    jersey: normalizeWhitespace(row.playerUniform),
    profileUrl: row.playerUrl ? new URL(row.playerUrl, config.schoolSiteBase).toString() : "",
    imageUrl: normalizeWhitespace(row.playerImageUrl ? new URL(row.playerImageUrl, config.schoolSiteBase).toString() : ""),
    gamesPlayed: parseInteger(row.gamesPlayed),
    gamesStarted: parseInteger(row.gamesStarted),
    battingAverage: parseNumeric(row.battingAverage, NaN),
    onBasePercentage: parseNumeric(row.onBasePercentage, NaN),
    sluggingPercentage: parseNumeric(row.sluggingPercentage, NaN),
    ops: parseNumeric(row.ops, NaN),
    atBats: parseInteger(row.atBats),
    runs: parseInteger(row.runs),
    hits: parseInteger(row.hits),
    doubles: parseInteger(row.doubles),
    triples: parseInteger(row.triples),
    homeRuns: parseInteger(row.homeRuns),
    runsBattedIn: parseInteger(row.runsBattedIn),
    totalBases: parseInteger(row.totalBases),
    walks: parseInteger(row.walks),
    hitByPitch: parseInteger(row.hitByPitch),
    strikeouts: parseInteger(row.strikeouts),
    intentionalWalks: parseInteger(row.intentionalWalks),
    groundedIntoDoublePlay: parseInteger(row.groundedIntoDoublePlay),
    sacrificeFlies: parseInteger(row.sacrificeFlies),
    sacrificeHits: parseInteger(row.sacrificeHits),
    stolenBases: parseInteger(row.stolenBases),
    stolenBasesAttempts: parseInteger(row.stolenBasesAttemps),
    putouts: parseInteger(row.putouts),
    assists: parseInteger(row.assits),
    errors: parseInteger(row.errors),
    plateAppearances: parseInteger(row.totalPlateAppearances),
    caughtStealing: parseInteger(row.caughtStealing),
    pickedOff: parseInteger(row.pickedOff),
  }));

  const pitching = filterStatRows(individualStats.individualPitchingStats).map((row) => ({
    rosterBioId: normalizeWhitespace(row.playerRosterBioId),
    name: commaNameToDisplay(row.playerName || row.nameFromStats),
    normalizedName: normalizeName(commaNameToDisplay(row.playerName || row.nameFromStats)),
    jersey: normalizeWhitespace(row.playerUniform),
    profileUrl: row.playerUrl ? new URL(row.playerUrl, config.schoolSiteBase).toString() : "",
    imageUrl: normalizeWhitespace(row.playerImageUrl ? new URL(row.playerImageUrl, config.schoolSiteBase).toString() : ""),
    gamesPlayed: parseInteger(row.gamesPlayed),
    gamesStarted: parseInteger(row.gamesStarted),
    appearances: parseInteger(row.appearances),
    gamesCompleted: parseInteger(row.gamesCompleted),
    earnedRunAverage: parseNumeric(row.earnedRunAverage, NaN),
    whip: parseNumeric(row.whip, NaN),
    wins: parseInteger(row.wins),
    losses: parseInteger(row.losses),
    saves: parseInteger(row.saves),
    shutouts: parseInteger(row.shutouts),
    inningsPitched: parseInningsPitched(row.inningsPitched),
    inningsPitchedDisplay: normalizeWhitespace(row.inningsPitched),
    hitsAllowed: parseInteger(row.hitsAllowed),
    runsAllowed: parseInteger(row.runsAllowed),
    earnedRunsAllowed: parseInteger(row.earnedRunsAllowed),
    walksAllowed: parseInteger(row.walksAllowed),
    strikeouts: parseInteger(row.strikeouts),
    doublesAllowed: parseInteger(row.doublesAllowed),
    triplesAllowed: parseInteger(row.triplesAllowed),
    homeRunsAllowed: parseInteger(row.homeRunsAllowed),
    opponentsAtBats: parseInteger(row.opponentsAtBats),
    wildPitches: parseInteger(row.wildPitches),
    hitBatters: parseInteger(row.hitBatters),
    balks: parseInteger(row.balks),
    opponentsBattingAverage: parseNumeric(row.opponentsBattingAverage, NaN),
    walksHits: parseInteger(row.walksHits),
  }));

  const fielding = filterStatRows(individualStats.individualFieldingStats).map((row) => ({
    rosterBioId: normalizeWhitespace(row.playerRosterBioId),
    name: commaNameToDisplay(row.playerName || row.nameFromStats),
    normalizedName: normalizeName(commaNameToDisplay(row.playerName || row.nameFromStats)),
    jersey: normalizeWhitespace(row.playerUniform),
    profileUrl: row.playerUrl ? new URL(row.playerUrl, config.schoolSiteBase).toString() : "",
    imageUrl: normalizeWhitespace(row.playerImageUrl ? new URL(row.playerImageUrl, config.schoolSiteBase).toString() : ""),
    gamesPlayed: parseInteger(row.gamesPlayed),
    gamesStarted: parseInteger(row.gamesStarted),
    putouts: parseInteger(row.putouts),
    assists: parseInteger(row.assists),
    errors: parseInteger(row.errors),
    fieldingPercentage: parseNumeric(row.fieldingPercentage, NaN),
    doublePlays: parseInteger(row.doublePlays),
    stolenBasesAgainst: parseInteger(row.stolenBasesAgainst),
    caughtStealingBy: parseInteger(row.caughtStealingBy),
    stolenBasesPercentage: parseNumeric(row.stolenBasesPercentage, NaN),
    passedBalls: parseInteger(row.passedBalls),
    catchersInterference: parseInteger(row.catchersInterference),
    totalChances: parseInteger(row.totalChances),
  }));

  return {
    statsUrl: new URL(config.statsPath, config.schoolSiteBase).toString(),
    pdfUrl: normalizeWhitespace(cumulative.pdfDoc),
    record: normalizeWhitespace(cumulative.record),
    teamTotals,
    hitting,
    pitching,
    fielding,
  };
}

async function fetchNcaaSchoolRecord(config) {
  const schools = await fetchJson("https://ncaa-api.henrygd.me/schools-index");
  return schools.find((school) => school.slug === config.schoolSlug) || null;
}

async function fetchEspnTeamBundle(config) {
  if (!config.espnTeamId) {
    return {
      team: null,
      athletes: [],
    };
  }

  const [team, roster] = await Promise.all([
    fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${config.espnTeamId}`),
    fetchJson(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/teams/${config.espnTeamId}/roster`),
  ]);

  return {
    team: team.team || null,
    athletes: roster.athletes || [],
  };
}

function indexByKey(rows, keyBuilder) {
  const map = new Map();

  for (const row of rows) {
    const key = keyBuilder(row);
    if (!key) {
      continue;
    }

    map.set(key, row);
  }

  return map;
}

function resolvePrimaryRole({ rosterPlayer, hittingStats, pitchingStats }) {
  const positionHint = normalizeWhitespace(
    [rosterPlayer?.position, rosterPlayer?.positionLong].filter(Boolean).join(" "),
  ).toUpperCase();
  const rosterPitcher =
    /\bP\b/.test(positionHint) ||
    positionHint.includes("PITCH") ||
    positionHint.includes("RHP") ||
    positionHint.includes("LHP") ||
    positionHint.includes("SP") ||
    positionHint.includes("RP");
  const hasHittingStats = Boolean(hittingStats && (hittingStats.plateAppearances > 0 || hittingStats.atBats > 0));
  const hasPitchingStats = Boolean(pitchingStats && (pitchingStats.inningsPitched > 0 || pitchingStats.appearances > 0));

  if (hasPitchingStats && hasHittingStats) {
    return {
      primaryRole: rosterPitcher ? "Pitcher" : "Hitter",
      compositeRole: "Two-Way",
    };
  }

  if (hasPitchingStats || rosterPitcher) {
    return {
      primaryRole: "Pitcher",
      compositeRole: "Pitcher",
    };
  }

  return {
    primaryRole: "Hitter",
    compositeRole: hasHittingStats ? "Hitter" : "Rostered",
  };
}

function buildHitterEvaluation(player) {
  const hitting = player.hittingStats || {};
  const obp = hitting.onBasePercentage;
  const slg = hitting.sluggingPercentage;
  const avg = hitting.battingAverage;
  const bb = hitting.walks || 0;
  const so = hitting.strikeouts || 0;
  const sb = hitting.stolenBases || 0;

  const components = {
    "On-base": scale(obp, 0.28, 0.46),
    Power: scale(slg, 0.32, 0.7),
    Contact: scale(avg, 0.22, 0.38),
    Discipline: scale(safeRatio(bb, Math.max(so, 1), 0), 0.2, 1.1),
    Speed: scale(sb, 0, 30),
  };

  const score =
    components["On-base"] * 0.32 +
    components.Power * 0.26 +
    components.Contact * 0.18 +
    components.Discipline * 0.14 +
    components.Speed * 0.1;

  const strengths = [];
  if (Number.isFinite(obp) && obp >= 0.4) strengths.push("gets on base at a high clip");
  if (Number.isFinite(slg) && slg >= 0.55) strengths.push("brings real extra-base damage");
  if (bb >= so && bb > 0) strengths.push("controls at-bats");
  if (sb >= 8) strengths.push("adds running-game pressure");

  const summary =
    strengths.length > 0
      ? `${player.name} profiles as a ${player.position || "lineup"} piece who ${strengths.join(" and ")}.`
      : `${player.name} gives Toledo a live offensive snapshot from the public cumulative stats feed.`;

  return {
    score: Math.round(score),
    fit: fitLabel(score),
    components,
    summary,
    summaryMetrics: [
      `AVG ${formatAverage(avg)}`,
      `OBP ${formatAverage(obp)}`,
      `SLG ${formatAverage(slg)}`,
    ],
    statCards: [
      { label: "AVG", value: formatAverage(avg) },
      { label: "OBP", value: formatAverage(obp) },
      { label: "SLG", value: formatAverage(slg) },
      { label: "HR", value: String(hitting.homeRuns || 0) },
      { label: "RBI", value: String(hitting.runsBattedIn || 0) },
      { label: "SB", value: String(hitting.stolenBases || 0) },
    ],
  };
}

function buildPitcherEvaluation(player) {
  const pitching = player.pitchingStats || {};
  const innings = pitching.inningsPitched || 0;
  const era = pitching.earnedRunAverage;
  const whip = pitching.whip;
  const k9 = safeRatio((pitching.strikeouts || 0) * 9, innings, 0);
  const bb9 = safeRatio((pitching.walksAllowed || 0) * 9, innings, 0);
  const hr9 = safeRatio((pitching.homeRunsAllowed || 0) * 9, innings, 0);
  const kbb = safeRatio(k9, Math.max(bb9, 0.1), k9);

  const components = {
    "Run prevention": inverseScale(era, 8.0, 1.5),
    "Traffic control": inverseScale(whip, 2.0, 0.8),
    "Miss bats": scale(k9, 4, 15),
    Command: scale(kbb, 1, 6),
    "Damage suppression": inverseScale(hr9, 2.2, 0.3),
  };

  const score =
    components["Run prevention"] * 0.3 +
    components["Traffic control"] * 0.24 +
    components["Miss bats"] * 0.2 +
    components.Command * 0.16 +
    components["Damage suppression"] * 0.1;

  const strengths = [];
  if (Number.isFinite(era) && era <= 4) strengths.push("limits runs");
  if (Number.isFinite(k9) && k9 >= 9) strengths.push("misses bats");
  if (Number.isFinite(bb9) && bb9 <= 3) strengths.push("throws enough strikes");
  if (Number.isFinite(whip) && whip <= 1.25) strengths.push("keeps traffic under control");

  const summary =
    strengths.length > 0
      ? `${player.name} looks like a ${player.position || "staff"} option who ${strengths.join(" and ")}.`
      : `${player.name} gives Toledo a live pitching snapshot from the public cumulative stats feed.`;

  return {
    score: Math.round(score),
    fit: fitLabel(score),
    components,
    summary,
    summaryMetrics: [
      `ERA ${formatMaybeNumber(era, 2)}`,
      `WHIP ${formatMaybeNumber(whip, 2)}`,
      `K/9 ${formatMaybeNumber(k9, 1)}`,
    ],
    statCards: [
      { label: "ERA", value: formatMaybeNumber(era, 2) },
      { label: "WHIP", value: formatMaybeNumber(whip, 2) },
      { label: "K/9", value: formatMaybeNumber(k9, 1) },
      { label: "BB/9", value: formatMaybeNumber(bb9, 1) },
      { label: "HR/9", value: formatMaybeNumber(hr9, 2) },
      { label: "IP", value: formatMaybeNumber(innings, 1) },
    ],
  };
}

function buildPlayerRecord({ config, rosterPlayer, espnAthlete, hittingStats, pitchingStats, fieldingStats }) {
  const displayName =
    rosterPlayer?.name || hittingStats?.name || pitchingStats?.name || fieldingStats?.name || espnAthlete?.fullName || "Unknown Player";
  const { primaryRole, compositeRole } = resolvePrimaryRole({ rosterPlayer, hittingStats, pitchingStats });
  const handedness = buildHandedness(rosterPlayer, espnAthlete);
  const evaluation = primaryRole === "Pitcher" ? buildPitcherEvaluation({
    name: displayName,
    position: rosterPlayer?.position || espnAthlete?.position?.abbreviation || "P",
    pitchingStats,
  }) : buildHitterEvaluation({
    name: displayName,
    position: rosterPlayer?.position || espnAthlete?.position?.abbreviation || "BAT",
    hittingStats,
  });
  const sources = [`${config.schoolName} Athletics roster`];
  if (hittingStats || pitchingStats || fieldingStats) {
    sources.push(`${config.schoolName} cumulative stats`);
  }
  if (espnAthlete) {
    sources.push("ESPN roster");
  }

  const idParts = [config.schoolSlug, rosterPlayer?.rosterBioId || hittingStats?.rosterBioId || pitchingStats?.rosterBioId || slugify(displayName)];
  const detailBadges = [
    rosterPlayer?.position || espnAthlete?.position?.abbreviation || "N/A",
    rosterPlayer?.classYear || "N/A",
    handedness,
    compositeRole,
  ];

  return {
    id: idParts.filter(Boolean).join("-"),
    schoolSlug: config.schoolSlug,
    school: config.schoolName,
    schoolLongName: config.schoolLongName,
    name: displayName,
    normalizedName: normalizeName(displayName),
    compositeRole,
    role: primaryRole,
    position: rosterPlayer?.position || espnAthlete?.position?.abbreviation || "N/A",
    positionLong: rosterPlayer?.positionLong || "",
    classYear: rosterPlayer?.classYear || "N/A",
    handedness,
    jersey: rosterPlayer?.jersey || hittingStats?.jersey || pitchingStats?.jersey || "",
    hometown: rosterPlayer?.hometown || "",
    highSchool: rosterPlayer?.highSchool || "",
    previousSchool: rosterPlayer?.previousSchool || "",
    hometownHighSchool: rosterPlayer?.hometownHighSchool || "",
    profileUrl: rosterPlayer?.profileUrl || hittingStats?.profileUrl || pitchingStats?.profileUrl || fieldingStats?.profileUrl || "",
    imageUrl: rosterPlayer?.imageUrl || hittingStats?.imageUrl || pitchingStats?.imageUrl || fieldingStats?.imageUrl || "",
    espnAthleteId: espnAthlete?.id || "",
    espnSlug: espnAthlete?.slug || "",
    espnDisplayHeight: normalizeWhitespace(espnAthlete?.displayHeight),
    espnDisplayWeight: normalizeWhitespace(espnAthlete?.displayWeight),
    espnBats: normalizeWhitespace(espnAthlete?.bats?.displayValue),
    espnThrows: normalizeWhitespace(espnAthlete?.throws?.displayValue),
    rosterBioId: rosterPlayer?.rosterBioId || hittingStats?.rosterBioId || pitchingStats?.rosterBioId || fieldingStats?.rosterBioId || "",
    sources,
    hittingStats: hittingStats || null,
    pitchingStats: pitchingStats || null,
    fieldingStats: fieldingStats || null,
    evaluation: {
      ...evaluation,
      metaLine: `${rosterPlayer?.classYear || "N/A"} / ${handedness}`,
      detailBadges,
      sourceSummary: sources.join(" + "),
    },
  };
}

function buildTeamSummary(statsBundle) {
  const totals = statsBundle.teamTotals;
  if (!totals) {
    return null;
  }

  const teamHits = parseInteger(totals.hitting?.hits, 0);
  const teamAtBats = parseInteger(totals.hitting?.atBats, 0);
  const teamEarnedRuns = parseInteger(totals.pitching?.earnedRunsAllowed, 0);
  const teamInnings = parseInningsPitched(totals.pitching?.inningsPitched);

  return {
    record: statsBundle.record,
    battingAverage: teamAtBats ? formatAverage(teamHits / teamAtBats) : "",
    earnedRunAverage: teamInnings ? formatMaybeNumber((teamEarnedRuns * 9) / teamInnings, 2) : "",
    wins: normalizeWhitespace(totals.wins),
    losses: normalizeWhitespace(totals.losses),
    hitting: totals.hitting || null,
    fielding: totals.fielding || null,
    pitching: totals.pitching || null,
  };
}

function buildDataset({ config, ncaaSchool, espnTeamBundle, rosterBundle, statsBundle }) {
  const espnIndex = buildEspnPlayerIndex(espnTeamBundle.athletes);
  const hittingIndex = indexByKey(statsBundle.hitting, (row) => row.rosterBioId || row.normalizedName);
  const pitchingIndex = indexByKey(statsBundle.pitching, (row) => row.rosterBioId || row.normalizedName);
  const fieldingIndex = indexByKey(statsBundle.fielding, (row) => row.rosterBioId || row.normalizedName);

  const players = rosterBundle.players.map((rosterPlayer) => {
    const matchKey = rosterPlayer.rosterBioId || rosterPlayer.normalizedName;
    return buildPlayerRecord({
      config,
      rosterPlayer,
      espnAthlete: espnIndex.get(rosterPlayer.normalizedName) || null,
      hittingStats: hittingIndex.get(matchKey) || hittingIndex.get(rosterPlayer.normalizedName) || null,
      pitchingStats: pitchingIndex.get(matchKey) || pitchingIndex.get(rosterPlayer.normalizedName) || null,
      fieldingStats: fieldingIndex.get(matchKey) || fieldingIndex.get(rosterPlayer.normalizedName) || null,
    });
  });

  const rosterNames = new Set(rosterBundle.players.map((player) => player.normalizedName));
  const unmatchedHitting = statsBundle.hitting.filter((player) => !rosterNames.has(player.normalizedName));
  const unmatchedPitching = statsBundle.pitching.filter((player) => !rosterNames.has(player.normalizedName));
  const unmatchedFielding = statsBundle.fielding.filter((player) => !rosterNames.has(player.normalizedName));
  const matchedEspnPlayers = players.filter((player) => player.espnAthleteId).length;

  const roleCounts = players.reduce(
    (counts, player) => {
      counts[player.role] = (counts[player.role] || 0) + 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  const playerBoard = {
    source: `${config.schoolName} Athletics roster + cumulative stats / ESPN roster`,
    note:
      matchedEspnPlayers > 0
        ? `This ${config.schoolName}-first dataset is built from public school-site roster and cumulative stats pages, then enriched with matching ESPN roster identities.`
        : `This ${config.schoolName}-first dataset is built from public school-site roster and cumulative stats pages. ESPN was checked too, but ${config.schoolName}'s public ESPN roster feed did not line up cleanly with the current school-site roster.`,
    totalPlayers: players.length,
    roleCounts,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      school: player.school,
      role: player.role,
      position: player.position,
      classYear: player.classYear,
      handedness: player.handedness,
      score: player.evaluation.score,
      fit: player.evaluation.fit,
      summary: player.evaluation.summary,
      summaryMetrics: player.evaluation.summaryMetrics,
      statCards: player.evaluation.statCards,
      components: player.evaluation.components,
      metaLine: player.evaluation.metaLine,
      detailBadges: player.evaluation.detailBadges,
      leaderboards: player.sources,
      sourceSummary: player.evaluation.sourceSummary,
      schoolSlug: player.schoolSlug,
      compositeRole: player.compositeRole,
      profileUrl: player.profileUrl,
      espnAthleteId: player.espnAthleteId,
    })),
  };

  return {
    generatedAt: new Date().toISOString(),
    season: config.season,
    school: {
      slug: config.schoolSlug,
      name: config.schoolName,
      longName: config.schoolLongName,
      ncaaVerified: Boolean(ncaaSchool),
      ncaaRecord: ncaaSchool,
      espnTeamId: config.espnTeamId,
      espnDisplayName: espnTeamBundle.team?.displayName || "",
      espnSlug: espnTeamBundle.team?.slug || "",
      rosterUrl: rosterBundle.rosterUrl,
      statsUrl: statsBundle.statsUrl,
      pdfUrl: statsBundle.pdfUrl,
    },
    sources: {
      roster: `${config.schoolName} Athletics roster`,
      stats: `${config.schoolName} Athletics cumulative stats`,
      espn:
        matchedEspnPlayers > 0
          ? "ESPN college baseball team roster"
          : `ESPN team identity verified, but ${config.schoolName}'s public roster feed did not match the current ${config.season} school-site roster`,
      ncaa: "NCAA school index",
    },
    coverage: {
      rosterPlayers: rosterBundle.players.length,
      espnRosterPlayers: espnTeamBundle.athletes.length,
      playersWithHittingStats: players.filter((player) => player.hittingStats).length,
      playersWithPitchingStats: players.filter((player) => player.pitchingStats).length,
      playersWithFieldingStats: players.filter((player) => player.fieldingStats).length,
      mergedPlayersWithAnyStats: players.filter(
        (player) => player.hittingStats || player.pitchingStats || player.fieldingStats,
      ).length,
      matchedEspnPlayers,
      unmatchedStatRows: {
        hitting: unmatchedHitting.map((player) => player.name),
        pitching: unmatchedPitching.map((player) => player.name),
        fielding: unmatchedFielding.map((player) => player.name),
      },
    },
    teamSummary: buildTeamSummary(statsBundle),
    players,
    playerBoard,
  };
}

async function writeDataset(outputPath, dataset) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
}

async function writeBrowserDatasetBundle(outputPath, dataset) {
  const jsOutputPath = outputPath.replace(/\.json$/i, ".js");
  const schoolKey = `${dataset.school.slug}${dataset.season}`;
  const bundle = [
    "window.__BASEBALL_DATASETS__ = window.__BASEBALL_DATASETS__ || {};",
    `window.__BASEBALL_DATASETS__.${schoolKey} = ${JSON.stringify(dataset, null, 2)};`,
    dataset.school.slug === "toledo"
      ? `window.__TOLEDO_BASEBALL_DATASET__ = window.__BASEBALL_DATASETS__.${schoolKey};`
      : "",
    "",
  ].join("\n");
  await writeFile(jsOutputPath, bundle, "utf8");
  return jsOutputPath;
}

function buildCombinedPool(datasets, season) {
  const players = datasets.flatMap((dataset) => dataset.playerBoard.players);
  const roleCounts = players.reduce(
    (counts, player) => {
      counts[player.role] = (counts[player.role] || 0) + 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  const schools = datasets.map((dataset) => ({
    slug: dataset.school.slug,
    name: dataset.school.name,
    longName: dataset.school.longName,
    record: dataset.teamSummary?.record || "",
    totalPlayers: dataset.playerBoard.totalPlayers || 0,
    hitters: dataset.playerBoard.roleCounts?.Hitter || 0,
    pitchers: dataset.playerBoard.roleCounts?.Pitcher || 0,
    rosterPlayers: dataset.coverage?.rosterPlayers || 0,
    playersWithAnyStats: dataset.coverage?.mergedPlayersWithAnyStats || 0,
    statsUrl: dataset.school.statsUrl,
    rosterUrl: dataset.school.rosterUrl,
  }));

  return {
    generatedAt: new Date().toISOString(),
    season,
    source: "Generated Sidearm baseball school-site pool",
    note:
      "This generated free player pool combines verified public roster and cumulative stats pages from multiple Sidearm baseball programs. It is broader than Toledo alone, but still not a full every-school national directory yet.",
    schoolCount: schools.length,
    schools,
    coverage: {
      totalPlayers: players.length,
      totalHitters: roleCounts.Hitter || 0,
      totalPitchers: roleCounts.Pitcher || 0,
      schoolsCovered: schools.length,
    },
    playerBoard: {
      source: "Generated Sidearm baseball school-site pool",
      note:
        "This free generated pool comes from verified public school-site roster and cumulative stats pages across multiple Sidearm baseball programs.",
      totalPlayers: players.length,
      roleCounts,
      players,
    },
  };
}

async function writeCombinedPoolBundle(outputPath, dataset) {
  const jsOutputPath = outputPath.replace(/\.json$/i, ".js");
  const bundle = [
    "window.__BASEBALL_DATASETS__ = window.__BASEBALL_DATASETS__ || {};",
    `window.__BASEBALL_DATASETS__.generatedSidearmPool${dataset.season} = ${JSON.stringify(dataset, null, 2)};`,
    `window.__GENERATED_SIDEARM_PLAYER_POOL__ = window.__BASEBALL_DATASETS__.generatedSidearmPool${dataset.season};`,
    "",
  ].join("\n");
  await writeFile(jsOutputPath, bundle, "utf8");
  return jsOutputPath;
}

function printCombinedPoolSummary(outputPath, bundlePath, poolDataset) {
  console.log(`Wrote combined pool dataset to ${outputPath}`);
  console.log(`Wrote combined pool browser bundle to ${bundlePath}`);
  console.log(`Schools covered: ${poolDataset.schoolCount}`);
  console.log(
    `Pool players: ${poolDataset.playerBoard.totalPlayers} (${poolDataset.playerBoard.roleCounts.Hitter} hitters / ${poolDataset.playerBoard.roleCounts.Pitcher} pitchers)`,
  );
  console.log(
    `Schools: ${poolDataset.schools.map((school) => `${school.name} (${school.totalPlayers})`).join(", ")}`,
  );
}

function printSummary(outputPath, bundlePath, dataset) {
  console.log(`Wrote dataset to ${outputPath}`);
  console.log(`Wrote browser bundle to ${bundlePath}`);
  console.log(`School: ${dataset.school.name}`);
  console.log(`Roster players: ${dataset.coverage.rosterPlayers}`);
  console.log(`ESPN roster players: ${dataset.coverage.espnRosterPlayers}`);
  console.log(`Players with any public stat line: ${dataset.coverage.mergedPlayersWithAnyStats}`);
  console.log(
    `Role counts: ${dataset.playerBoard.roleCounts.Hitter} hitters / ${dataset.playerBoard.roleCounts.Pitcher} pitchers`,
  );
  console.log(`${dataset.school.name} record: ${dataset.teamSummary?.record || "Unavailable"}`);
  console.log(
    `Sample board players: ${dataset.playerBoard.players
      .slice(0, 5)
      .map((player) => `${player.name} (${player.position}, ${player.score})`)
      .join(", ")}`,
  );
}

async function generateSchoolDataset(config) {
  const rosterUrl = new URL(config.rosterPath, config.schoolSiteBase).toString();
  const statsUrl = new URL(config.statsPath, config.schoolSiteBase).toString();

  const [ncaaSchool, espnTeamBundle, rosterHtml, statsHtml] = await Promise.all([
    fetchNcaaSchoolRecord(config),
    fetchEspnTeamBundle(config),
    fetchText(rosterUrl),
    fetchText(statsUrl),
  ]);

  const rosterBundle = parseSidearmRosterPage(rosterHtml, config);
  const statsBundle = parseSidearmStatsPage(statsHtml, config);
  const dataset = buildDataset({
    config,
    ncaaSchool,
    espnTeamBundle,
    rosterBundle,
    statsBundle,
  });

  await writeDataset(config.outputPath, dataset);
  const bundlePath = await writeBrowserDatasetBundle(config.outputPath, dataset);
  printSummary(config.outputPath, bundlePath, dataset);
  return dataset;
}

async function main() {
  const options = parseArgs(process.argv);
  const resolved = resolveTeamConfig(options);

  if (resolved.mode === "all") {
    const datasets = [];
    const failures = [];

    for (const teamConfig of resolved.teamConfigs) {
      try {
        const dataset = await generateSchoolDataset(teamConfig);
        datasets.push(dataset);
      } catch (error) {
        failures.push({
          key: teamConfig.key,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!datasets.length) {
      throw new Error(`No school datasets were generated successfully. Failures: ${JSON.stringify(failures)}`);
    }

    const combinedPool = buildCombinedPool(datasets, resolved.season);
    await writeDataset(resolved.outputPath, combinedPool);
    const combinedBundlePath = await writeCombinedPoolBundle(resolved.outputPath, combinedPool);
    printCombinedPoolSummary(resolved.outputPath, combinedBundlePath, combinedPool);

    if (failures.length) {
      console.warn("Some school ingests failed:");
      for (const failure of failures) {
        console.warn(`- ${failure.key}: ${failure.message}`);
      }
    }

    return;
  }

  await generateSchoolDataset(resolved);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
