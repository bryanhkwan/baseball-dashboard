const DEFAULT_SCHOOL_SLUG = "toledo";
const SCHOOL_SEARCH_LIMIT = 16;
const SCOREBOARD_LIMIT = 12;
const GENERATED_TOLEDO_DATASET = window.__TOLEDO_BASEBALL_DATASET__ || null;
const GENERATED_SIDEARM_POOL = window.__GENERATED_SIDEARM_PLAYER_POOL__ || null;
const PLAYER_BOARD_SOURCES = {
  UNIFIED: "unified",
};
const DEFAULT_PLAYER_BOARD_SOURCE = PLAYER_BOARD_SOURCES.UNIFIED;

// Maps short stat abbreviations to readable full names for the player detail panel
const STAT_LABEL_MAP = {
  AVG: "Batting Avg",
  OBP: "On-Base %",
  SLG: "Slugging %",
  AB: "At Bats",
  H: "Hits",
  R: "Runs Scored",
  RBI: "Runs Batted In",
  BB: "Walks",
  SO: "Strikeouts",
  SB: "Stolen Bases",
  XBH: "Extra-Base Hits",
  Errors: "Errors",
  ERA: "Earned Run Avg",
  WHIP: "WHIP",
  "K/9": "Strikeouts / 9",
  "BB/9": "Walks / 9",
  "HR/9": "Home Runs / 9",
  IP: "Innings Pitched",
  K: "Strikeouts",
  ER: "Earned Runs",
  BF: "Batters Faced",
};

// Short plain-English description for each scoring component
const COMPONENT_HELP = {
  "On-base": "How often they reach base",
  Power: "Extra-base hitting strength",
  Contact: "Batting average consistency",
  Discipline: "Walks vs. strikeouts",
  Speed: "Stolen-base ability",
  Production: "Hits + runs + RBIs in this game",
  "Base pressure": "Hits and walks combined",
  Impact: "Extra-base hits and home runs",
  Defense: "Fielding and error rate",
  "Run prevention": "Keeps runs off the board",
  "Traffic control": "Limits runners on base",
  "Miss bats": "Strikeout ability",
  Command: "Strikes vs. walks ratio",
  "Damage suppression": "Limits home runs",
  Workload: "Innings worked",
};

// What each fit tier means in plain English for coaches
const FIT_EXPLANATIONS = {
  Priority: "Top-tier fit — recruit this player now.",
  Pursue: "Strong candidate — worth making contact this week.",
  Monitor: "Keep watching — could develop into a fit by next season.",
  Depth: "Specialist or depth role — useful in specific situations only.",
};

const sourceChecksFallback = [
  {
    label: "School index",
    value: 'The NCAA school index exposes school slug, short name, and long name. Toledo is listed as slug "toledo".',
  },
  {
    label: "Scoreboard",
    value: "Scoreboard payloads include game IDs, team names, start times, scores, game state, and matchup URLs.",
  },
  {
    label: "Boxscore",
    value: "Game boxscores include player names, positions, starter flags, team totals, and batting or pitching lines.",
  },
  {
    label: "Play-by-play",
    value: "Completed games expose inning-by-inning event text with player names and score changes.",
  },
];

const buildMetricsFallback = [
  {
    label: "Default school",
    value: "Toledo",
    note: "The dashboard should always open on Toledo first, then branch into compare and target workflows.",
  },
  {
    label: "Primary source",
    value: "NCAA-backed",
    note: "Best fit for a Toledo-first MVP because we can verify school coverage directly today.",
  },
  {
    label: "Score model",
    value: "Split by role",
    note: "Hitters and pitchers need different math. One blended score would hide too much.",
  },
  {
    label: "Portal workflow",
    value: "Need-based",
    note: "Track archetypes and thresholds first, then match candidates into those buckets.",
  },
];

const rosterSeed = [
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
    summary:
      "Premium up-the-middle profile. Strong on-base shape, speed value, and enough impact to fit near the top of an order.",
  },
  {
    id: "p2",
    name: "Demo Toledo C",
    role: "Hitter",
    position: "C",
    classYear: "SO",
    handedness: "R/R",
    avg: 0.286,
    obp: 0.392,
    slg: 0.487,
    bb: 27,
    so: 35,
    sb: 2,
    summary:
      "Catch-and-throw value paired with steady plate discipline. More floor than explosion, but easy to win with if defense holds.",
  },
  {
    id: "p3",
    name: "Demo Toledo 1B",
    role: "Hitter",
    position: "1B",
    classYear: "SR",
    handedness: "L/R",
    avg: 0.301,
    obp: 0.401,
    slg: 0.603,
    bb: 33,
    so: 47,
    sb: 1,
    summary:
      "Corner bat profile. The power plays now, so the recruiting question is whether the hit tool and body profile support enough certainty.",
  },
  {
    id: "p4",
    name: "Demo Toledo SS",
    role: "Hitter",
    position: "SS",
    classYear: "FR",
    handedness: "R/R",
    avg: 0.271,
    obp: 0.356,
    slg: 0.428,
    bb: 18,
    so: 30,
    sb: 14,
    summary:
      "Young middle-infield profile with speed and playable on-base skill. Useful example of a development-driven evaluation rather than pure current production.",
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
    summary:
      "Starter profile with enough strike-throwing and bat-missing to anchor a weekend rotation. This is the shape we should actively hunt in the portal.",
  },
  {
    id: "p6",
    name: "Demo Toledo SP2",
    role: "Pitcher",
    position: "SP",
    classYear: "SO",
    handedness: "L/L",
    era: 4.02,
    whip: 1.23,
    k9: 8.4,
    bb9: 3.1,
    hr9: 0.82,
    ip: 61.2,
    summary:
      "Solid left-handed starter template. Slightly more volatile than the top arm, but still a helpful benchmark for a pursue-tier role.",
  },
  {
    id: "p7",
    name: "Demo Toledo RP",
    role: "Pitcher",
    position: "RP",
    classYear: "SR",
    handedness: "R/R",
    era: 2.48,
    whip: 0.98,
    k9: 12.7,
    bb9: 4.0,
    hr9: 0.51,
    ip: 36.0,
    summary:
      "Late-inning stuff. The strikeout rate is real, and the main question is whether command is stable enough for high leverage.",
  },
];

const targetArchetypes = [
  {
    title: "Left-handed top-of-order bat",
    priority: "high",
    fit: "Needs immediate OBP help",
    focus: "CF, LF, 2B",
    thresholds: "OBP >= .390, BB:K >= 0.65, SB impact",
    why: "Adds lineup diversity and table-setting without forcing all impact into one power bat.",
  },
  {
    title: "Weekend starter",
    priority: "high",
    fit: "Run prevention",
    focus: "SP",
    thresholds: "WHIP <= 1.30, K/9 >= 9.0, HR/9 <= 0.9",
    why: "This is the cleanest way to raise the floor of a staff and stabilize series play.",
  },
  {
    title: "Power corner bat",
    priority: "medium",
    fit: "Middle-order thump",
    focus: "1B, RF, DH",
    thresholds: "SLG >= .540, OBP >= .370",
    why: "If Toledo needs more run production, this is the easiest profile to identify and price correctly.",
  },
  {
    title: "Strike-throwing leverage reliever",
    priority: "medium",
    fit: "Bullpen certainty",
    focus: "RP",
    thresholds: "ERA <= 3.80, K:BB >= 3.0, WHIP <= 1.20",
    why: "Baseball games tighten fast late. Clean bullpen innings can change a season.",
  },
];

const state = {
  roleFilter: "All",
  sortKey: "score",
  selectedPlayerId: "",
  overview: {
    loading: true,
    error: "",
    summary: null,
  },
  playerBoard: {
    loading: true,
    syncing: false,
    error: "",
    payload: null,
    coverage: null,
    coverageLoading: false,
    coverageError: "",
    selectedPlayer: null,
    selectedPlayerLoading: false,
    selectedPlayerError: "",
    sourceKey: DEFAULT_PLAYER_BOARD_SOURCE,
    searchQuery: "",
    page: 1,
    pageSize: 40,
    profileOpen: false,
  },
  explorer: {
    schoolQuery: "",
    schoolsLoading: true,
    schoolsError: "",
    schools: [],
    selectedSchoolSlug: DEFAULT_SCHOOL_SLUG,
    selectedSchoolLoading: true,
    selectedSchoolError: "",
    selectedSchoolSummary: null,
    standingsLoading: false,
    standingsError: "",
    standings: null,
    opponentScoutLoading: false,
    opponentScoutError: "",
    opponentScout: null,
    scoreboardLoading: true,
    scoreboardError: "",
    scoreboard: null,
    selectedGameId: "",
    selectedGameLoading: false,
    selectedGameError: "",
    selectedGame: null,
  },
};

const sourceListEl = document.querySelector("#source-list");
const metricGridEl = document.querySelector("#metric-grid");
const playerTableBodyEl = document.querySelector("#player-table-body");
const playersPanelSubEl = document.querySelector("#players-panel-sub");
const playersFootnoteEl = document.querySelector("#players-footnote");
const playerSearchEl = document.querySelector("#player-search");
const playerResultsMetaEl = document.querySelector("#player-results-meta");
const playerCoverageSummaryEl = document.querySelector("#player-coverage-summary");
const playerCoverageGridEl = document.querySelector("#player-coverage-grid");
const playerPagePrevEl = document.querySelector("#player-page-prev");
const playerPageNextEl = document.querySelector("#player-page-next");
const targetGridEl = document.querySelector("#target-grid");
const roleFilterEl = document.querySelector("#role-filter");
const sortSelectEl = document.querySelector("#sort-select");
const liveWindowEl = document.querySelector("#live-window");
const toledoIdentityEl = document.querySelector("#toledo-identity");
const verifiedPlayersEl = document.querySelector("#verified-players");
const schoolBadgeEl = document.querySelector("#school-badge");
const sourceBadgeEl = document.querySelector("#source-badge");
const latestResultBadgeEl = document.querySelector("#latest-result-badge");
const nextGameBadgeEl = document.querySelector("#next-game-badge");
const schoolSearchEl = document.querySelector("#school-search");
const schoolSearchMetaEl = document.querySelector("#school-search-meta");
const schoolResultsEl = document.querySelector("#school-results");
const selectedSchoolSummaryEl = document.querySelector("#selected-school-summary");
const selectedSchoolGamesEl = document.querySelector("#selected-school-games");
const selectedSchoolMetaEl = document.querySelector("#selected-school-meta");
const scoreboardMetaEl = document.querySelector("#scoreboard-meta");
const scoreboardListEl = document.querySelector("#scoreboard-list");
const gameDetailEl = document.querySelector("#game-detail");
const playerProfileModalBackEl = document.querySelector("#playerProfileModalBack");
const playerProfileModalCloseEl = document.querySelector("#playerProfileModalClose");
const playerProfileModalBodyEl = document.querySelector("#playerProfileModalBody");
const playerProfileModalTitleEl = document.querySelector("#playerProfileModalTitle");
const playerProfileModalEyebrowEl = document.querySelector("#playerProfileModalEyebrow");
const playerProfileModalSubEl = document.querySelector("#playerProfileModalSub");
const playerProfileModalMetaEl = document.querySelector("#playerProfileModalMeta");
const playerProfileAvatarEl = document.querySelector("#playerProfileAvatar");
const playerProfileModalLinkEl = document.querySelector("#playerProfileModalLink");
const playerDetailEl = playerProfileModalBodyEl;

const API_BASE = resolveApiBase();
const LIVE_API_ENABLED = Boolean(API_BASE);
const LIVE_API_UNAVAILABLE_MESSAGE =
  "Live baseball API is not configured for this hosted build. The static player board still works, but live Overview and Games data stay off until you add a backend URL.";
const pageDataState = {
  playerBoardLoaded: false,
  playerCoverageLoaded: false,
  overviewLoaded: false,
  schoolSearchLoaded: false,
  selectedSchoolLoaded: false,
  scoreboardLoaded: false,
};
let schoolSearchTimer = 0;
let playerSearchTimer = 0;
let selectedSchoolRequestId = 0;
let selectedSchoolStandingsRequestId = 0;
let selectedSchoolOpponentScoutRequestId = 0;
let playerBoardRequestId = 0;
let playerCoverageRequestId = 0;
let playerDetailRequestId = 0;

function showDashboardPage(targetId) {
  document.querySelectorAll('.pageNavBtn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.page === targetId);
  });
  document.querySelectorAll('.dashPage').forEach(function(el) {
    el.style.display = 'none';
  });
  var target = document.getElementById(targetId);
  if (target) {
    target.style.display = '';
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = '';
  }
  if (targetId !== "pagePlayers" && state.playerBoard.profileOpen) {
    closePlayerProfile();
  }
  ensurePageDataLoaded(targetId);
  window.scrollTo(0, 0);
}

function initPageNav() {
  document.querySelectorAll('.pageNavBtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showDashboardPage(btn.dataset.page);
    });
  });
}

function isLikelyLocalHostname(hostname) {
  if (!hostname) {
    return true;
  }

  return (
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function getExplicitApiBase() {
  const explicit = window.BASEBALL_API_BASE || document.documentElement.dataset.apiBase;
  return typeof explicit === "string" && explicit.trim() ? explicit.replace(/\/$/, "") : "";
}

function resolveApiBase() {
  const explicit = getExplicitApiBase();
  if (explicit) {
    return explicit;
  }
  if (window.location.protocol === "file:" || isLikelyLocalHostname(window.location.hostname)) {
    return "http://127.0.0.1:8787";
  }
  return "";
}

function getPlayerApiBaseCandidates() {
  const candidates = [API_BASE];
  if (window.location.protocol === "file:" || isLikelyLocalHostname(window.location.hostname)) {
    candidates.push("http://127.0.0.1:8787");
  }
  const explicit = getExplicitApiBase();
  if (explicit) {
    candidates.push(explicit);
  }
  return uniqueItems(candidates);
}

function ensurePageDataLoaded(targetId) {
  if (targetId === "pagePlayers") {
    if (!pageDataState.playerBoardLoaded) {
      pageDataState.playerBoardLoaded = true;
      loadPlayerBoard();
    }
    if (!pageDataState.playerCoverageLoaded) {
      pageDataState.playerCoverageLoaded = true;
      loadPlayerCoverage();
    }
    return;
  }

  if (targetId === "pageOverview") {
    if (!pageDataState.overviewLoaded) {
      pageDataState.overviewLoaded = true;
      loadOverviewAndDefaultSchool();
    }
    return;
  }

  if (targetId === "pageTeams") {
    if (!pageDataState.schoolSearchLoaded) {
      pageDataState.schoolSearchLoaded = true;
      loadSchoolResults();
    }
    if (!pageDataState.selectedSchoolLoaded) {
      pageDataState.selectedSchoolLoaded = true;
      loadSelectedSchoolSummary(state.explorer.selectedSchoolSlug || DEFAULT_SCHOOL_SLUG);
    }
    if (!pageDataState.scoreboardLoaded) {
      pageDataState.scoreboardLoaded = true;
      loadScoreboard();
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, decimals = 1) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function scale(value, min, max) {
  return ((clamp(value, min, max) - min) / (max - min)) * 100;
}

function inverseScale(value, bad, good) {
  return scale(bad - value, bad - good, bad - good);
}

function safeRatio(a, b, fallback = 0) {
  return b === 0 ? fallback : a / b;
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

function normalizeGameState(value) {
  return String(value || "").toLowerCase();
}

function gameStateClass(gameState) {
  const normalized = normalizeGameState(gameState);
  if (normalized === "final" || normalized === "f") {
    return "final";
  }
  if (normalized === "live" || normalized === "in_progress") {
    return normalized;
  }
  if (normalized === "pre") {
    return "pre";
  }
  return "other";
}

function schoolPerspectiveLabel(game) {
  if (!game) {
    return "Waiting";
  }
  return `${game.isSchoolHome ? "vs" : "at"} ${game.opponent?.short || "Opponent"}`;
}

function schoolPerspectiveScore(game) {
  const teamScore = game?.team?.score;
  const opponentScore = game?.opponent?.score;
  if (teamScore === "" || opponentScore === "" || teamScore == null || opponentScore == null) {
    return game?.startTime || "TBD";
  }
  return `${game.team?.short || "Team"} ${teamScore} - ${game.opponent?.short || "Opponent"} ${opponentScore}`;
}

function schoolResultLabel(game) {
  const teamScore = Number(game?.team?.score);
  const opponentScore = Number(game?.opponent?.score);
  if (Number.isNaN(teamScore) || Number.isNaN(opponentScore)) {
    return schoolPerspectiveLabel(game);
  }
  const prefix = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T";
  return `${prefix} ${teamScore}-${opponentScore}`;
}

function genericMatchupLabel(game) {
  return `${game?.away?.short || "Away"} at ${game?.home?.short || "Home"}`;
}

function genericScoreLine(game) {
  const awayScore = game?.away?.score;
  const homeScore = game?.home?.score;
  if (awayScore === "" || homeScore === "" || awayScore == null || homeScore == null) {
    return game?.startTime || "TBD";
  }
  return `${game.away?.short || "Away"} ${awayScore} - ${game.home?.short || "Home"} ${homeScore}`;
}

function shortSummaryNote(game) {
  return `${game?.date || ""} - ${game?.startTime || game?.currentPeriod || "TBD"}`;
}

function enrichSeedPlayer(player) {
  if (player.role === "Hitter") {
    const components = {
      "On-base": scale(player.obp, 0.28, 0.46),
      Power: scale(player.slg, 0.32, 0.7),
      Contact: scale(player.avg, 0.22, 0.38),
      Discipline: scale(safeRatio(player.bb, Math.max(player.so, 1), 0), 0.2, 1.1),
      Speed: scale(player.sb, 0, 30),
    };
    const score =
      components["On-base"] * 0.32 +
      components.Power * 0.26 +
      components.Contact * 0.18 +
      components.Discipline * 0.14 +
      components.Speed * 0.1;

    return {
      ...player,
      score: Math.round(score),
      fit: fitLabel(score),
      metaLine: `${player.classYear} / ${player.handedness}`,
      summaryMetrics: [
        `AVG ${player.avg.toFixed(3)}`,
        `OBP ${player.obp.toFixed(3)}`,
        `SLG ${player.slg.toFixed(3)}`,
      ],
      detailBadges: [player.position, player.classYear, player.handedness],
      statCards: [
        { label: "Batting Avg", value: player.avg.toFixed(3) },
        { label: "On-Base %", value: player.obp.toFixed(3) },
        { label: "Slugging %", value: player.slg.toFixed(3) },
        { label: "Walks", value: String(player.bb) },
        { label: "Strikeouts", value: String(player.so) },
        { label: "Stolen Bases", value: String(player.sb) },
      ],
      components,
    };
  }

  const kbb = safeRatio(player.k9, Math.max(player.bb9, 0.1), player.k9);
  const components = {
    "Run prevention": inverseScale(player.era, 8.0, 1.5),
    "Traffic control": inverseScale(player.whip, 2.0, 0.8),
    "Miss bats": scale(player.k9, 4, 15),
    Command: scale(kbb, 1, 6),
    "Damage suppression": inverseScale(player.hr9, 2.2, 0.3),
  };
  const score =
    components["Run prevention"] * 0.3 +
    components["Traffic control"] * 0.24 +
    components["Miss bats"] * 0.2 +
    components.Command * 0.16 +
    components["Damage suppression"] * 0.1;

  return {
    ...player,
    score: Math.round(score),
    fit: fitLabel(score),
    metaLine: `${player.classYear} / ${player.handedness}`,
    summaryMetrics: [
      `ERA ${player.era.toFixed(2)}`,
      `WHIP ${player.whip.toFixed(2)}`,
      `K/9 ${player.k9.toFixed(1)}`,
    ],
    detailBadges: [player.position, player.classYear, player.handedness],
    statCards: [
      { label: "Earned Run Avg", value: player.era.toFixed(2) },
      { label: "WHIP", value: player.whip.toFixed(2) },
      { label: "Strikeouts / 9", value: player.k9.toFixed(1) },
      { label: "Walks / 9", value: player.bb9.toFixed(1) },
      { label: "Home Runs / 9", value: player.hr9.toFixed(2) },
      { label: "Innings Pitched", value: player.ip.toFixed(1) },
    ],
    components,
  };
}

const seedPlayers = rosterSeed.map(enrichSeedPlayer);

function hasGeneratedToledoDataset() {
  return Boolean(GENERATED_TOLEDO_DATASET?.playerBoard?.players?.length);
}

function hasGeneratedSidearmPool() {
  return Boolean(GENERATED_SIDEARM_POOL?.playerBoard?.players?.length);
}

function getGeneratedToledoPlayerBoardPayload() {
  if (!hasGeneratedToledoDataset()) {
    return null;
  }

  return {
    ...GENERATED_TOLEDO_DATASET.playerBoard,
    school: GENERATED_TOLEDO_DATASET.school,
    teamSummary: GENERATED_TOLEDO_DATASET.teamSummary,
    coverage: GENERATED_TOLEDO_DATASET.coverage,
    generatedAt: GENERATED_TOLEDO_DATASET.generatedAt,
    source:
      GENERATED_TOLEDO_DATASET.playerBoard?.source ||
      "Toledo Athletics roster + cumulative stats",
  };
}

function getGeneratedSidearmPoolPayload() {
  if (!hasGeneratedSidearmPool()) {
    return null;
  }

  return {
    ...GENERATED_SIDEARM_POOL.playerBoard,
    schools: GENERATED_SIDEARM_POOL.schools,
    coverage: GENERATED_SIDEARM_POOL.coverage,
    generatedAt: GENERATED_SIDEARM_POOL.generatedAt,
    source:
      GENERATED_SIDEARM_POOL.playerBoard?.source ||
      "Generated Sidearm baseball school-site pool",
    note:
      GENERATED_SIDEARM_POOL.playerBoard?.note ||
      GENERATED_SIDEARM_POOL.note,
  };
}

function normalizePlayerMergeKeyPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPlayerMergeKey(player = {}) {
  return [
    normalizePlayerMergeKeyPart(player.name),
    normalizePlayerMergeKeyPart(player.school),
    normalizePlayerMergeKeyPart(player.role),
  ].join("::");
}

function uniqueItems(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function mergePlayerStatCards(primaryCards = [], secondaryCards = []) {
  const cardMap = new Map();
  [...secondaryCards, ...primaryCards].forEach((card) => {
    if (!card?.label) {
      return;
    }
    cardMap.set(card.label, card);
  });
  return [...cardMap.values()];
}

function playerProfileRichness(player = {}) {
  return (
    (player.statCards?.length || 0) * 3 +
    (player.summaryMetrics?.length || 0) * 2 +
    Object.keys(player.components || {}).length * 3 +
    (player.detailBadges?.length || 0) +
    (player.latestGameImpact ? 4 : 0) +
    (player.recentTrend ? 4 : 0) +
    (Number.isFinite(player.nationalRank) ? 3 : 0) +
    (player.summary ? Math.min(3, Math.round(player.summary.length / 80)) : 0)
  );
}

function normalizeUnifiedFit(fit = {}) {
  const normalizedLabel =
    {
      Impact: "Priority",
      Strong: "Pursue",
      Useful: "Monitor",
      Quiet: "Depth",
    }[fit.label] || fit.label || "Depth";

  const className =
    {
      Priority: "fit-priority",
      Pursue: "fit-pursue",
      Monitor: "fit-monitor",
      Depth: "fit-depth",
    }[normalizedLabel] || fit.className || "fit-depth";

  return {
    label: normalizedLabel,
    className,
  };
}

function attachBoardOrigin(player, boardLabel) {
  return {
    ...player,
    fit: normalizeUnifiedFit(player.fit),
    boardOrigins: uniqueItems([...(player.boardOrigins || []), boardLabel]),
  };
}

function mergeUnifiedPlayers(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  const incomingWins = playerProfileRichness(incoming) > playerProfileRichness(existing);
  const primary = incomingWins ? incoming : existing;
  const secondary = incomingWins ? existing : incoming;
  const merged = {
    ...secondary,
    ...primary,
  };

  merged.boardOrigins = uniqueItems([...(existing.boardOrigins || []), ...(incoming.boardOrigins || [])]);
  merged.detailBadges = uniqueItems([...(primary.detailBadges || []), ...(secondary.detailBadges || [])]);
  merged.summaryMetrics = uniqueItems([...(primary.summaryMetrics || []), ...(secondary.summaryMetrics || [])]).slice(0, 8);
  merged.statCards = mergePlayerStatCards(primary.statCards || [], secondary.statCards || []);
  merged.components =
    Object.keys(primary.components || {}).length >= Object.keys(secondary.components || {}).length
      ? primary.components || {}
      : secondary.components || {};

  const nationalRanks = [existing.nationalRank, incoming.nationalRank].filter(Number.isFinite);
  if (nationalRanks.length) {
    merged.nationalRank = Math.min(...nationalRanks);
  }

  if (Number.isFinite(merged.nationalRank)) {
    merged.detailBadges = uniqueItems([...(merged.detailBadges || []), `National rank #${merged.nationalRank}`]);
  }

  if (merged.boardOrigins.length) {
    merged.sourceSummary = `Available on: ${merged.boardOrigins.join(" • ")}`;
  }

  return merged;
}

function summarizeUnifiedSources(boardCounts = {}, nationalError = "") {
  const parts = [];
  if (boardCounts.toledoSeasonRoster) {
    parts.push(`${boardCounts.toledoSeasonRoster} Toledo season`);
  }
  if (boardCounts.transferTargetsPool) {
    parts.push(`${boardCounts.transferTargetsPool} transfer pool`);
  }
  if (boardCounts.nationalBoard) {
    parts.push(`${boardCounts.nationalBoard} national API`);
  }
  if (!parts.length) {
    return nationalError ? `Sources unavailable: ${nationalError}` : "Sources unavailable";
  }
  return parts.join(" • ");
}

function buildUnifiedPlayerBoardPayload(sourcePayloads, options = {}) {
  const playerMap = new Map();
  const boardCounts = {};

  sourcePayloads.forEach(({ label, countKey, payload }) => {
    (payload?.players || []).forEach((player) => {
      boardCounts[countKey] = (boardCounts[countKey] || 0) + 1;
      const taggedPlayer = attachBoardOrigin(player, label);
      const key = getPlayerMergeKey(taggedPlayer);
      playerMap.set(key, mergeUnifiedPlayers(playerMap.get(key), taggedPlayer));
    });
  });

  const players = [...playerMap.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if ((left.nationalRank || 99999) !== (right.nationalRank || 99999)) {
      return (left.nationalRank || 99999) - (right.nationalRank || 99999);
    }
    return left.name.localeCompare(right.name);
  });

  const roleCounts = players.reduce(
    (counts, player) => {
      counts[player.role] = (counts[player.role] || 0) + 1;
      return counts;
    },
    { Hitter: 0, Pitcher: 0 },
  );

  return {
    source: "Unified player board",
    generatedAt: new Date().toISOString(),
    totalPlayers: players.length,
    roleCounts,
    boardCounts,
    note: options.note || "",
    players,
  };
}

function getActivePlayerBoard() {
  return state.playerBoard.payload;
}

function getAvailablePlayers() {
  return getActivePlayerBoard()?.data || [];
}

function findPlayerInCurrentPage(playerId = "") {
  return getAvailablePlayers().find((player) => player.id === playerId) || null;
}

function hasRichPlayerDetail(player = {}) {
  return Boolean(player && Object.keys(player.components || {}).length && (player.statCards || []).length);
}

function getFilteredPlayers() {
  return getAvailablePlayers();
}

function getPlayerPagination(filteredPlayers) {
  const payload = getActivePlayerBoard();
  const page = payload?.page || state.playerBoard.page || 1;
  const pageSize = payload?.pageSize || state.playerBoard.pageSize;
  const totalPages = payload?.totalPages || 1;
  const totalPlayers = payload?.totalPlayers || filteredPlayers.length;
  const startIndex = totalPlayers ? (page - 1) * pageSize : 0;
  const visiblePlayers = filteredPlayers;
  return {
    page,
    pageSize,
    totalPages,
    totalPlayers,
    startIndex,
    visiblePlayers,
  };
}

function getOverviewCoverage() {
  return state.overview.summary?.coverage || sourceChecksFallback;
}

function getBadgeValue(label, value) {
  return `<strong>${escapeHtml(label)}</strong> ${escapeHtml(value)}`;
}

function getOverviewMetrics() {
  const summary = state.overview.summary;
  if (!summary) {
    return buildMetricsFallback;
  }

  const school = summary.school || {};
  const latestResult = summary.latestResult;
  const nextGame = summary.nextGame;
  const verifiedPlayers = summary.latestBoxscore?.schoolTeam?.players || [];

  return [
    {
      label: "Verified school",
      value: school.name || "Toledo",
      note: school.long || "School identity came back clean from the NCAA school index.",
    },
    {
      label: "Latest result",
      value: latestResult ? schoolResultLabel(latestResult) : "Waiting",
      note: latestResult ? `${shortSummaryNote(latestResult)} - ${schoolPerspectiveLabel(latestResult)}` : "No recent Toledo result was found in the current search window.",
    },
    {
      label: "Next game",
      value: nextGame ? schoolPerspectiveLabel(nextGame) : "Waiting",
      note: nextGame ? `${shortSummaryNote(nextGame)} - ${schoolPerspectiveScore(nextGame)}` : "No upcoming Toledo game was found in the current search window.",
    },
    {
      label: "Verified players",
      value: String(verifiedPlayers.length || 0),
      note: "Latest Toledo boxscore returned player names and positions, which is enough to start wiring game-level player views.",
    },
  ];
}

function getPlayerSourceDefinitions() {
  return {
    [PLAYER_BOARD_SOURCES.UNIFIED]: {
      label: "Unified Player Board",
      eyebrow: "Main scouting view",
      summary:
        "This board merges Toledo season data with the broader free transfer-target pool. It is the main player universe for the baseball dashboard.",
      bestUse: "Use for everyday player scouting",
      caution: "Live backend is used for Games and Overview, not the Players board",
    },
  };
}

function getPlayerSourceDefinition(sourceKey = state.playerBoard.sourceKey) {
  return getPlayerSourceDefinitions()[sourceKey] || getPlayerSourceDefinitions()[PLAYER_BOARD_SOURCES.UNIFIED];
}

function renderPlayerProfileSnapshot(player, payload) {
  const sourceDefinition = getPlayerSourceDefinition();
  const boardContext = payload?.generatedAt
    ? `Updated ${new Date(payload.generatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : "Current board context";
  const sourceLine =
    player.sourceSummary ||
    payload?.source ||
    sourceDefinition.label;

  return `
    <div class="statSectionLabel">Profile snapshot</div>
    <div class="miniStatGrid playerProfileGrid">
      <div class="miniStatCard">
        <span>Team</span>
        <strong>${escapeHtml(player.school || "--")}</strong>
        <div class="detailListMeta">${escapeHtml(player.number ? `#${player.number}` : player.classYear || sourceLine)}</div>
      </div>
      <div class="miniStatCard">
        <span>Role / position</span>
        <strong>${escapeHtml(`${player.role} / ${player.position}`)}</strong>
        <div class="detailListMeta">${escapeHtml(player.metaLine || "Current board context")}</div>
      </div>
      <div class="miniStatCard">
        <span>Board</span>
        <strong>${escapeHtml(sourceDefinition.label)}</strong>
        <div class="detailListMeta">${escapeHtml(player.boardOrigins?.join(" • ") || sourceDefinition.bestUse)}</div>
      </div>
      <div class="miniStatCard">
        <span>Eval window</span>
        <strong>${escapeHtml(boardContext || "Current board")}</strong>
        <div class="detailListMeta">${escapeHtml(payload?.boardCoverage || sourceDefinition.caution)}</div>
      </div>
    </div>
    <div class="playerProfileContext">
      <strong>Why this profile looks this way</strong>
      <p class="detailText">${escapeHtml(sourceDefinition.summary)}</p>
      <div class="detailListMeta">${escapeHtml(sourceLine)}</div>
    </div>
  `;
}

function buildPlayerInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) {
    return "--";
  }
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function parseStatCardNumber(value) {
  if (value == null) {
    return Number.NaN;
  }
  const normalized = String(value).trim().replace(/,/g, "");
  if (!normalized || normalized === "--" || normalized === "N/A") {
    return Number.NaN;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getPlayerStatCardMap(player = {}) {
  const map = new Map();
  for (const card of player.statCards || []) {
    if (!card?.label) {
      continue;
    }
    map.set(card.label, card.value);
  }
  return map;
}

function readPlayerStatValue(player, labels = []) {
  const statMap = getPlayerStatCardMap(player);
  for (const label of labels) {
    const value = statMap.get(label);
    if (value != null && value !== "") {
      return value;
    }
  }
  return "";
}

function readPlayerStatNumber(player, labels = []) {
  for (const label of labels) {
    const numericValue = parseStatCardNumber(readPlayerStatValue(player, [label]));
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return Number.NaN;
}

function getPlayerComponentEntries(player = {}) {
  return Object.entries(player.components || {})
    .map(([label, value]) => [label, Number(value)])
    .filter(([, value]) => Number.isFinite(value))
    .sort((left, right) => right[1] - left[1]);
}

function getPlayerRadarEntries(player = {}) {
  return Object.entries(player.components || {})
    .map(([label, value]) => [label, Number(value)])
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, 5);
}

function getRadarLabelShort(label = "") {
  return (
    {
      "On-base": "On-Base",
      Power: "Power",
      Contact: "Contact",
      Discipline: "Discipline",
      Speed: "Speed",
      Production: "Production",
      "Base pressure": "Pressure",
      Impact: "Impact",
      Defense: "Defense",
      "Run prevention": "Run Prev",
      "Traffic control": "Traffic",
      "Miss bats": "Miss Bats",
      Command: "Command",
      "Damage suppression": "Damage",
      Workload: "Workload",
      Results: "Results",
      "Result value": "Results",
    }[label] || label
  );
}

function buildRadarPolygonPoints(entries, centerX, centerY, radius, scaleFactor = 1) {
  const angleStep = (Math.PI * 2) / Math.max(entries.length, 1);
  return entries
    .map(([, value], index) => {
      const angle = -Math.PI / 2 + angleStep * index;
      const scaledRadius = radius * scaleFactor * clamp(Number(value) / 100, 0, 1);
      const x = centerX + Math.cos(angle) * scaledRadius;
      const y = centerY + Math.sin(angle) * scaledRadius;
      return `${roundTo(x, 1)},${roundTo(y, 1)}`;
    })
    .join(" ");
}

function renderRadarAxisLabel(label, index, count, centerX, centerY, radius) {
  const angle = -Math.PI / 2 + ((Math.PI * 2) / Math.max(count, 1)) * index;
  const labelRadius = radius + 26;
  const x = centerX + Math.cos(angle) * labelRadius;
  const y = centerY + Math.sin(angle) * labelRadius;
  const anchor = Math.abs(Math.cos(angle)) < 0.18 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
  const lines = getRadarLabelShort(label).split(" ");
  const startY = y - ((lines.length - 1) * 6);

  return `
    <text x="${roundTo(x, 1)}" y="${roundTo(startY, 1)}" text-anchor="${anchor}" class="playerRadarLabel">
      ${lines
        .map(
          (line, lineIndex) =>
            `<tspan x="${roundTo(x, 1)}" dy="${lineIndex === 0 ? 0 : 12}">${escapeHtml(line)}</tspan>`,
        )
        .join("")}
    </text>
  `;
}

function renderPlayerRadarChart(player = {}) {
  const entries = getPlayerRadarEntries(player);
  if (!entries.length) {
    return `
      <div class="playerRadarEmpty">
        <div class="statusNote">Radar chart unavailable until the profile has component grades.</div>
      </div>
    `;
  }

  const centerX = 180;
  const centerY = 170;
  const radius = 108;
  const levels = [0.25, 0.5, 0.75, 1];
  const angleStep = (Math.PI * 2) / Math.max(entries.length, 1);

  const axisLines = entries
    .map((_, index) => {
      const angle = -Math.PI / 2 + angleStep * index;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      return `<line x1="${centerX}" y1="${centerY}" x2="${roundTo(x, 1)}" y2="${roundTo(y, 1)}" class="playerRadarAxis" />`;
    })
    .join("");

  const gridPolygons = levels
    .map((level, index) => {
      const points = buildRadarPolygonPoints(entries, centerX, centerY, radius, level);
      return `<polygon points="${points}" class="playerRadarGrid ${index === levels.length - 1 ? "is-outer" : ""}" />`;
    })
    .join("");

  const dataPolygon = buildRadarPolygonPoints(entries, centerX, centerY, radius, 1);
  const labels = entries
    .map(([label], index) => renderRadarAxisLabel(label, index, entries.length, centerX, centerY, radius))
    .join("");

  const averageScore = Math.round(
    entries.reduce((sum, [, value]) => sum + Number(value), 0) / Math.max(entries.length, 1),
  );
  const sortedValues = entries.map(([, value]) => Number(value)).sort((a, b) => b - a);
  const spread = Math.round((sortedValues[0] || 0) - (sortedValues[sortedValues.length - 1] || 0));
  const shapeLabel = spread <= 16 ? "Balanced" : spread <= 30 ? "Leaning" : "Spiky";

  return `
    <div class="playerRadarWrap">
      <div class="playerRadarSvgShell">
        <svg viewBox="0 0 360 340" class="playerRadarSvg" aria-label="${escapeHtml(player.name || "Player")} profile radar chart">
          <defs>
            <linearGradient id="playerRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFD200" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#244f8f" stop-opacity="0.72" />
            </linearGradient>
          </defs>
          ${gridPolygons}
          ${axisLines}
          <polygon points="${dataPolygon}" class="playerRadarDataFill" />
          <polygon points="${dataPolygon}" class="playerRadarDataStroke" />
          ${entries
            .map(([, value], index) => {
              const angle = -Math.PI / 2 + angleStep * index;
              const scaledRadius = radius * clamp(Number(value) / 100, 0, 1);
              const x = centerX + Math.cos(angle) * scaledRadius;
              const y = centerY + Math.sin(angle) * scaledRadius;
              return `<circle cx="${roundTo(x, 1)}" cy="${roundTo(y, 1)}" r="4.5" class="playerRadarPoint" />`;
            })
            .join("")}
          ${labels}
        </svg>
      </div>
      <div class="playerRadarLegend">
        <div class="playerRadarLegendKpis">
          <div class="playerRadarLegendKpi">
            <span>Average grade</span>
            <strong>${averageScore}/100</strong>
          </div>
          <div class="playerRadarLegendKpi">
            <span>Profile shape</span>
            <strong>${shapeLabel}</strong>
          </div>
        </div>
        <div class="playerRadarLegendRows">
          ${entries
            .map(
              ([label, value]) => `
                <div class="playerRadarLegendRow">
                  <span>${escapeHtml(label)}</span>
                  <strong>${Math.round(value)}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function getPlayerCoverageRead(player = {}) {
  const boardOrigins = player.boardOrigins || [];
  const rosterOnly = (player.detailBadges || []).some((badge) => /roster-only/i.test(String(badge)));
  if (rosterOnly) {
    return "Roster-only coverage";
  }
  if (boardOrigins.includes("National API board")) {
    return "National benchmark coverage";
  }
  if (boardOrigins.includes("NCAA boxscore pool")) {
    return "Tracked game coverage";
  }
  if (boardOrigins.includes("Toledo season roster")) {
    return "Season roster coverage";
  }
  return boardOrigins[0] || "Unified board coverage";
}

function buildPlayerArchetype(player = {}) {
  const role = player.role === "Pitcher" ? "Pitcher" : "Hitter";
  const components = Object.fromEntries(getPlayerComponentEntries(player));
  const onBase = Number(components["On-base"] ?? components["Base pressure"] ?? 0);
  const impact = Number(components.Impact ?? components.Power ?? 0);
  const contact = Number(components.Contact ?? components.Production ?? 0);
  const speed = Number(components.Speed ?? 0);
  const discipline = Number(components.Discipline ?? 0);
  const defense = Number(components.Defense ?? 0);
  const runPrevention = Number(components["Run prevention"] ?? 0);
  const missBats = Number(components["Miss bats"] ?? 0);
  const command = Number(components.Command ?? 0);
  const traffic = Number(components["Traffic control"] ?? 0);
  const workload = Number(components.Workload ?? components.Results ?? components["Result value"] ?? 0);

  if (role === "Hitter") {
    if (impact >= 72 && onBase >= 62) {
      return {
        title: "Impact bat",
        note: "Profiles like a middle-order hitter who can do damage without being an empty-power profile.",
        usage: "Best used as a lineup bat you expect to create run-scoring swings, not just fill a defensive spot.",
      };
    }
    if (onBase >= 74 && (discipline >= 65 || speed >= 60)) {
      return {
        title: "Table setter",
        note: "Gets on base, keeps at-bats under control, and can pressure defenses before the middle of the order hits.",
        usage: "Most useful near the top of the lineup or as a pace-setter in a contact-heavy offense.",
      };
    }
    if (contact >= 68 && speed >= 58) {
      return {
        title: "Pressure-contact bat",
        note: "Wins with contact quality, pace, and enough athletic pressure to help the offense in multiple ways.",
        usage: "Useful when coaches want a playable bat that can move runners and stress defenders.",
      };
    }
    if (defense >= 68 && onBase >= 54) {
      return {
        title: "Two-way regular",
        note: "Not built around one loud carrying tool, but stable enough across phases to support winning lineups.",
        usage: "Projects as a steady everyday piece if the defensive home is real.",
      };
    }
    return {
      title: "Development bat",
      note: "The profile has one or two workable traits, but the complete offensive shape still needs more certainty.",
      usage: "More watch-list than plug-and-play until one carrying offensive trait shows up consistently.",
    };
  }

  if (missBats >= 74 && command >= 62) {
    return {
      title: "Bat-missing strike thrower",
      note: "This is the kind of arm coaches trust because the stuff misses bats and the control profile does not fight the outing.",
      usage: "Can work in real leverage and is worth pursuing quickly if the role fit checks out.",
    };
  }
  if (runPrevention >= 72 && traffic >= 66) {
    return {
      title: "Run suppressor",
      note: "Limits damage, keeps traffic manageable, and looks built to stay on the mound rather than nibble through trouble.",
      usage: "Fits staffs that need dependable innings more than pure radar-gun upside.",
    };
  }
  if (workload >= 62 && runPrevention >= 55) {
    return {
      title: "Starter-volume profile",
      note: "Carries enough workload shape to matter across a weekend, even if the pure swing-and-miss ceiling is still developing.",
      usage: "Useful when Toledo needs stability and series innings more than one-inning flash.",
    };
  }
  if (missBats >= 68 && workload < 52) {
    return {
      title: "Late-inning arm",
      note: "The miss-bat trait is the carrying tool, which usually translates best in shorter bursts or leverage pockets.",
      usage: "Projects best in relief unless command and workload both take a step.",
    };
  }
  return {
    title: "Pitching depth profile",
    note: "There are workable ingredients here, but coaches would still want role clarity before treating this as a rotation or leverage lock.",
    usage: "More role-dependent than certainty-driven right now.",
  };
}

function buildPlayerCoachCards(player = {}, payload = null) {
  const components = getPlayerComponentEntries(player);
  const strongest = components[0];
  const support = components[1];
  const weakest = components[components.length - 1];
  const archetype = buildPlayerArchetype(player);
  const coverageRead = getPlayerCoverageRead(player);
  const hasRecentTrend = Boolean(player.recentTrend?.gamesTracked);
  const hasLatestImpact = Boolean(player.latestGameImpact?.impactScore);
  const coverageWarning = coverageRead === "Roster-only coverage";

  const watchText = coverageWarning
    ? "This player is visible in roster data, but coaches still need game or season-stat confirmation before treating the score as a real recruiting signal."
    : weakest
      ? `${weakest[0]} is the softest part of the profile right now, so that is the first place to pressure-test on video or live eval.`
      : "There is not enough tracked data yet to isolate a clear soft spot.";

  const nextStepText =
    player.role === "Pitcher"
      ? hasLatestImpact
        ? "Cross-check the recent outing notes against season command and role usage before pushing this arm up the board."
        : "Verify whether the arm is a starter, bulk option, or leverage reliever before assigning Toledo value."
      : hasRecentTrend
        ? "Check whether the recent trend matches the season offensive shape before treating this as a sustainable bat."
        : "Validate defensive home and offensive role together so the bat is not being graded in a vacuum.";

  return [
    {
      label: "Profile type",
      title: archetype.title,
      text: archetype.note,
    },
    {
      label: "Best translation",
      title: strongest ? `${strongest[0]} first` : "Traits still thin",
      text: strongest
        ? `${COMPONENT_HELP[strongest[0]] || strongest[0]} drives the profile now${support ? `, with ${support[0].toLowerCase()} as the support tool.` : "."}`
        : "There is not enough tracked performance to name a clear carrying tool yet.",
    },
    {
      label: "Coach watch",
      title: weakest ? weakest[0] : "Coverage check",
      text: watchText,
    },
    {
      label: "Next eval step",
      title: coverageRead,
      text: `${nextStepText}${payload?.boardCoverage ? ` Board context: ${payload.boardCoverage}.` : ""}`,
    },
  ];
}

function buildPlayerInsightCards(player = {}) {
  const components = getPlayerComponentEntries(player);
  const strongest = components[0];
  const support = components[1];
  const weakest = components[components.length - 1];
  const coverageRead = getPlayerCoverageRead(player);

  return [
    {
      label: "Top tool",
      value: strongest ? `${strongest[0]} ${Math.round(strongest[1])}/100` : "Awaiting data",
      note: strongest ? COMPONENT_HELP[strongest[0]] || strongest[0] : "No component grades were returned.",
    },
    {
      label: "Support tool",
      value: support ? `${support[0]} ${Math.round(support[1])}/100` : "Thin sample",
      note: support ? COMPONENT_HELP[support[0]] || support[0] : "A second dependable trait has not separated yet.",
    },
    {
      label: "Watch item",
      value: weakest ? `${weakest[0]} ${Math.round(weakest[1])}/100` : "Coverage review",
      note: weakest ? `This is the softest piece of the profile today.` : "Start by verifying role and workload.",
    },
    {
      label: "Coverage",
      value: coverageRead,
      note: player.sourceSummary || "Unified player board",
    },
  ];
}

function renderPlayerProfileBody(player, payload, mode) {
  const coachCards = buildPlayerCoachCards(player, payload);
  const insightCards = buildPlayerInsightCards(player);

  return `
    <section class="playerProfileHero">
      <article class="playerProfileHeroCard">
        <div class="playerProfileHeroTop">
          <div>
            <p class="eyebrow">${escapeHtml(player.role === "Pitcher" ? "Pitcher profile" : "Hitter profile")}</p>
            <h3 class="playersPanelTitle">${escapeHtml(player.name)}</h3>
            <div class="detailListMeta">${escapeHtml([player.school, player.role, player.position].filter(Boolean).join(" / "))}</div>
          </div>
          <div class="playerProfileScoreStack">
            <span class="scoreBadge scoreBadgeLarge">${escapeHtml(player.score)}</span>
            <span class="fitChip ${player.fit.className}">${escapeHtml(player.fit.label)}</span>
          </div>
        </div>
        <p class="playerProfileHeroSummary">${escapeHtml(player.summary || "Player summary unavailable.")}</p>
        <div class="detailMeta">
          ${(player.detailBadges || [])
            .map((badge) => `<span>${escapeHtml(badge)}</span>`)
            .join("")}
        </div>
      </article>
      <article class="playerProfileHeroCard">
        <div class="playerProfileSectionTitle">Profile shape</div>
        ${renderPlayerRadarChart(player)}
        <div class="playerProfileSectionTitle">Coach translation</div>
        <div class="playerProfileInsightGrid">
          ${insightCards
            .map(
              (card) => `
                <div class="playerProfileInsightCard">
                  <span>${escapeHtml(card.label)}</span>
                  <strong>${escapeHtml(card.value)}</strong>
                  <small>${escapeHtml(card.note)}</small>
                </div>
              `,
            )
            .join("")}
        </div>
      </article>
    </section>

    <section class="playerProfileCoachGrid">
      ${coachCards
        .map(
          (card) => `
            <article class="playerProfileCoachCard">
              <div class="playerProfileCoachLabel">${escapeHtml(card.label)}</div>
              <div class="playerProfileCoachTitle">${escapeHtml(card.title)}</div>
              <div class="playerProfileCoachText">${escapeHtml(card.text)}</div>
            </article>
          `,
        )
        .join("")}
    </section>

    <section class="playerProfileSection">
      ${renderPlayerProfileSnapshot(player, payload)}
    </section>

    ${
      player.statCards?.length
        ? `
          <section class="playerProfileSection">
            <div class="playerProfileSectionTitle">Key stats</div>
            <div class="playerStatGrid">
              ${player.statCards
                .map(
                  (card) => `
                    <div class="playerStatCard">
                      <span>${escapeHtml(STAT_LABEL_MAP[card.label] || card.label)}</span>
                      <strong>${escapeHtml(card.value)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
        `
        : ""
    }

    <section class="playerProfileSection">
      <div class="playerProfileSectionTitle">Score breakdown</div>
      <div class="breakdownList">
        ${Object.entries(player.components || {})
          .map(
            ([label, value]) => `
              <div class="breakdownRow">
                <header>
                  <span>${escapeHtml(label)}${COMPONENT_HELP[label] ? ` <span class="breakdownHelp">${escapeHtml(COMPONENT_HELP[label])}</span>` : ""}</span>
                  <strong>${Math.round(value)}/100</strong>
                </header>
                <div class="breakdownTrack">
                  <div class="breakdownFill" style="width:${Math.round(value)}%"></div>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>

    ${renderPlayerImpactSections(player, payload, mode)}

    <section class="playerProfileSourceBlock">
      <div class="detailSummaryTop">
        <strong>${escapeHtml(player.score)}/100</strong>
        <span class="fitChip ${player.fit.className} fitChipSmall">${escapeHtml(player.fit.label)}</span>
      </div>
      <p class="detailText">${escapeHtml(FIT_EXPLANATIONS[player.fit.label] || player.fit.label)}</p>
      <div class="detailListMeta">${escapeHtml((player.summaryMetrics || []).join(" / "))}</div>
      ${player.sourceSummary ? `<div class="detailText">${escapeHtml(player.sourceSummary)}</div>` : ""}
    </section>
  `;
}

function setPlayerProfileModalOpen(isOpen) {
  state.playerBoard.profileOpen = Boolean(isOpen);
  if (playerProfileModalBackEl) {
    playerProfileModalBackEl.classList.toggle("is-open", state.playerBoard.profileOpen);
    playerProfileModalBackEl.setAttribute("aria-hidden", state.playerBoard.profileOpen ? "false" : "true");
  }
  document.body.classList.toggle("modalOpen", state.playerBoard.profileOpen);
}

function closePlayerProfile() {
  setPlayerProfileModalOpen(false);
}

function openPlayerProfile(playerOrId) {
  const directPlayer =
    playerOrId && typeof playerOrId === "object" && !Array.isArray(playerOrId) ? playerOrId : null;
  const playerId = directPlayer?.id || String(playerOrId || "");
  if (!playerId) {
    return;
  }
  const playerFromPage = directPlayer || findPlayerInCurrentPage(playerId);
  state.selectedPlayerId = playerId;
  state.playerBoard.selectedPlayerError = "";
  if (playerFromPage) {
    state.playerBoard.selectedPlayerLoading = false;
    state.playerBoard.selectedPlayer = playerFromPage;
  }
  setPlayerProfileModalOpen(true);
  renderPlayerProfileModal();
  renderPlayers();
  if (hasRichPlayerDetail(playerFromPage)) {
    state.playerBoard.selectedPlayerLoading = false;
    renderPlayerProfileModal();
    return;
  }
  if (playerId === state.selectedPlayerId && state.playerBoard.selectedPlayer?.id === playerId && !playerFromPage) {
    renderPlayers();
    return;
  }
  loadPlayerDetail(playerId);
}

function renderPlayerProfileModal() {
  if (!playerProfileModalBackEl || !playerProfileModalBodyEl) {
    return;
  }

  if (!state.playerBoard.profileOpen) {
    setPlayerProfileModalOpen(false);
    return;
  }

  const payload = getActivePlayerBoard();
  const tablePlayer = (payload?.data || []).find((player) => player.id === state.selectedPlayerId) || null;
  const selectedPlayer = state.playerBoard.selectedPlayer || tablePlayer;
  const headerPlayer = selectedPlayer || tablePlayer;

  setPlayerProfileModalOpen(true);

  if (!headerPlayer) {
    playerProfileModalEyebrowEl.textContent = "Player profile";
    playerProfileModalTitleEl.textContent = "Player";
    playerProfileModalSubEl.textContent = "Profile unavailable";
    playerProfileModalMetaEl.innerHTML = "";
    playerProfileAvatarEl.textContent = "--";
    playerProfileModalBodyEl.innerHTML = '<div class="statusNote">Select a player to open the profile card.</div>';
    playerProfileModalLinkEl.hidden = true;
    return;
  }

  playerProfileModalEyebrowEl.textContent = headerPlayer.role === "Pitcher" ? "Pitcher profile" : "Hitter profile";
  playerProfileModalTitleEl.textContent = headerPlayer.name || "Player";
  playerProfileModalSubEl.textContent = [headerPlayer.school, headerPlayer.role, headerPlayer.position, headerPlayer.metaLine]
    .filter(Boolean)
    .join(" / ");
  playerProfileModalMetaEl.innerHTML = (headerPlayer.detailBadges || [])
    .slice(0, 6)
    .map((badge) => `<span>${escapeHtml(badge)}</span>`)
    .join("");

  if (headerPlayer.imageUrl) {
    playerProfileAvatarEl.innerHTML = `<img src="${escapeHtml(headerPlayer.imageUrl)}" alt="${escapeHtml(headerPlayer.name || "Player")}" loading="lazy" />`;
  } else {
    playerProfileAvatarEl.textContent = buildPlayerInitials(headerPlayer.name);
  }

  if (headerPlayer.profileUrl) {
    playerProfileModalLinkEl.hidden = false;
    playerProfileModalLinkEl.href = headerPlayer.profileUrl;
  } else {
    playerProfileModalLinkEl.hidden = true;
    playerProfileModalLinkEl.removeAttribute("href");
  }

  if (state.playerBoard.selectedPlayerLoading && !selectedPlayer) {
    playerProfileModalBodyEl.innerHTML = '<div class="statusNote">Loading player profile...</div>';
    return;
  }

  if (state.playerBoard.selectedPlayerError) {
    playerProfileModalBodyEl.innerHTML = `<div class="statusNote error">${escapeHtml(state.playerBoard.selectedPlayerError)}</div>`;
    return;
  }

  if (!selectedPlayer) {
    playerProfileModalBodyEl.innerHTML = '<div class="statusNote">Player detail is not available yet.</div>';
    return;
  }

  try {
    playerProfileModalBodyEl.innerHTML = renderPlayerProfileBody(selectedPlayer, payload, getPlayerBoardMode());
  } catch (error) {
    console.error("Failed to render player profile modal", error, selectedPlayer);
    const message = error instanceof Error ? error.message : String(error);
    playerProfileModalBodyEl.innerHTML = `<div class="statusNote error">We couldn't render this player profile yet. ${escapeHtml(message)}</div>`;
  }
}

function renderSourceChecks() {
  sourceListEl.innerHTML = getOverviewCoverage()
    .map(
      (item) => `
        <li>
          <b>${escapeHtml(item.label)}:</b> ${escapeHtml(item.value)}
        </li>
      `,
    )
    .join("");
}

function renderBuildMetrics() {
  metricGridEl.innerHTML = getOverviewMetrics()
    .map(
      (item) => `
        <article class="kpiCard">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p class="muted">${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");
}

function renderOverviewLiveSummary() {
  if (state.overview.loading) {
    liveWindowEl.innerHTML = '<div class="statusNote">Checking Toledo scoreboard and boxscore endpoints...</div>';
    toledoIdentityEl.innerHTML = '<div class="statusNote">Checking Toledo school identity...</div>';
    verifiedPlayersEl.innerHTML = '<div class="statusNote">Checking latest Toledo player names...</div>';
    return;
  }

  if (state.overview.error) {
    const isUpstream = /temporarily unavailable|timed out|NCAA data feed/i.test(state.overview.error);
    const errorMsg = isUpstream
      ? "Live data is temporarily down — the NCAA data feed is unreachable. Check back in a few minutes."
      : "Live worker not reachable. Make sure the local Worker is running (wrangler dev).";
    liveWindowEl.innerHTML = `
      <div class="statusNote error">${escapeHtml(errorMsg)}</div>
      <button class="retryBtn" type="button" data-action="retry-overview">Try again</button>
    `;
    toledoIdentityEl.innerHTML = `
      <div class="statusNote error">${escapeHtml(errorMsg)}</div>
      <div class="statusNote">The rest of the dashboard is still available while data loads.</div>
    `;
    verifiedPlayersEl.innerHTML =
      '<div class="statusNote">Player names will appear here once the data feed is reachable.</div>';
    return;
  }

  const summary = state.overview.summary || {};
  const school = summary.school || {};
  const latestBoxscore = summary.latestBoxscore || {};
  const schoolTeam = latestBoxscore.schoolTeam || {};
  const verifiedPlayers = (schoolTeam.players || []).slice(0, 8);
  const recentGames = (summary.recentGames || []).slice(-2);
  const upcomingGames = (summary.upcomingGames || []).slice(0, 3);
  const displayGames = [...recentGames, ...upcomingGames];

  toledoIdentityEl.innerHTML = `
    <div class="identityHeader">
      <div>
        <div class="identityEyebrow">Toledo Rockets Baseball</div>
        <div class="identityName">${escapeHtml(school.long || school.name || "Toledo")}</div>
      </div>
      <span class="identitySlug">${escapeHtml(school.slug || DEFAULT_SCHOOL_SLUG)}</span>
    </div>
    <div class="identityRows">
      <div class="identityRow">
        <span>Short name</span>
        <strong>${escapeHtml(school.name || "Toledo")}</strong>
      </div>
      <div class="identityRow">
        <span>Latest tracked game</span>
        <strong>${escapeHtml(
          latestBoxscore.sourceGame
            ? `${latestBoxscore.sourceGame.date} \u2014 ${latestBoxscore.sourceGame.title}`
            : "No boxscore yet",
        )}</strong>
      </div>
    </div>
  `;

  liveWindowEl.innerHTML = displayGames.length
    ? displayGames
        .map(
          (game) => `
            <article class="liveGameCard">
              <div class="liveGameTop">
                <span class="liveState ${gameStateClass(game.gameState)}">${escapeHtml(game.gameState || "unknown")}</span>
                <span class="playerMeta">${escapeHtml(game.date)}</span>
              </div>
              <div class="liveGameTitle">${escapeHtml(schoolPerspectiveLabel(game))}</div>
              <div class="liveGameMeta">
                <span>${escapeHtml(schoolPerspectiveScore(game))}</span>
                <span>${escapeHtml(game.startTime || game.currentPeriod || "TBD")}</span>
              </div>
            </article>
          `,
        )
        .join("")
    : '<div class="emptyState">No Toledo games were returned in the current date window.</div>';

  verifiedPlayersEl.innerHTML = verifiedPlayers.length
    ? `
      <div class="verifiedMeta">${escapeHtml(latestBoxscore.modeLabel || "Latest verified Toledo boxscore")}</div>
      <div class="verifiedPlayerGrid">
        ${verifiedPlayers
          .map(
            (player) => `
              <div class="verifiedPlayerChip">
                <strong>${escapeHtml(player.name)}</strong>
                <span>${escapeHtml(`${player.position || "UTIL"} #${player.number || "--"}`)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    `
    : '<div class="emptyState">No Toledo player names came back from the latest boxscore lookup.</div>';
}

function renderTopBadges() {
  const summary = state.overview.summary;
  if (!summary) {
    schoolBadgeEl.innerHTML = getBadgeValue("School", "Toledo");
    sourceBadgeEl.innerHTML = getBadgeValue("Primary source", LIVE_API_ENABLED ? "NCAA-backed" : "Static-first");
    latestResultBadgeEl.innerHTML = getBadgeValue(
      "Latest",
      state.overview.loading ? "Checking live feed" : LIVE_API_ENABLED ? "Worker offline" : "Backend optional",
    );
    nextGameBadgeEl.innerHTML = getBadgeValue(
      "Next",
      state.overview.loading ? "Checking live feed" : LIVE_API_ENABLED ? "Worker offline" : "Backend optional",
    );
    return;
  }

  schoolBadgeEl.innerHTML = getBadgeValue("School", summary.school?.name || "Toledo");
  sourceBadgeEl.innerHTML = getBadgeValue("Primary source", "NCAA wrapper");
  latestResultBadgeEl.innerHTML = getBadgeValue(
    "Latest",
    summary.latestResult ? `${schoolResultLabel(summary.latestResult)} ${schoolPerspectiveLabel(summary.latestResult)}` : "No recent result",
  );
  nextGameBadgeEl.innerHTML = getBadgeValue(
    "Next",
    summary.nextGame ? `${schoolPerspectiveLabel(summary.nextGame)} ${summary.nextGame.startTime || ""}`.trim() : "No upcoming game",
  );
}

function getPlayerBoardMode() {
  return {
    isUnified: true,
    isLiveSchool: false,
    scopeLabel: "Coverage: Unified player board",
    sourceLabel: "Sources: stored universe + national API",
    loadingLabel: "Loading full player universe...",
    waitingLabel: "Unified player board waiting",
    waitingNote:
      "The Players tab is the main scouting board. It reads from the backend player-universe service rather than a frontend-only dataset.",
    loadingText:
      "Loading the backend player universe with server-side search, sorting, and pagination.",
    errorText:
      "The backend player universe could not load, so the Players screen cannot show full player profiles right now.",
    readyText:
      "Full player universe loaded. Search by player or school, filter hitters or pitchers, and click any row to open the full player profile card.",
    defaultFootnote:
      "This board is served from the backend player universe so the browser only loads one page of players at a time, while profiles open in a separate card.",
    placeholder: "Search player, school, or position...",
  };
}

function formatCoverageNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function renderPlayerCoverage() {
  if (!playerCoverageSummaryEl || !playerCoverageGridEl) {
    return;
  }

  const payload = state.playerBoard.coverage;

  if (state.playerBoard.coverageLoading && !payload) {
    playerCoverageSummaryEl.innerHTML = '<div class="statusNote">Loading school coverage snapshot...</div>';
    playerCoverageGridEl.innerHTML = "";
    return;
  }

  if (state.playerBoard.coverageError) {
    playerCoverageSummaryEl.innerHTML = `<div class="statusNote error">${escapeHtml(state.playerBoard.coverageError)}</div>`;
    playerCoverageGridEl.innerHTML = "";
    return;
  }

  if (!payload) {
    playerCoverageSummaryEl.innerHTML = '<div class="statusNote">Coverage snapshot has not loaded yet.</div>';
    playerCoverageGridEl.innerHTML = "";
    return;
  }

  const summary = payload.summary || {};
  playerCoverageSummaryEl.innerHTML = `
    <div class="playerCoverageKpis">
      <article class="coverageKpi">
        <span class="coverageKpiLabel">Full roster schools</span>
        <strong class="coverageKpiValue">${formatCoverageNumber(summary.fullRosterSchools)}</strong>
        <span class="coverageKpiMeta">Schools with school-site roster coverage.</span>
      </article>
      <article class="coverageKpi">
        <span class="coverageKpiLabel">Boxscore only</span>
        <strong class="coverageKpiValue">${formatCoverageNumber(summary.boxscoreOnlySchools)}</strong>
        <span class="coverageKpiMeta">Schools only visible through tracked NCAA boxscores.</span>
      </article>
      <article class="coverageKpi">
        <span class="coverageKpiLabel">Leaderboard only</span>
        <strong class="coverageKpiValue">${formatCoverageNumber(summary.leaderboardOnlySchools)}</strong>
        <span class="coverageKpiMeta">Schools that only surface through NCAA leaderboard rows.</span>
      </article>
      <article class="coverageKpi">
        <span class="coverageKpiLabel">Covered schools</span>
        <strong class="coverageKpiValue">${formatCoverageNumber(summary.totalCoveredSchools)}</strong>
        <span class="coverageKpiMeta">Unified school footprint across every current source.</span>
      </article>
    </div>
    <div class="playerCoverageMeta">${escapeHtml(payload.boardCoverage || state.playerBoard.payload?.boardCoverage || "")}</div>
  `;

  const schools = payload.schools || [];
  playerCoverageGridEl.innerHTML = schools.length
    ? schools
        .map(
          (school) => `
            <article class="coverageSchoolRow">
              <div class="coverageSchoolMain">
                <div class="coverageSchoolTitle">${escapeHtml(school.name)}</div>
                <div class="coverageSchoolMeta">${escapeHtml(school.longName || school.name)}</div>
                <div class="coverageSchoolMeta">${escapeHtml(school.sourceNote || school.sourceSummary || "")}</div>
              </div>
              <div class="coverageSchoolStats">
                <span>${formatCoverageNumber(school.universePlayers)} merged players</span>
                <span>${formatCoverageNumber(school.playerCounts?.fullRoster)} roster</span>
                <span>${formatCoverageNumber(school.playerCounts?.boxscore)} boxscore</span>
                <span>${formatCoverageNumber(school.playerCounts?.leaderboard)} leaderboard</span>
              </div>
              <div class="coverageSchoolSources">
                <span class="coverageStatusChip is-${escapeHtml(school.status)}">${escapeHtml(school.statusLabel)}</span>
                ${(school.sources || [])
                  .map((source) => `<span class="coverageSourceChip">${escapeHtml(source)}</span>`)
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")
    : '<div class="statusNote">No school coverage snapshot is available yet.</div>';
}

function renderPlayerBoardMeta() {
  const payload = getActivePlayerBoard();
  const mode = getPlayerBoardMode();

  if (state.playerBoard.loading && !payload) {
    playersPanelSubEl.textContent = mode.loadingText;
    playerResultsMetaEl.textContent = mode.loadingLabel;
    playersFootnoteEl.textContent = mode.defaultFootnote;
    playerPagePrevEl.disabled = true;
    playerPageNextEl.disabled = true;
    return;
  }

  if (state.playerBoard.error) {
    playersPanelSubEl.textContent = mode.errorText;
    playerResultsMetaEl.textContent = "Unified player board unavailable";
    playersFootnoteEl.textContent = state.playerBoard.error;
    playerPagePrevEl.disabled = true;
    playerPageNextEl.disabled = true;
    return;
  }

  if (!payload) {
    playersPanelSubEl.textContent = "Waiting for the unified player board.";
    playerResultsMetaEl.textContent = mode.waitingLabel;
    playersFootnoteEl.textContent = mode.waitingNote;
    playerPagePrevEl.disabled = true;
    playerPageNextEl.disabled = true;
    return;
  }

  const roleCounts = payload.roleCounts || { Hitter: 0, Pitcher: 0 };

  playersPanelSubEl.textContent = mode.readyText;
  playerResultsMetaEl.textContent = `${payload.totalPlayers || payload.playerCount || 0} players (${roleCounts.Hitter || 0} hitters / ${
    roleCounts.Pitcher || 0
  } pitchers)`;
  playersFootnoteEl.textContent = payload.note || mode.defaultFootnote;
  playerSearchEl.placeholder = mode.placeholder;
}

function renderPlayers() {
  renderPlayerBoardMeta();
  renderPlayerCoverage();
  const mode = getPlayerBoardMode();

  if (state.playerBoard.loading && !state.playerBoard.payload) {
    playerTableBodyEl.innerHTML =
      '<tr><td colspan="6"><div class="tableStatus">Loading the backend player universe and the first page of players...</div></td></tr>';
    renderPlayerProfileModal();
    return;
  }

  if (state.playerBoard.error) {
    playerTableBodyEl.innerHTML = `<tr><td colspan="6"><div class="tableStatus error">${escapeHtml(
      state.playerBoard.error,
    )}</div></td></tr>`;
    renderPlayerProfileModal();
    return;
  }

  const filteredPlayers = getFilteredPlayers();
  const pagination = getPlayerPagination(filteredPlayers);
  const visiblePlayers = pagination.visiblePlayers;

  playerResultsMetaEl.textContent = pagination.totalPlayers
    ? `${pagination.startIndex + 1}-${pagination.startIndex + visiblePlayers.length} of ${pagination.totalPlayers} players`
    : "0 players";
  playerPagePrevEl.disabled = pagination.page <= 1;
  playerPageNextEl.disabled = pagination.page >= pagination.totalPages;

  if (!filteredPlayers.length) {
    const emptyReason = getActivePlayerBoard()?.totalPlayers
      ? `No ${state.roleFilter.toLowerCase()}s match the current search or filter.`
      : "No players were returned yet.";
    playerTableBodyEl.innerHTML = `<tr><td colspan="6"><div class="tableStatus">${escapeHtml(emptyReason)}</div></td></tr>`;
    renderPlayerProfileModal();
    return;
  }

  playerTableBodyEl.innerHTML = visiblePlayers
    .map(
      (player) => `
        <tr
          data-player-id="${escapeHtml(player.id)}"
          class="${player.id === state.selectedPlayerId ? "is-selected" : ""}"
          tabindex="0"
          role="button"
          aria-label="Open profile for ${escapeHtml(player.name)}"
        >
          <td>
            <div class="playerNameCell">
              <strong>${escapeHtml(player.name)}</strong>
              <span class="playerMeta">${escapeHtml(player.metaLine || player.summaryMetrics?.[0] || "")}</span>
            </div>
          </td>
          <td>${escapeHtml(player.school || "--")}</td>
          <td>${escapeHtml(player.role)}</td>
          <td>${escapeHtml(player.position)}</td>
          <td><span class="scoreBadge">${escapeHtml(player.score)}</span></td>
          <td><span class="fitChip ${player.fit.className}">${escapeHtml(player.fit.label)}</span></td>
        </tr>
      `,
    )
    .join("");

  const selectedPlayer = state.playerBoard.selectedPlayer || null;
  const payload = getActivePlayerBoard();

  if (playerProfileModalBodyEl) {
    renderPlayerProfileModal();
    return;
  }

  playerDetailEl.innerHTML = `
    <div class="detailTopline">
      <div>
        <p class="eyebrow">${escapeHtml(selectedPlayer.role === "Pitcher" ? "Pitcher" : "Hitter")}</p>
        <h3 class="playersPanelTitle">${escapeHtml(selectedPlayer.name)}</h3>
        <p class="detailText">${escapeHtml(selectedPlayer.summary)}</p>
      </div>
      <div class="detailScoreRail">
        <span class="scoreBadge scoreBadgeLarge">${escapeHtml(selectedPlayer.score)}</span>
        <span class="fitChip ${selectedPlayer.fit.className}">${escapeHtml(selectedPlayer.fit.label)}</span>
      </div>
    </div>
    <div class="detailMeta">
      ${(selectedPlayer.detailBadges || [])
        .map((badge) => `<span>${escapeHtml(badge)}</span>`)
        .join("")}
    </div>
    ${renderPlayerProfileSnapshot(selectedPlayer, payload)}
    ${
      selectedPlayer.statCards?.length
        ? `
          <div class="statSectionLabel">Key stats</div>
          <div class="playerStatGrid">
            ${selectedPlayer.statCards
              .map(
                (card) => `
                  <div class="playerStatCard">
                    <span>${escapeHtml(STAT_LABEL_MAP[card.label] || card.label)}</span>
                    <strong>${escapeHtml(card.value)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }
    <div class="statSectionLabel">Score breakdown</div>
    <div class="breakdownList">
      ${Object.entries(selectedPlayer.components)
        .map(
          ([label, value]) => `
            <div class="breakdownRow">
              <header>
                <span>${escapeHtml(label)}${COMPONENT_HELP[label] ? ` <span class="breakdownHelp">${escapeHtml(COMPONENT_HELP[label])}</span>` : ""}</span>
                <strong>${Math.round(value)}/100</strong>
              </header>
              <div class="breakdownTrack">
                <div class="breakdownFill" style="width:${Math.round(value)}%"></div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
    ${renderPlayerImpactSections(selectedPlayer, payload, mode)}
    <div class="detailSummary">
      <div class="detailSummaryTop">
        <strong>${escapeHtml(selectedPlayer.score)}/100</strong>
        <span class="fitChip ${selectedPlayer.fit.className} fitChipSmall">${escapeHtml(selectedPlayer.fit.label)}</span>
      </div>
      <p class="detailText">${escapeHtml(FIT_EXPLANATIONS[selectedPlayer.fit.label] || selectedPlayer.fit.label)}</p>
      <div class="detailListMeta">${escapeHtml(selectedPlayer.summaryMetrics.join(" · "))}</div>
    </div>
  `;
}

function renderTargets() {
  targetGridEl.innerHTML = targetArchetypes
    .map(
      (target) => `
        <article class="targetCard">
          <header>
            <div>
              <p class="eyebrow">Toledo Need</p>
              <h3>${escapeHtml(target.title)}</h3>
            </div>
            <span class="priority ${escapeHtml(target.priority)}">${escapeHtml(target.priority)}</span>
          </header>
          <dl>
            <dt>Fit</dt>
            <dd>${escapeHtml(target.fit)}</dd>
            <dt>Focus</dt>
            <dd>${escapeHtml(target.focus)}</dd>
            <dt>Thresholds</dt>
            <dd>${escapeHtml(target.thresholds)}</dd>
            <dt>Why it matters</dt>
            <dd>${escapeHtml(target.why)}</dd>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderSchoolSearchResults() {
  if (state.explorer.schoolsLoading && state.explorer.schools.length === 0) {
    schoolSearchMetaEl.textContent = "Loading real school options...";
    schoolResultsEl.innerHTML = '<div class="statusNote">Checking live school directory...</div>';
    return;
  }

  if (state.explorer.schoolsError) {
    schoolSearchMetaEl.textContent = "School search unavailable";
    const isUpstream = /temporarily unavailable|timed out|NCAA data feed/i.test(state.explorer.schoolsError);
    schoolResultsEl.innerHTML = `
      <div class="statusNote error">${isUpstream ? "School directory is temporarily unavailable — the NCAA data feed is down." : escapeHtml(state.explorer.schoolsError)}</div>
      <button class="retryBtn" type="button" data-action="retry-schools">Try again</button>
    `;
    return;
  }

  schoolSearchMetaEl.textContent = state.explorer.schoolQuery
    ? `Top ${state.explorer.schools.length} matches for "${state.explorer.schoolQuery}"`
    : "Featured schools from the current scoreboard window";

  const schools = [...state.explorer.schools];
  const selectedSchool = state.explorer.selectedSchoolSummary?.school;
  if (selectedSchool && !schools.some((school) => school.slug === selectedSchool.slug)) {
    schools.unshift(selectedSchool);
  }

  schoolResultsEl.innerHTML = schools.length
    ? schools
        .map(
          (school) => `
            <button
              class="schoolRow ${school.slug === state.explorer.selectedSchoolSlug ? "active" : ""}"
              type="button"
              data-school-slug="${escapeHtml(school.slug)}"
            >
              <div class="schoolRowTop">
                <div class="schoolRowMain">
                  <div class="schoolRowTitle">${escapeHtml(school.name)}</div>
                  <div class="schoolRowSlug">${escapeHtml(school.long || school.name)}</div>
                </div>
                <span class="identitySlug">${escapeHtml(school.slug)}</span>
              </div>
            </button>
          `,
        )
        .join("")
    : '<div class="statusNote">No schools matched this search yet.</div>';
}

function renderSelectedSchoolSummary() {
  if (state.explorer.selectedSchoolLoading) {
    selectedSchoolSummaryEl.innerHTML = '<div class="statusNote">Loading selected school summary...</div>';
    selectedSchoolMetaEl.textContent = "";
    selectedSchoolGamesEl.innerHTML = '<div class="statusNote">Checking recent and upcoming games...</div>';
    return;
  }

  if (state.explorer.selectedSchoolError) {
    selectedSchoolSummaryEl.innerHTML = `<div class="statusNote error">${escapeHtml(state.explorer.selectedSchoolError)}</div>`;
    selectedSchoolMetaEl.textContent = "";
    selectedSchoolGamesEl.innerHTML = '<div class="statusNote">No game window available for this school yet.</div>';
    return;
  }

  const summary = state.explorer.selectedSchoolSummary;
  if (!summary) {
    selectedSchoolSummaryEl.innerHTML = '<div class="statusNote">Select a school to inspect live data.</div>';
    selectedSchoolMetaEl.textContent = "";
    selectedSchoolGamesEl.innerHTML = "";
    return;
  }

  const school = summary.school || {};
  const latestBoxscore = summary.latestBoxscore || {};
  const schoolTeam = latestBoxscore.schoolTeam || {};
  const recentGames = summary.recentGames || [];
  const upcomingGames = summary.upcomingGames || [];
  const schoolPlayers = (schoolTeam.players || []).slice(0, 8);
  const batterTotals = schoolTeam.teamStats?.batterTotals || null;
  const pitcherTotals = schoolTeam.teamStats?.pitcherTotals || null;
  const recentForm = summary.recentForm || null;
  const standings = state.explorer.standings || null;
  const nextOpponentScout = state.explorer.opponentScout || null;
  const gameCards = [...recentGames.slice(-3), ...upcomingGames.slice(0, 4)];

  selectedSchoolMetaEl.textContent = `${summary.windowStart || ""} to ${summary.windowEnd || ""}`.trim();

  selectedSchoolSummaryEl.innerHTML = `
    <div class="schoolSummaryHeader">
      <div>
        <div class="identityEyebrow">Selected school</div>
        <div class="schoolSummaryTitle">${escapeHtml(school.long || school.name || "School")}</div>
        <div class="schoolSummarySub">
          Schedule, scores, and game details for ${escapeHtml(
            school.name || school.slug || "this school",
          )}. Click a game card below to see the box score and play-by-play breakdown.
        </div>
      </div>
      <span class="identitySlug">${escapeHtml(school.slug || "")}</span>
    </div>

    <div class="miniStatGrid">
      <div class="miniStatCard">
        <span>Latest result</span>
        <strong>${escapeHtml(summary.latestResult ? schoolResultLabel(summary.latestResult) : "No result")}</strong>
        <div class="detailListMeta">${escapeHtml(summary.latestResult ? schoolPerspectiveLabel(summary.latestResult) : "No recent final in window")}</div>
      </div>
      <div class="miniStatCard">
        <span>Next game</span>
        <strong>${escapeHtml(summary.nextGame ? schoolPerspectiveLabel(summary.nextGame) : "No game")}</strong>
        <div class="detailListMeta">${escapeHtml(summary.nextGame ? shortSummaryNote(summary.nextGame) : "No upcoming game in window")}</div>
      </div>
      <div class="miniStatCard">
        <span>Recent games</span>
        <strong>${escapeHtml(recentGames.length)}</strong>
        <div class="detailListMeta">Returned in the current live query window</div>
      </div>
      <div class="miniStatCard">
        <span>Verified players</span>
        <strong>${escapeHtml(schoolTeam.playerCount || 0)}</strong>
        <div class="detailListMeta">${escapeHtml(latestBoxscore.modeLabel || "No recent boxscore yet")}</div>
      </div>
    </div>

    ${
      batterTotals || pitcherTotals
        ? `
          <div class="totalsGrid">
            ${
              batterTotals
                ? `
                  <div class="totalsCard">
                    <span>Latest batting totals</span>
                    <strong>${escapeHtml(`${batterTotals.hits || "0"} H / ${batterTotals.runsScored || "0"} R`)}</strong>
                    <div class="detailListMeta">
                      ${escapeHtml(`${batterTotals.atBats || "0"} AB / ${batterTotals.walks || "0"} BB / ${batterTotals.strikeouts || "0"} SO`)}
                    </div>
                  </div>
                `
                : ""
            }
            ${
              pitcherTotals
                ? `
                  <div class="totalsCard">
                    <span>Latest pitching totals</span>
                    <strong>${escapeHtml(`${pitcherTotals.inningsPitched || "0"} IP / ${pitcherTotals.strikeouts || "0"} K`)}</strong>
                    <div class="detailListMeta">
                      ${escapeHtml(`${pitcherTotals.hitsAllowed || "0"} H / ${pitcherTotals.walksAllowed || "0"} BB / ${pitcherTotals.runsAllowed || "0"} R`)}
                    </div>
                  </div>
                `
                : ""
            }
          </div>
        `
        : ""
    }

    ${
      schoolPlayers.length
        ? `
          <div class="verifiedPlayersPanel">
            <div class="infoCardTitle">Latest verified player sample</div>
            <div class="schoolPlayersGrid">
              ${schoolPlayers
                .map(
                  (player) => `
                    <div class="schoolPlayerChip">
                      <strong>${escapeHtml(player.name)}</strong>
                      <span>${escapeHtml(`${player.position || "UTIL"} #${player.number || "--"}`)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
        `
        : '<div class="statusNote">No recent boxscore player sample was available for this school yet.</div>'
    }

      ${renderRecentFormSummary(recentForm)}
      ${
        state.explorer.standingsLoading
          ? '<div class="analysisSectionTitle">Conference standings</div><div class="statusNote">Loading the current conference table...</div>'
          : state.explorer.standingsError
            ? `<div class="analysisSectionTitle">Conference standings</div><div class="statusNote error">${escapeHtml(state.explorer.standingsError)}</div>`
            : renderConferenceStandings(standings, school.name || school.slug || "Selected school")
      }
      ${
        state.explorer.opponentScoutLoading
          ? '<div class="analysisSectionTitle">Next opponent scout</div><div class="statusNote">Building the opponent scout report...</div>'
          : state.explorer.opponentScoutError
            ? `<div class="analysisSectionTitle">Next opponent scout</div><div class="statusNote error">${escapeHtml(state.explorer.opponentScoutError)}</div>`
            : renderOpponentScout(nextOpponentScout, school.name || school.slug || "Selected school")
      }
  `;

  selectedSchoolGamesEl.innerHTML = gameCards.length
    ? gameCards
        .map(
          (game) => `
            <button
              class="schoolGameCard ${game.gameId === state.explorer.selectedGameId ? "active" : ""}"
              type="button"
              data-game-id="${escapeHtml(game.gameId)}"
            >
              <div class="gameListTop">
                <span class="liveState ${gameStateClass(game.gameState)}">${escapeHtml(game.gameState || "unknown")}</span>
                <span class="gameListMeta">${escapeHtml(game.date)}</span>
              </div>
              <div class="gameListTitle">${escapeHtml(schoolPerspectiveLabel(game))}</div>
              <div class="gameListMeta">${escapeHtml(schoolPerspectiveScore(game))}</div>
              <div class="gameListMeta">${escapeHtml(game.startTime || game.currentPeriod || "TBD")}</div>
            </button>
          `,
        )
        .join("")
    : '<div class="statusNote">No recent or upcoming games were returned for this school.</div>';
}

function renderScoreboardList() {
  if (state.explorer.scoreboardLoading) {
    scoreboardMetaEl.textContent = "Loading live games...";
    scoreboardListEl.innerHTML = '<div class="statusNote">Checking the current NCAA scoreboard...</div>';
    return;
  }

  if (state.explorer.scoreboardError) {
    scoreboardMetaEl.textContent = "Scoreboard unavailable";
    const isUpstream = /temporarily unavailable|timed out|NCAA data feed/i.test(state.explorer.scoreboardError);
    scoreboardListEl.innerHTML = `
      <div class="statusNote error">${isUpstream ? "Live scoreboard is temporarily unavailable — the NCAA data feed is down." : escapeHtml(state.explorer.scoreboardError)}</div>
      <button class="retryBtn" type="button" data-action="retry-scoreboard">Try again</button>
    `;
    return;
  }

  const scoreboard = state.explorer.scoreboard;
  const games = scoreboard?.data || [];
  scoreboardMetaEl.textContent = games.length
    ? `${games.length} live sample games for ${scoreboard.date}`
    : "No games returned for the selected scoreboard date";

  scoreboardListEl.innerHTML = games.length
    ? games
        .map(
          (game) => `
            <button
              class="gameListItem ${game.gameId === state.explorer.selectedGameId ? "active" : ""}"
              type="button"
              data-game-id="${escapeHtml(game.gameId)}"
            >
              <div class="gameListTop">
                <span class="liveState ${gameStateClass(game.gameState)}">${escapeHtml(game.gameState || "unknown")}</span>
                <span class="gameListMeta">${escapeHtml(game.date)}</span>
              </div>
              <div class="gameListTitle">${escapeHtml(genericMatchupLabel(game))}</div>
              <div class="gameListMeta">${escapeHtml(genericScoreLine(game))}</div>
              <div class="gameListMeta">${escapeHtml(
                [game.away?.conferenceSeo, game.home?.conferenceSeo].filter(Boolean).join(" / ") || game.startTime || "TBD",
              )}</div>
            </button>
          `,
        )
        .join("")
    : '<div class="statusNote">No live games were returned.</div>';
}

function renderLinescoreTable(summary) {
  const linescores = summary?.linescores || [];
  if (!linescores.length) {
    return '<div class="statusNote">No linescore was returned for this game.</div>';
  }

  const homeTeam = (summary.teams || []).find((team) => team.isHome) || summary.teams?.[0];
  const awayTeam = (summary.teams || []).find((team) => !team.isHome) || summary.teams?.[1];

  return `
    <div class="linescoreWrap">
      <table class="linescoreTable">
        <thead>
          <tr>
            <th>Team</th>
            ${linescores.map((line) => `<th>${escapeHtml(line.period)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(awayTeam?.nameShort || "Away")}</td>
            ${linescores.map((line) => `<td>${escapeHtml(line.visit || "-")}</td>`).join("")}
          </tr>
          <tr>
            <td>${escapeHtml(homeTeam?.nameShort || "Home")}</td>
            ${linescores.map((line) => `<td>${escapeHtml(line.home || "-")}</td>`).join("")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function renderAnalysisMetricPills(items = []) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) {
    return "";
  }

  return `
    <div class="analysisMetricList">
      ${filtered.map((item) => `<span class="analysisMetricChip">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function buildTeamAnalysisPills(teamSummary) {
  const totals = teamSummary?.eventTotals || {};
  return [
    totals.runsFromScoringPlays ? pluralize(totals.runsFromScoringPlays, "run") : "",
    totals.hits ? `${totals.hits} hit events` : "",
    totals.extraBaseHits ? `${totals.extraBaseHits} XBH` : "",
    totals.freeBases ? `${totals.freeBases} free bases` : "",
    totals.stolenBases ? `${totals.stolenBases} SB events` : "",
    totals.strikeouts ? `${totals.strikeouts} K events` : "",
    totals.reachedOnError ? `${totals.reachedOnError} ROE` : "",
  ];
}

function formatSignedNumber(value, decimals = 1) {
  const number = Number(value || 0);
  const fixed = number.toFixed(decimals);
  return number > 0 ? `+${fixed}` : fixed;
}

function renderRecentFormSummary(recentForm) {
  if (!recentForm) {
    return "";
  }

  if (!recentForm.available) {
    return `
      <div class="analysisSectionTitle">Recent form</div>
      <div class="statusNote">${escapeHtml(recentForm.note || "Recent form is not available yet.")}</div>
    `;
  }

  const aggregate = recentForm.aggregate || {};
  const totals = aggregate.totals || {};
  const averages = aggregate.averages || {};
  const record = aggregate.record || {};
  const games = recentForm.games || [];
  const topPlayers = recentForm.topPlayers || [];
  const inningProfile = recentForm.inningProfile || null;
  const strongestScoringInning = inningProfile?.strongestScoringInning || null;
  const weakestRunPreventionInning = inningProfile?.weakestRunPreventionInning || null;
  const staffUsage = recentForm.staffUsage || [];

  return `
    <div class="analysisSectionTitle">Recent form</div>

    <div class="miniStatGrid">
      <div class="miniStatCard">
        <span>Record</span>
        <strong>${escapeHtml(`${record.wins || 0}-${record.losses || 0}${record.ties ? `-${record.ties}` : ""}`)}</strong>
        <div class="detailListMeta">${escapeHtml(`Last ${recentForm.includedGames || games.length} final game${recentForm.includedGames === 1 ? "" : "s"}`)}</div>
      </div>
      <div class="miniStatCard">
        <span>Runs / game</span>
        <strong>${escapeHtml(`${Number(averages.runsScored || 0).toFixed(1)} scored`)}</strong>
        <div class="detailListMeta">${escapeHtml(`${Number(averages.runsAllowed || 0).toFixed(1)} allowed / ${formatSignedNumber(averages.runDifferential || 0)} diff`)}</div>
      </div>
      <div class="miniStatCard">
        <span>Pressure profile</span>
        <strong>${escapeHtml(`${recentForm.aggregate?.eventTotals?.extraBaseHits || 0} XBH`)}</strong>
        <div class="detailListMeta">${escapeHtml(`${recentForm.aggregate?.eventTotals?.freeBases || 0} free bases / ${recentForm.aggregate?.eventTotals?.stolenBases || 0} SB events`)}</div>
      </div>
      <div class="miniStatCard">
        <span>Boxscore volume</span>
        <strong>${escapeHtml(`${totals.hits || 0} H / ${totals.walks || 0} BB`)}</strong>
        <div class="detailListMeta">${escapeHtml(`${totals.strikeouts || 0} SO / ${Number(totals.inningsPitched || 0).toFixed(1)} IP`)}</div>
      </div>
    </div>

    ${
      recentForm.insights?.length
        ? `
          <div class="analysisInsightList">
            ${recentForm.insights
              .map(
                (insight) => `
                  <div class="analysisInsightCard">${escapeHtml(insight)}</div>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    ${
      strongestScoringInning || weakestRunPreventionInning || staffUsage.length
        ? `
          <div class="teamSampleGrid">
            <article class="teamSampleCard">
              <h4>Inning trend read</h4>
              <div class="analysisMiniList">
                <div class="analysisMiniRow">
                  <span>Best scoring inning</span>
                  <strong>${escapeHtml(
                    strongestScoringInning
                      ? `Inning ${strongestScoringInning.inning} (${formatScoutMetricValue(strongestScoringInning.runsPerGame)} R/game)`
                      : "No clear edge yet",
                  )}</strong>
                </div>
                <div class="analysisMiniRow">
                  <span>Biggest prevention leak</span>
                  <strong>${escapeHtml(
                    weakestRunPreventionInning
                      ? `Inning ${weakestRunPreventionInning.inning} (${formatScoutMetricValue(weakestRunPreventionInning.runsPerGame)} RA/game)`
                      : "No soft inning yet",
                  )}</strong>
                </div>
              </div>
            </article>
            ${renderScoutStaffCards("Recent staff workload", staffUsage.slice(0, 4), "No recent pitching workload was returned.")}
          </div>
        `
        : ""
    }

    ${
      games.length
        ? `
          <div class="analysisSectionTitle">Last ${games.length} finals</div>
          <div class="teamSampleGrid">
            ${games
              .map(
                (game) => `
                  <article class="teamSampleCard">
                    <div class="analysisCardTop">
                      <div>
                        <h4>${escapeHtml(`${game.venueLabel || "vs"} ${game.opponent || "Opponent"}`)}</h4>
                        <div class="detailListMeta">${escapeHtml(
                          [game.date || "", game.startTime || "", game.scoreLine ? `${game.result} ${game.scoreLine}` : ""]
                            .filter(Boolean)
                            .join(" / "),
                        )}</div>
                      </div>
                      <span class="identitySlug">${escapeHtml(game.result || "-")}</span>
                    </div>
                    ${renderAnalysisMetricPills([
                      game.runsScored != null ? `${game.runsScored} R` : "",
                      game.boxscoreTotals?.batterTotals?.hits ? `${game.boxscoreTotals.batterTotals.hits} H` : "",
                      game.eventTotals?.extraBaseHits ? `${game.eventTotals.extraBaseHits} XBH` : "",
                      game.eventTotals?.freeBases ? `${game.eventTotals.freeBases} free bases` : "",
                      game.eventTotals?.stolenBases ? `${game.eventTotals.stolenBases} SB` : "",
                    ])}
                    ${
                      game.topPlayers?.[0]
                        ? `<div class="guideText">${escapeHtml(`${game.topPlayers[0].name}: ${game.topPlayers[0].keyLine}`)}</div>`
                        : '<div class="detailListMeta">No major PBP-tagged player impact captured.</div>'
                    }
                  </article>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    ${
      topPlayers.length
        ? `
          <div class="analysisSectionTitle">Recent impact leaders</div>
          <div class="analysisPlayerGrid">
            ${topPlayers
              .slice(0, 4)
              .map(
                (player) => `
                  <article class="analysisPlayerCard">
                    <div class="analysisPlayerTop">
                      <div>
                        <div class="analysisPlayerName">${escapeHtml(player.name)}</div>
                        <div class="analysisPlayerMeta">${escapeHtml(`${player.gamesTracked} tracked game${player.gamesTracked === 1 ? "" : "s"}`)}</div>
                      </div>
                      <span class="analysisImpactScore">${escapeHtml(player.impactScore)}</span>
                    </div>
                    <div class="detailListMeta">${escapeHtml(player.keyLine)}</div>
                    ${player.highlights?.[0] ? `<div class="guideText">${escapeHtml(player.highlights[0])}</div>` : ""}
                  </article>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }
  `;
}

function renderConferenceStandings(standings, schoolName = "Selected school") {
  if (!standings) {
    return "";
  }

  if (!standings.available) {
    return `
      <div class="analysisSectionTitle">Conference standings</div>
      <div class="statusNote">${escapeHtml(standings.note || "Conference standings are not available for this school right now.")}</div>
    `;
  }

  const table = standings.table || [];
  const conferenceName = standings.conference?.name || "Conference";
  const schoolEntry = standings.schoolEntry || null;
  const format = standings.format || "espn";

  if (format === "mac") {
    return `
      <div class="analysisSectionTitle">Conference standings</div>
      <section class="scoutPanel">
        <div class="schoolSummaryHeader">
          <div>
            <div class="identityEyebrow">League table</div>
            <div class="schoolSummaryTitle">${escapeHtml(conferenceName)}</div>
            <div class="schoolSummarySub">${escapeHtml(
              standings.note || "Official MAC baseball standings, cached weekly in the backend.",
            )}</div>
          </div>
          <span class="identitySlug">${escapeHtml(standings.conference?.shortName || "")}</span>
        </div>

        ${
          schoolEntry
            ? `
              <div class="miniStatGrid">
                <div class="miniStatCard">
                  <span>${escapeHtml(schoolName)} place</span>
                  <strong>${escapeHtml(`#${schoolEntry.rank}`)}</strong>
                  <div class="detailListMeta">${escapeHtml(schoolEntry.displayName || schoolName)}</div>
                </div>
                <div class="miniStatCard">
                  <span>MAC record</span>
                  <strong>${escapeHtml(schoolEntry.conferenceRecord || "--")}</strong>
                  <div class="detailListMeta">${escapeHtml(`${schoolEntry.conferencePct || "--"} conference pct`)}</div>
                </div>
                <div class="miniStatCard">
                  <span>Overall</span>
                  <strong>${escapeHtml(schoolEntry.overallRecord || "--")}</strong>
                  <div class="detailListMeta">${escapeHtml(`${schoolEntry.overallPct || "--"} overall pct`)}</div>
                </div>
                <div class="miniStatCard">
                  <span>Trend</span>
                  <strong>${escapeHtml(schoolEntry.streak || "--")}</strong>
                  <div class="detailListMeta">${escapeHtml(`${schoolEntry.homeRecord || "--"} home / ${schoolEntry.awayRecord || "--"} away`)}</div>
                </div>
              </div>
            `
            : ""
        }

        <div class="standingsTableCard">
          <div class="standingsTableHead standingsTableHead--mac">
            <span>RK</span>
            <span>TEAM</span>
            <span>MAC</span>
            <span>CPCT</span>
            <span>OVER</span>
            <span>PCT</span>
            <span>HOME</span>
            <span>AWAY</span>
            <span>NEUT</span>
            <span>STRK</span>
          </div>
          <div class="standingsTableBody">
            ${table
              .map(
                (entry) => `
                  <div class="standingsRow standingsRow--mac ${entry.teamId === schoolEntry?.teamId ? "is-selected" : ""}">
                    <span class="standingsRank">${escapeHtml(entry.rank)}</span>
                    <span class="standingsTeamCell">
                      <strong>${escapeHtml(entry.displayName)}</strong>
                    </span>
                    <span>${escapeHtml(entry.conferenceRecord || "--")}</span>
                    <span>${escapeHtml(entry.conferencePct || "--")}</span>
                    <span>${escapeHtml(entry.overallRecord || "--")}</span>
                    <span>${escapeHtml(entry.overallPct || "--")}</span>
                    <span>${escapeHtml(entry.homeRecord || "--")}</span>
                    <span>${escapeHtml(entry.awayRecord || "--")}</span>
                    <span>${escapeHtml(entry.neutralRecord || "--")}</span>
                    <span>${escapeHtml(entry.streak || "--")}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      </section>
    `;
  }

  return `
    <div class="analysisSectionTitle">Conference standings</div>
    <section class="scoutPanel">
      <div class="schoolSummaryHeader">
        <div>
          <div class="identityEyebrow">League table</div>
          <div class="schoolSummaryTitle">${escapeHtml(conferenceName)}</div>
          <div class="schoolSummarySub">${escapeHtml(
            standings.note || "Overall record, league win percentage, games back, streak, and run differential.",
          )}</div>
        </div>
        <span class="identitySlug">${escapeHtml(standings.conference?.shortName || "")}</span>
      </div>

      ${
        schoolEntry
          ? `
            <div class="miniStatGrid">
              <div class="miniStatCard">
                <span>${escapeHtml(schoolName)} place</span>
                <strong>${escapeHtml(`#${schoolEntry.rank}`)}</strong>
                <div class="detailListMeta">${escapeHtml(schoolEntry.fullName || schoolEntry.displayName || schoolName)}</div>
              </div>
              <div class="miniStatCard">
                <span>Overall</span>
                <strong>${escapeHtml(schoolEntry.overallRecord || "--")}</strong>
                <div class="detailListMeta">ESPN standings summary</div>
              </div>
              <div class="miniStatCard">
                <span>League pct</span>
                <strong>${escapeHtml(schoolEntry.leagueWinPct || "--")}</strong>
                <div class="detailListMeta">${escapeHtml(`${schoolEntry.gamesBack || "-"} GB`)}</div>
              </div>
              <div class="miniStatCard">
                <span>Trend</span>
                <strong>${escapeHtml(schoolEntry.streak || "--")}</strong>
                <div class="detailListMeta">${escapeHtml(`${schoolEntry.runDifferential || "--"} run diff`)}</div>
              </div>
            </div>
          `
          : ""
      }

      <div class="standingsTableCard">
        <div class="standingsTableHead">
          <span>RK</span>
          <span>TEAM</span>
          <span>OVER</span>
          <span>LPCT</span>
          <span>GB</span>
          <span>STRK</span>
          <span>DIFF</span>
        </div>
        <div class="standingsTableBody">
          ${table
            .map(
              (entry) => `
                <div class="standingsRow ${entry.teamId === schoolEntry?.teamId ? "is-selected" : ""}">
                  <span class="standingsRank">${escapeHtml(entry.rank)}</span>
                  <span class="standingsTeamCell">
                    ${entry.logo ? `<img class="standingsLogo" src="${escapeHtml(entry.logo)}" alt="${escapeHtml(entry.displayName)} logo" />` : ""}
                    <strong>${escapeHtml(entry.displayName)}</strong>
                  </span>
                  <span>${escapeHtml(entry.overallRecord || "--")}</span>
                  <span>${escapeHtml(entry.leagueWinPct || "--")}</span>
                  <span>${escapeHtml(entry.gamesBack || "-")}</span>
                  <span>${escapeHtml(entry.streak || "--")}</span>
                  <span>${escapeHtml(entry.runDifferential || "--")}</span>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function formatScoutMetricValue(value) {
  const numeric = Number(value || 0);
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function getScoutAdvantageLabel(advantage, schoolName, opponentName) {
  if (advantage === "school") {
    return `${schoolName} edge`;
  }
  if (advantage === "opponent") {
    return `${opponentName} edge`;
  }
  return "Even";
}

function buildHeatCellStyle(value, maxValue, hue = "255,210,0") {
  const opacity = maxValue > 0 ? 0.16 + (Number(value || 0) / maxValue) * 0.52 : 0.12;
  return `background:rgba(${hue},${Math.min(opacity, 0.82).toFixed(2)})`;
}

function renderScoutHeatmapRow(label, values = [], maxValue = 0, hue = "255,210,0") {
  return `
    <div class="scoutHeatmapRow">
      <div class="scoutHeatmapLabel">${escapeHtml(label)}</div>
      ${values
        .map(
          (value) => `
            <div class="scoutHeatCell" style="${buildHeatCellStyle(value, maxValue, hue)}">
              ${escapeHtml(formatScoutMetricValue(value))}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderScoutStaffCards(title, staffUsage = [], emptyMessage = "No recent staff usage was returned.") {
  if (!staffUsage.length) {
    return `
      <article class="teamSampleCard">
        <h4>${escapeHtml(title)}</h4>
        <div class="detailListMeta">${escapeHtml(emptyMessage)}</div>
      </article>
    `;
  }

  return `
    <article class="teamSampleCard">
      <h4>${escapeHtml(title)}</h4>
      <div class="analysisMiniList">
        ${staffUsage
          .map(
            (pitcher) => `
              <div class="analysisMiniRow">
                <span>${escapeHtml(pitcher.name)}</span>
                <strong>${escapeHtml(pitcher.keyLine)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderOpponentScout(scout, schoolName = "Toledo") {
  if (!scout) {
    return "";
  }

  if (!scout.available) {
    return `
      <div class="analysisSectionTitle">Next opponent scout</div>
      <div class="statusNote">${escapeHtml(scout.note || "Upcoming opponent scout is not available yet.")}</div>
    `;
  }

  const opponentName = scout.opponent?.name || scout.opponent?.long || scout.nextGame?.opponent || "Opponent";
  const compareMetrics = scout.compareMetrics || [];
  const weaknessFlags = scout.weaknessFlags || [];
  const dangerPlayers = scout.dangerPlayers || [];
  const heatmap = scout.inningHeatmap || null;
  const maxHeatValue = Number(heatmap?.maxValue || 0);

  return `
    <div class="analysisSectionTitle">Next opponent scout</div>
    <section class="scoutPanel">
      <div class="schoolSummaryHeader">
        <div>
          <div class="identityEyebrow">Series preview</div>
          <div class="schoolSummaryTitle">${escapeHtml(`${scout.nextGame?.venueLabel || "vs"} ${opponentName}`)}</div>
          <div class="schoolSummarySub">
            ${escapeHtml(
              [scout.nextGame?.date || "", scout.nextGame?.startTime || "", scout.note || ""].filter(Boolean).join(" / "),
            )}
          </div>
        </div>
        <span class="identitySlug">${escapeHtml(scout.opponent?.slug || "")}</span>
      </div>

      ${
        scout.insights?.length
          ? `
            <div class="analysisInsightList">
              ${scout.insights
                .map((insight) => `<div class="analysisInsightCard">${escapeHtml(insight)}</div>`)
                .join("")}
            </div>
          `
          : ""
      }

      ${
        compareMetrics.length
          ? `
            <div class="analysisSectionTitle">Matchup compare</div>
            <div class="scoutCompareGrid">
              ${compareMetrics
                .map(
                  (metric) => `
                    <article class="scoutCompareCard">
                      <span>${escapeHtml(metric.label)}</span>
                      <div class="scoutCompareValues">
                        <div>
                          <strong>${escapeHtml(metric.schoolDisplay)}</strong>
                          <small>${escapeHtml(schoolName)}</small>
                        </div>
                        <div>
                          <strong>${escapeHtml(metric.opponentDisplay)}</strong>
                          <small>${escapeHtml(opponentName)}</small>
                        </div>
                      </div>
                      <div class="scoutCompareFooter">
                        <span class="scoutEdgeChip is-${escapeHtml(metric.advantage)}">${escapeHtml(
                          getScoutAdvantageLabel(metric.advantage, schoolName, opponentName),
                        )}</span>
                        <small>${escapeHtml(metric.note || "")}</small>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }

      <div class="analysisSectionTitle">Attack points</div>
      <div class="teamSampleGrid">
        ${
          weaknessFlags.length
            ? weaknessFlags
                .map(
                  (flag) => `
                    <article class="teamSampleCard scoutWeaknessCard scoutWeaknessCard--${escapeHtml(flag.emphasis || "watch")}">
                      <h4>${escapeHtml(flag.title)}</h4>
                      <div class="detailListMeta">${escapeHtml(flag.detail)}</div>
                    </article>
                  `,
                )
                .join("")
            : '<div class="statusNote">No clear weakness flags were returned.</div>'
        }
      </div>

      <div class="analysisSectionTitle">Danger players</div>
      <div class="analysisPlayerGrid">
        ${
          dangerPlayers.length
            ? dangerPlayers
                .map(
                  (player) => `
                    <article class="analysisPlayerCard">
                      <div class="analysisPlayerTop">
                        <div>
                          <div class="analysisPlayerName">${escapeHtml(player.name)}</div>
                          <div class="analysisPlayerMeta">${escapeHtml(`${player.gamesTracked} tracked game${player.gamesTracked === 1 ? "" : "s"}`)}</div>
                        </div>
                        <span class="analysisImpactScore">${escapeHtml(player.impactScore)}</span>
                      </div>
                      <div class="detailListMeta">${escapeHtml(player.keyLine || "Recent impact")}</div>
                      ${player.highlights?.[0] ? `<div class="guideText">${escapeHtml(player.highlights[0])}</div>` : ""}
                    </article>
                  `,
                )
                .join("")
            : '<div class="statusNote">No opponent danger players were surfaced from the recent-form sample.</div>'
        }
      </div>

      ${
        heatmap
          ? `
            <div class="analysisSectionTitle">Inning pressure map</div>
            <div class="scoutHeatmapCard">
              <div class="scoutHeatmapRow scoutHeatmapRow--head">
                <div class="scoutHeatmapLabel">Split</div>
                ${heatmap.innings.map((inning) => `<div class="scoutHeatCell scoutHeatCell--head">${escapeHtml(inning)}</div>`).join("")}
              </div>
              ${renderScoutHeatmapRow(`${schoolName} scored`, heatmap.schoolScored, maxHeatValue, "82,211,153")}
              ${renderScoutHeatmapRow(`${schoolName} allowed`, heatmap.schoolAllowed, maxHeatValue, "248,113,113")}
              ${renderScoutHeatmapRow(`${opponentName} scored`, heatmap.opponentScored, maxHeatValue, "255,210,0")}
              ${renderScoutHeatmapRow(`${opponentName} allowed`, heatmap.opponentAllowed, maxHeatValue, "36,79,143")}
            </div>
          `
          : ""
      }

      <div class="analysisSectionTitle">Recent staff usage</div>
      <div class="teamSampleGrid">
        ${renderScoutStaffCards(`${schoolName} recent workload`, scout.staffUsage?.school || [], "No recent Toledo pitching usage was returned.")}
        ${renderScoutStaffCards(`${opponentName} recent workload`, scout.staffUsage?.opponent || [], "No opponent pitching usage was returned.")}
      </div>
    </section>
  `;
}

function renderPlayerImpactSection(title, subtitle, impact, emptyMessage = "No tracked impact available yet.") {
  if (!impact) {
    return `
      <div class="analysisPlayerCard">
        <div class="analysisPlayerTop">
          <div>
            <div class="analysisPlayerName">${escapeHtml(title)}</div>
            <div class="analysisPlayerMeta">${escapeHtml(subtitle)}</div>
          </div>
        </div>
        <div class="detailListMeta">${escapeHtml(emptyMessage)}</div>
      </div>
    `;
  }

  return `
    <div class="analysisPlayerCard">
      <div class="analysisPlayerTop">
        <div>
          <div class="analysisPlayerName">${escapeHtml(title)}</div>
          <div class="analysisPlayerMeta">${escapeHtml(subtitle)}</div>
        </div>
        <span class="analysisImpactScore">${escapeHtml(impact.impactScore || 0)}</span>
      </div>
      <div class="detailListMeta">${escapeHtml(impact.keyLine || "Tracked impact")}</div>
      ${renderAnalysisMetricPills([
        impact.runsBattedIn ? `${impact.runsBattedIn} RBI` : "",
        impact.runsScored ? `${impact.runsScored} R` : "",
        impact.counts?.homeRuns ? `${impact.counts.homeRuns} HR` : "",
        impact.counts?.hits ? `${impact.counts.hits} H` : "",
        impact.counts?.walks ? `${impact.counts.walks} BB` : "",
        impact.counts?.stolenBases ? `${impact.counts.stolenBases} SB` : "",
        impact.gamesTracked ? `${impact.gamesTracked} games` : "",
      ])}
      ${impact.highlights?.[0] ? `<div class="guideText">${escapeHtml(impact.highlights[0])}</div>` : ""}
    </div>
  `;
}

function renderPlayerImpactSections(player, payload, mode) {
  const latestGameImpact = player.latestGameImpact || null;
  const recentTrend = player.recentTrend || null;
  const shouldShowEmptyLiveCard = mode.isLiveSchool && !latestGameImpact;

  if (!latestGameImpact && !recentTrend && !shouldShowEmptyLiveCard) {
    return "";
  }

  return `
    <div class="analysisSectionTitle">Live impact context</div>
    <div class="analysisPlayerGrid">
      ${renderPlayerImpactSection(
        "Latest game impact",
        player.sourceGame ? `${player.sourceGame.date || ""}${player.sourceGame.title ? ` / ${player.sourceGame.title}` : ""}` : "Latest tracked final",
        latestGameImpact,
        player.role === "Pitcher"
          ? "No batter or runner event tags were matched for this pitcher in the latest play-by-play sample. Use the boxscore line above for workload and command context."
          : "No major batter or runner event tags were matched for this player in the latest play-by-play sample.",
      )}
      ${recentTrend ? renderPlayerImpactSection("Recent form trend", `${recentTrend.gamesTracked} recent tracked game${recentTrend.gamesTracked === 1 ? "" : "s"}`, recentTrend) : ""}
    </div>
    ${payload?.recentForm?.note ? `<div class="detailListMeta">${escapeHtml(payload.recentForm.note)}</div>` : ""}
  `;
}

function renderGameAnalysis(analysis) {
  if (!analysis) {
    return "";
  }

  const topPlayers = analysis.topPlayers || [];
  const scoringTimeline = analysis.scoringTimeline || [];
  const teamSummaries = analysis.teamSummaries || [];
  const recentTimeline = scoringTimeline.slice(-10).reverse();
  const momentum = analysis.momentumTimeline || [];
  const recentMomentum = momentum.slice(-40);
  let momentumHtml = "";
  if (recentMomentum.length) {
    const vals = recentMomentum.map((e) => Math.abs(Number(e.netImpact) || 0));
    const maxVal = Math.max(...vals, 1);
    momentumHtml = `
      <div class="analysisSectionTitle">Momentum timeline</div>
      <div class="momentumSpark">
        ${recentMomentum
          .map((ev) => {
            const mag = Math.abs(Number(ev.netImpact) || 0);
            const height = Math.max(4, Math.round((mag / maxVal) * 32));
            const color = (Number(ev.netImpact) || 0) >= 0 ? "#4ade80" : "#fb7185";
            const title = `${ev.periodDisplay || ""} ${ev.teamShort || ""} ${ev.netImpact}`;
            return `<div class="momentumBar" title="${escapeHtml(title)}" style="height:${height}px;background:${color}"></div>`;
          })
          .join("")}
      </div>
    `;
  }

  return `
    <div class="divider"></div>

    <div class="miniStatGrid">
      <div class="miniStatCard">
        <span>Tracked plays</span>
        <strong>${escapeHtml(analysis.totalEvents || 0)}</strong>
        <div class="detailListMeta">${escapeHtml(analysis.available ? "Flattened from NCAA play-by-play" : analysis.note || "No play-by-play available")}</div>
      </div>
      <div class="miniStatCard">
        <span>Scoring plays</span>
        <strong>${escapeHtml(analysis.scoringPlays || 0)}</strong>
        <div class="detailListMeta">${escapeHtml(analysis.periodsTracked ? `${analysis.periodsTracked} innings tracked` : "Waiting on inning detail")}</div>
      </div>
      <div class="miniStatCard">
        <span>Lead changes</span>
        <strong>${escapeHtml(analysis.leadChanges || 0)}</strong>
        <div class="detailListMeta">${escapeHtml(analysis.leadChanges ? "Scoring swings captured in the timeline" : "No lead change recorded from the PBP scores")}</div>
      </div>
      <div class="miniStatCard">
        <span>Busiest inning</span>
        <strong>${escapeHtml(analysis.busiestPeriod?.periodDisplay || "None")}</strong>
        <div class="detailListMeta">${escapeHtml(analysis.busiestPeriod ? pluralize(analysis.busiestPeriod.runs, "run") : "No scoring inning identified yet")}</div>
      </div>
    </div>

    ${
      analysis.insights?.length
        ? `
          <div class="analysisInsightList">
            ${analysis.insights
              .map(
                (insight) => `
                  <div class="analysisInsightCard">${escapeHtml(insight)}</div>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    ${
      teamSummaries.length
        ? `
          <div class="analysisSectionTitle">Team event profile</div>
          <div class="teamSampleGrid">
            ${teamSummaries
              .map((teamSummary) => {
                const batterTotals = teamSummary.boxscoreTotals?.batterTotals || null;
                const pitcherTotals = teamSummary.boxscoreTotals?.pitcherTotals || null;

                return `
                  <article class="teamSampleCard analysisTeamCard">
                    <div class="analysisCardTop">
                      <div>
                        <h4>${escapeHtml(teamSummary.nameFull || teamSummary.nameShort || "Team")}</h4>
                        <div class="detailListMeta">${escapeHtml(
                          [
                            teamSummary.record || "",
                            teamSummary.finalScore != null ? `Final score ${teamSummary.finalScore}` : "",
                            teamSummary.eventTotals.scoringPlays ? pluralize(teamSummary.eventTotals.scoringPlays, "scoring play") : "",
                          ]
                            .filter(Boolean)
                            .join(" / "),
                        )}</div>
                      </div>
                      <span class="identitySlug">${escapeHtml(teamSummary.isHome ? "HOME" : "AWAY")}</span>
                    </div>
                    ${renderAnalysisMetricPills(buildTeamAnalysisPills(teamSummary))}
                    ${
                      batterTotals
                        ? `<div class="detailListMeta">${escapeHtml(
                            `Batting: ${batterTotals.hits || 0} H / ${batterTotals.runsScored || 0} R / ${batterTotals.walks || 0} BB / ${batterTotals.strikeouts || 0} SO`,
                          )}</div>`
                        : ""
                    }
                    ${
                      pitcherTotals
                        ? `<div class="detailListMeta">${escapeHtml(
                            `Pitching: ${pitcherTotals.inningsPitched || "0.0"} IP / ${pitcherTotals.strikeouts || 0} K / ${pitcherTotals.walksAllowed || 0} BB / ${pitcherTotals.hitsAllowed || 0} H`,
                          )}</div>`
                        : ""
                    }
                    ${
                      teamSummary.topPlayers?.length
                        ? `
                          <div class="analysisMiniList">
                            ${teamSummary.topPlayers
                              .slice(0, 3)
                              .map(
                                (player) => `
                                  <div class="analysisMiniRow">
                                    <span>${escapeHtml(player.name)}</span>
                                    <strong>${escapeHtml(player.keyLine)}</strong>
                                  </div>
                                `,
                              )
                              .join("")}
                          </div>
                        `
                        : '<div class="detailListMeta">No notable player events were parsed for this team.</div>'
                    }
                  </article>
                `;
              })
              .join("")}
          </div>
        `
        : ""
    }

    ${
      topPlayers.length
        ? `
          <div class="analysisSectionTitle">Top player impact</div>
          <div class="analysisPlayerGrid">
            ${topPlayers
              .map(
                (player) => `
                  <article class="analysisPlayerCard">
                    <div class="analysisPlayerTop">
                      <div>
                        <div class="analysisPlayerName">${escapeHtml(player.name)}</div>
                        <div class="analysisPlayerMeta">${escapeHtml(player.teamFull || player.teamShort || "")}</div>
                      </div>
                      <span class="analysisImpactScore">${escapeHtml(player.impactScore)}</span>
                    </div>
                    <div class="detailListMeta">${escapeHtml(player.keyLine)}</div>
                    ${renderAnalysisMetricPills([
                      player.runsBattedIn ? `${player.runsBattedIn} RBI` : "",
                      player.runsScored ? `${player.runsScored} R` : "",
                      player.counts.homeRuns ? `${player.counts.homeRuns} HR` : "",
                      player.counts.walks ? `${player.counts.walks} BB` : "",
                      player.counts.stolenBases ? `${player.counts.stolenBases} SB` : "",
                      player.counts.strikeouts ? `${player.counts.strikeouts} K` : "",
                    ])}
                    ${player.highlights?.[0] ? `<div class="guideText">${escapeHtml(player.highlights[0])}</div>` : ""}
                  </article>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }

    ${
      momentumHtml || recentTimeline.length
        ? `
          ${momentumHtml}
          <div class="analysisSectionTitle">Scoring timeline</div>
          <div class="analysisTimeline">
            ${recentTimeline
              .map(
                (event) => `
                  <article class="analysisTimelineItem">
                    <div class="analysisTimelineTop">
                      <div>
                        <strong>${escapeHtml(event.teamFull || event.teamShort || "Team")}</strong>
                        <div class="detailListMeta">${escapeHtml(event.periodDisplay || "Inning")}</div>
                      </div>
                      <span class="analysisScoreTag">${escapeHtml(event.scoreLine || "-")}</span>
                    </div>
                    <div class="detailListMeta">${escapeHtml(
                      [
                        event.primaryPlayer || "",
                        event.runsScored ? pluralize(event.runsScored, "run") : "",
                        event.rbiCount ? `${event.rbiCount} RBI` : "",
                      ]
                        .filter(Boolean)
                        .join(" / "),
                    )}</div>
                    <div class="guideText">${escapeHtml(event.playText)}</div>
                  </article>
                `,
              )
              .join("")}
          </div>
        `
        : ""
    }
  `;
}

function renderGameDetail() {
  if (state.explorer.selectedGameLoading) {
    gameDetailEl.innerHTML = '<div class="statusNote">Loading game detail and boxscore...</div>';
    return;
  }

  if (state.explorer.selectedGameError) {
    gameDetailEl.innerHTML = `<div class="statusNote error">${escapeHtml(state.explorer.selectedGameError)}</div>`;
    return;
  }

  const data = state.explorer.selectedGame;
  if (!data) {
    gameDetailEl.innerHTML = '<div class="statusNote">Choose a game from the scoreboard or school window to inspect its payload.</div>';
    return;
  }

  const summary = data.summary || {};
  const boxscore = data.boxscore || null;
  const analysis = data.analysis || null;
  const teams = summary.teams || [];
  const homeTeam = teams.find((team) => team.isHome) || teams[0] || {};
  const awayTeam = teams.find((team) => !team.isHome) || teams[1] || {};
  const boxscoreTeams = Array.isArray(boxscore?.teams) ? boxscore.teams : [];

  gameDetailEl.innerHTML = `
    <div class="gameDetailTop">
      <div>
        <div class="identityEyebrow">Selected game</div>
        <div class="gameDetailTitle">${escapeHtml(`${awayTeam.nameShort || "Away"} at ${homeTeam.nameShort || "Home"}`)}</div>
        <div class="schoolSummarySub">
          ${escapeHtml(
            `${summary.statusCodeDisplay || summary.gameState || "unknown"} / ${summary.startTime || "TBD"} / ${
              summary.hasBoxscore ? "boxscore available" : "boxscore not yet available"
            }`,
          )}
        </div>
      </div>
      <span class="identitySlug">${escapeHtml(summary.gameId || "")}</span>
    </div>

    <div class="gameTeams">
      <div class="teamBlock">
        <strong>${escapeHtml(awayTeam.nameFull || awayTeam.nameShort || "Away")}</strong>
        <span class="teamRecord">${escapeHtml(awayTeam.record || "")}</span>
      </div>
      <div class="teamScore">${escapeHtml(awayTeam.score ?? "-")}</div>
      <div class="teamScore">${escapeHtml(homeTeam.score ?? "-")}</div>
      <div class="teamBlock" style="text-align:right">
        <strong>${escapeHtml(homeTeam.nameFull || homeTeam.nameShort || "Home")}</strong>
        <span class="teamRecord">${escapeHtml(homeTeam.record || "")}</span>
      </div>
    </div>

    ${renderLinescoreTable(summary)}

    ${renderGameAnalysis(analysis)}

    ${
      boxscore && !boxscore.error && boxscoreTeams.length
        ? `
          <div class="teamSampleGrid">
            ${boxscoreTeams
              .map(
                (team) => `
                  <div class="teamSampleCard">
                    <h4>${escapeHtml(team.nameFull || team.nameShort || "Team")}</h4>
                    <div class="detailListMeta">${escapeHtml(`${team.players.length} players returned`)}</div>
                    <div class="playerSampleList">
                      ${team.players
                        .slice(0, 8)
                        .map(
                          (player) => `
                            <div class="playerSampleRow">
                              <span>${escapeHtml(player.name)}</span>
                              <span>${escapeHtml(`${player.position || "UTIL"} #${player.number || "--"}`)}</span>
                            </div>
                          `,
                        )
                        .join("")}
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
        `
        : boxscore?.error
          ? `<div class="statusNote error">${escapeHtml(boxscore.error)}</div>`
          : '<div class="statusNote">No boxscore player payload is available for this game yet.</div>'
    }
  `;
}

function renderExplorer() {
  renderSchoolSearchResults();
  renderSelectedSchoolSummary();
  renderScoreboardList();
  renderGameDetail();
}

function render() {
  renderSourceChecks();
  renderBuildMetrics();
  renderOverviewLiveSummary();
  renderTopBadges();
  renderExplorer();
  renderPlayers();
  renderTargets();
}

async function fetchDashboardJson(path, options = {}) {
  const apiBases = uniqueItems(options.apiBases || [API_BASE]);
  if (!apiBases.length) {
    throw new Error(LIVE_API_UNAVAILABLE_MESSAGE);
  }

  let lastError = null;
  for (const apiBase of apiBases) {
    try {
      const response = await fetch(`${apiBase}${path}`);
      if (!response.ok) {
        let message = `Data request failed (${response.status})`;
        try {
          const body = await response.json();
          if (typeof body.error === "string" && body.error) {
            message = body.error;
          }
        } catch (_) {}
        throw new Error(message);
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Data request failed for ${path}`);
}

function buildPlayerBoardPath() {
  const params = new URLSearchParams();
  params.set("page", String(state.playerBoard.page));
  params.set("pageSize", String(state.playerBoard.pageSize));
  params.set("sort", state.sortKey);
  if (state.playerBoard.searchQuery.trim()) {
    params.set("query", state.playerBoard.searchQuery.trim());
  }
  if (state.roleFilter !== "All") {
    params.set("role", state.roleFilter);
  }
  return `/api/players?${params.toString()}`;
}

async function loadPlayerDetail(playerId, options = {}) {
  const requestId = ++playerDetailRequestId;
  state.selectedPlayerId = playerId;
  state.playerBoard.selectedPlayerLoading = true;
  state.playerBoard.selectedPlayerError = "";

  if (state.playerBoard.selectedPlayer?.id !== playerId) {
    state.playerBoard.selectedPlayer = null;
  }

  if (options.renderInterim !== false) {
    renderPlayers();
  }

  try {
    const payload = await fetchDashboardJson(`/api/players/${encodeURIComponent(playerId)}`, {
      apiBases: getPlayerApiBaseCandidates(),
    });
    if (requestId !== playerDetailRequestId) {
      return;
    }
    state.playerBoard.selectedPlayer = payload.data || null;
    state.playerBoard.selectedPlayerError = "";
  } catch (error) {
    if (requestId !== playerDetailRequestId) {
      return;
    }
    state.playerBoard.selectedPlayerError = error instanceof Error ? error.message : String(error);
    state.playerBoard.selectedPlayer = null;
  } finally {
    if (requestId !== playerDetailRequestId) {
      return;
    }
    state.playerBoard.selectedPlayerLoading = false;
    if (options.renderInterim !== false) {
      renderPlayers();
    }
  }
}

async function loadOverviewAndDefaultSchool() {
  state.overview.loading = true;
  state.explorer.selectedSchoolLoading = true;
  render();

  try {
    const summary = await fetchDashboardJson(`/api/schools/${DEFAULT_SCHOOL_SLUG}/live-summary`);
    state.overview.summary = summary;
    state.overview.error = "";

    if (state.explorer.selectedSchoolSlug === DEFAULT_SCHOOL_SLUG) {
      state.explorer.selectedSchoolSummary = summary;
      state.explorer.selectedSchoolError = "";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.overview.error = message;
    if (state.explorer.selectedSchoolSlug === DEFAULT_SCHOOL_SLUG) {
      state.explorer.selectedSchoolError = message;
    }
  } finally {
    state.overview.loading = false;
    if (state.explorer.selectedSchoolSlug === DEFAULT_SCHOOL_SLUG) {
      state.explorer.selectedSchoolLoading = false;
    }
    render();
  }
}

async function loadSchoolResults(query = state.explorer.schoolQuery) {
  state.explorer.schoolsLoading = true;
  state.explorer.schoolsError = "";
  renderExplorer();

  try {
    const payload = await fetchDashboardJson(`/api/schools?query=${encodeURIComponent(query)}&limit=${SCHOOL_SEARCH_LIMIT}`);
    state.explorer.schools = payload.data || [];
  } catch (error) {
    state.explorer.schoolsError = error instanceof Error ? error.message : String(error);
  } finally {
    state.explorer.schoolsLoading = false;
    renderExplorer();
  }
}

async function loadPlayerBoard(options = {}) {
  const requestId = ++playerBoardRequestId;
  state.playerBoard.sourceKey = PLAYER_BOARD_SOURCES.UNIFIED;
  state.playerBoard.loading = true;
  state.playerBoard.error = "";
  state.playerBoard.selectedPlayerError = "";
  if (options.resetPayload !== false) {
    state.playerBoard.payload = null;
  }

  if (options.renderInterim !== false) {
    renderPlayers();
  }

  try {
    const payload = await fetchDashboardJson(buildPlayerBoardPath(), {
      apiBases: getPlayerApiBaseCandidates(),
    });

    if (requestId !== playerBoardRequestId) {
      return;
    }
    state.playerBoard.payload = payload;
    state.playerBoard.error = "";
    state.playerBoard.loading = false;
    const nextSelectedId = state.selectedPlayerId || "";

    if (!nextSelectedId) {
      state.playerBoard.selectedPlayer = null;
      state.playerBoard.selectedPlayerLoading = false;
      if (options.renderInterim !== false) {
        renderPlayers();
      }
      return;
    }

    if (state.playerBoard.selectedPlayer?.id === nextSelectedId) {
      if (options.renderInterim !== false) {
        renderPlayers();
      }
      return;
    }

    if (state.playerBoard.profileOpen) {
      await loadPlayerDetail(nextSelectedId, { renderInterim: options.renderInterim });
      return;
    }

    if (options.renderInterim !== false) {
      renderPlayers();
    }
  } catch (error) {
    if (requestId !== playerBoardRequestId) {
      return;
    }
    state.playerBoard.error = error instanceof Error ? error.message : String(error);
    state.playerBoard.payload = null;
    state.playerBoard.selectedPlayer = null;
    state.playerBoard.selectedPlayerError = "";
    state.playerBoard.loading = false;
    state.selectedPlayerId = "";
  } finally {
    if (requestId !== playerBoardRequestId) {
      return;
    }
    state.playerBoard.loading = false;
    if (options.renderInterim !== false) {
      renderPlayers();
    }
  }
}

async function loadPlayerCoverage() {
  const requestId = ++playerCoverageRequestId;
  state.playerBoard.coverageLoading = true;
  state.playerBoard.coverageError = "";
  renderPlayerCoverage();

  try {
    const payload = await fetchDashboardJson("/api/players/coverage", {
      apiBases: getPlayerApiBaseCandidates(),
    });

    if (requestId !== playerCoverageRequestId) {
      return;
    }

    state.playerBoard.coverage = payload.data || null;
    state.playerBoard.coverageError = "";
  } catch (error) {
    if (requestId !== playerCoverageRequestId) {
      return;
    }

    state.playerBoard.coverage = null;
    state.playerBoard.coverageError = error instanceof Error ? error.message : String(error);
  } finally {
    if (requestId !== playerCoverageRequestId) {
      return;
    }

    state.playerBoard.coverageLoading = false;
    renderPlayerCoverage();
  }
}

async function loadSelectedSchoolSummary(schoolSlug) {
  const requestId = ++selectedSchoolRequestId;
  state.explorer.selectedSchoolSlug = schoolSlug;
  state.explorer.selectedSchoolLoading = true;
  state.explorer.selectedSchoolError = "";
  state.explorer.standings = null;
  state.explorer.standingsError = "";
  state.explorer.standingsLoading = false;
  state.explorer.opponentScout = null;
  state.explorer.opponentScoutError = "";
  state.explorer.opponentScoutLoading = false;
  renderExplorer();

  try {
    if (schoolSlug === DEFAULT_SCHOOL_SLUG && state.overview.summary) {
      if (requestId !== selectedSchoolRequestId) {
        return;
      }
      state.explorer.selectedSchoolSummary = state.overview.summary;
      state.explorer.selectedSchoolError = "";
      loadSelectedSchoolStandings(schoolSlug, { renderInterim: false });
      loadSelectedSchoolOpponentScout(schoolSlug, { renderInterim: false });
    } else {
      const summary = await fetchDashboardJson(`/api/schools/${encodeURIComponent(schoolSlug)}/live-summary`);
      if (requestId !== selectedSchoolRequestId) {
        return;
      }
      state.explorer.selectedSchoolSummary = summary;
      state.explorer.selectedSchoolError = "";
      loadSelectedSchoolStandings(schoolSlug, { renderInterim: false });
      loadSelectedSchoolOpponentScout(schoolSlug, { renderInterim: false });
    }
  } catch (error) {
    if (requestId !== selectedSchoolRequestId) {
      return;
    }
    state.explorer.selectedSchoolError = error instanceof Error ? error.message : String(error);
    state.explorer.opponentScout = null;
    state.explorer.opponentScoutError = "";
    state.explorer.opponentScoutLoading = false;
  } finally {
    if (requestId !== selectedSchoolRequestId) {
      return;
    }
    state.explorer.selectedSchoolLoading = false;
    render();
  }
}

async function loadSelectedSchoolStandings(schoolSlug, options = {}) {
  const requestId = ++selectedSchoolStandingsRequestId;
  state.explorer.standingsLoading = true;
  state.explorer.standingsError = "";
  state.explorer.standings = null;

  if (options.renderInterim !== false) {
    renderSelectedSchoolSummary();
  }

  try {
    const payload = await fetchDashboardJson(`/api/schools/${encodeURIComponent(schoolSlug)}/standings`);
    if (requestId !== selectedSchoolStandingsRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.standings = payload;
    state.explorer.standingsError = "";
  } catch (error) {
    if (requestId !== selectedSchoolStandingsRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.standingsError = error instanceof Error ? error.message : String(error);
    state.explorer.standings = null;
  } finally {
    if (requestId !== selectedSchoolStandingsRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.standingsLoading = false;
    renderSelectedSchoolSummary();
  }
}

async function loadSelectedSchoolOpponentScout(schoolSlug, options = {}) {
  const requestId = ++selectedSchoolOpponentScoutRequestId;
  state.explorer.opponentScoutLoading = true;
  state.explorer.opponentScoutError = "";
  state.explorer.opponentScout = null;

  if (options.renderInterim !== false) {
    renderSelectedSchoolSummary();
  }

  try {
    const params = new URLSearchParams();
    params.set("games", "3");
    params.set("lookback", "6");
    const payload = await fetchDashboardJson(
      `/api/schools/${encodeURIComponent(schoolSlug)}/opponent-scout?${params.toString()}`,
    );
    if (requestId !== selectedSchoolOpponentScoutRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.opponentScout = payload;
    state.explorer.opponentScoutError = "";
  } catch (error) {
    if (requestId !== selectedSchoolOpponentScoutRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.opponentScoutError = error instanceof Error ? error.message : String(error);
    state.explorer.opponentScout = null;
  } finally {
    if (requestId !== selectedSchoolOpponentScoutRequestId || schoolSlug !== state.explorer.selectedSchoolSlug) {
      return;
    }
    state.explorer.opponentScoutLoading = false;
    renderSelectedSchoolSummary();
  }
}

async function loadScoreboard() {
  state.explorer.scoreboardLoading = true;
  state.explorer.scoreboardError = "";
  renderExplorer();

  try {
    const payload = await fetchDashboardJson(`/api/scoreboard/baseball/d1/live?limit=${SCOREBOARD_LIMIT}`);
    state.explorer.scoreboard = payload;
    state.explorer.scoreboardError = "";

    const firstGameId = payload.data?.[0]?.gameId;
    if (!state.explorer.selectedGameId && firstGameId) {
      await loadGameDetail(firstGameId, { renderInterim: false });
    }
  } catch (error) {
    state.explorer.scoreboardError = error instanceof Error ? error.message : String(error);
  } finally {
    state.explorer.scoreboardLoading = false;
    renderExplorer();
  }
}

async function loadGameDetail(gameId, options = {}) {
  state.explorer.selectedGameId = gameId;
  state.explorer.selectedGameLoading = true;
  state.explorer.selectedGameError = "";
  if (options.renderInterim !== false) {
    renderExplorer();
  }

  try {
    const payload = await fetchDashboardJson(`/api/games/${encodeURIComponent(gameId)}/live-summary`);
    state.explorer.selectedGame = payload.data || null;
    state.explorer.selectedGameError = "";
  } catch (error) {
    state.explorer.selectedGameError = error instanceof Error ? error.message : String(error);
  } finally {
    state.explorer.selectedGameLoading = false;
    renderExplorer();
  }
}

roleFilterEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-role]");
  if (!button) {
    return;
  }

  state.roleFilter = button.dataset.role;
  state.playerBoard.page = 1;
  [...roleFilterEl.querySelectorAll("button")].forEach((node) => {
    node.classList.toggle("active", node === button);
  });
  loadPlayerBoard();
});

sortSelectEl.addEventListener("change", (event) => {
  state.sortKey = event.target.value;
  state.playerBoard.page = 1;
  loadPlayerBoard();
});

playerSearchEl.addEventListener("input", (event) => {
  state.playerBoard.searchQuery = event.target.value.trim();
  state.playerBoard.page = 1;
  clearTimeout(playerSearchTimer);
  playerSearchTimer = window.setTimeout(() => {
    loadPlayerBoard();
  }, 180);
});

playerPagePrevEl.addEventListener("click", () => {
  state.playerBoard.page = Math.max(1, state.playerBoard.page - 1);
  loadPlayerBoard();
});

playerPageNextEl.addEventListener("click", () => {
  state.playerBoard.page += 1;
  loadPlayerBoard();
});

playerTableBodyEl.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-player-id]");
  if (!row) {
    return;
  }
  const playerId = row.dataset.playerId;
  if (!playerId) {
    return;
  }
  openPlayerProfile(playerId);
});

playerTableBodyEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const row = event.target.closest("tr[data-player-id]");
  if (!row) {
    return;
  }
  event.preventDefault();
  const playerId = row.dataset.playerId;
  if (!playerId) {
    return;
  }
  openPlayerProfile(playerId);
});

schoolSearchEl.addEventListener("input", (event) => {
  state.explorer.schoolQuery = event.target.value.trim();
  clearTimeout(schoolSearchTimer);
  schoolSearchTimer = window.setTimeout(() => {
    loadSchoolResults(state.explorer.schoolQuery);
  }, 250);
});

schoolResultsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-school-slug]");
  if (!button) {
    return;
  }
  const schoolSlug = button.dataset.schoolSlug;
  if (!schoolSlug) {
    return;
  }
  loadSelectedSchoolSummary(schoolSlug);
});

scoreboardListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-game-id]");
  if (!button) {
    return;
  }
  const gameId = button.dataset.gameId;
  if (!gameId) {
    return;
  }
  loadGameDetail(gameId);
});

selectedSchoolGamesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-game-id]");
  if (!button) {
    return;
  }
  const gameId = button.dataset.gameId;
  if (!gameId) {
    return;
  }
  loadGameDetail(gameId);
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === "retry-overview") {
    loadOverviewAndDefaultSchool();
  } else if (action === "retry-schools") {
    loadSchoolResults();
  } else if (action === "retry-scoreboard") {
    loadScoreboard();
  }
});

if (playerProfileModalCloseEl) {
  playerProfileModalCloseEl.addEventListener("click", closePlayerProfile);
}

if (playerProfileModalBackEl) {
  playerProfileModalBackEl.addEventListener("click", (event) => {
    if (event.target === playerProfileModalBackEl) {
      closePlayerProfile();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.playerBoard.profileOpen) {
    closePlayerProfile();
  }
});

initPageNav();
render();
showDashboardPage("pagePlayers");
