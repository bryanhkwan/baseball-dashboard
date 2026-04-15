import toledoDataset from "../../../data/generated/toledo-baseball-2026.json" with { type: "json" };
import sidearmPoolDataset from "../../../data/generated/sidearm-pool-baseball-2026.json" with { type: "json" };
import sidearmRosterPoolDataset from "../../../data/generated/sidearm-roster-pool-baseball-2026.json" with { type: "json" };
import ncaaBoxscorePoolDataset from "../../../data/generated/ncaa-boxscore-pool-2026.json" with { type: "json" };

function normalizeKeyPart(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function roundTo(value, decimals = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function formatDecimal(value, digits = 3, dropLeadingZero = false) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const fixed = Number(value).toFixed(digits);
  return dropLeadingZero ? fixed.replace(/^0(?=\.)/, "") : fixed;
}

function formatAverage(value) {
  return formatDecimal(value, 3, true);
}

function inningsToDisplay(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }
  const whole = Math.floor(value);
  const outs = Math.round((value - whole) * 3);
  return `${whole}.${outs}`;
}

function choosePrimaryPosition(player = {}) {
  const positionsSeen = player.positionsSeen || [];
  return positionsSeen[0] || player.position || (player.role === "Pitcher" ? "RP" : "UTIL");
}

function rosterOnlyBaseScore(classYear = "", role = "") {
  const classScores = {
    GR: 18,
    SR: 16,
    JR: 14,
    SO: 12,
    FR: 10,
  };

  return (classScores[String(classYear || "").toUpperCase()] || 9) + (role === "Pitcher" ? 1 : 0);
}

function buildRosterPoolPlayer(player = {}) {
  const classYear = String(player.classYear || "").trim();
  const handedness = String(player.handedness || "").trim();
  const position = choosePrimaryPosition(player);
  const profileCompleteness = clamp(
    20 +
      (classYear ? 15 : 0) +
      (handedness ? 15 : 0) +
      (player.hometown ? 10 : 0) +
      (player.highSchool ? 10 : 0) +
      (player.previousSchool ? 10 : 0) +
      (player.profileUrl ? 20 : 0),
    15,
    100,
  );
  const score = Math.round(Math.min(28, rosterOnlyBaseScore(classYear, player.role) + profileCompleteness / 10));

  return {
    id: player.id,
    schoolSlug: player.schoolSlug,
    school: player.school,
    schoolLongName: player.schoolLongName,
    name: player.name,
    normalizedName: player.normalizedName,
    role: player.role,
    position,
    classYear,
    handedness,
    score,
    fit: fitLabel(score),
    metaLine: [classYear || "Roster", handedness || "School-site"].join(" / "),
    summary: `${player.name} is covered through the public school-site roster for ${player.school}. This keeps roster-only players visible before they show up in a reachable NCAA boxscore or leaderboard row.`,
    summaryMetrics: [classYear || "Class N/A", handedness || "B/T N/A", "Roster-only coverage"],
    detailBadges: [player.school, position, classYear, handedness, player.number ? `#${player.number}` : "", "Roster-only"].filter(Boolean),
    statCards: [
      { label: "Class", value: classYear || "N/A" },
      { label: "B/T", value: handedness || "N/A" },
      player.hometown ? { label: "Hometown", value: player.hometown } : null,
      player.highSchool ? { label: "High School", value: player.highSchool } : null,
      player.previousSchool ? { label: "Previous School", value: player.previousSchool } : null,
    ].filter(Boolean),
    components: {
      "Roster presence": 100,
      "Profile completeness": profileCompleteness,
    },
    sourceSummary: "Expanded school-site roster pool",
    profileUrl: player.profileUrl || "",
  };
}

function inflateRosterPoolPlayers(dataset = {}, options = {}) {
  const schools = dataset.schools || [];
  const excludedSchoolSlugs = options.excludedSchoolSlugs || new Set();
  const schoolMap = new Map(
    schools.map((school) => [school.slug, { name: school.name, longName: school.longName, slug: school.slug }]),
  );

  return (dataset.players || [])
    .map((row) => {
      const [
        id,
        schoolSlug,
        name,
        role,
        position,
        classYear,
        handedness,
        number,
        hometown,
        highSchool,
        previousSchool,
        profileUrl,
      ] = row;
      const school = schoolMap.get(schoolSlug) || { name: schoolSlug, longName: schoolSlug, slug: schoolSlug };

      if (excludedSchoolSlugs.has(school.slug)) {
        return null;
      }

      return buildRosterPoolPlayer({
        id,
        schoolSlug: school.slug,
        school: school.name,
        schoolLongName: school.longName,
        name,
        normalizedName: String(name || "").toLowerCase(),
        role: role === "Pitcher" ? "Pitcher" : "Hitter",
        position,
        classYear,
        handedness,
        number,
        hometown,
        highSchool,
        previousSchool,
        profileUrl,
      });
    })
    .filter(Boolean);
}

function buildBoxscorePoolHitter(player = {}) {
  const hitting = player.hittingSeason || {};
  const atBats = Number(hitting.atBats || 0);
  const runs = Number(hitting.runsScored || 0);
  const hits = Number(hitting.hits || 0);
  const runsBattedIn = Number(hitting.runsBattedIn || 0);
  const walks = Number(hitting.walks || 0);
  const strikeouts = Number(hitting.strikeouts || 0);
  const doubles = Number(hitting.doubles || 0);
  const triples = Number(hitting.triples || 0);
  const homeRuns = Number(hitting.homeRuns || 0);
  const totalBases = Number(hitting.totalBases || 0);
  const battingAverage = Number(hitting.battingAverage || 0);
  const onBasePercentage = Number(hitting.onBasePercentage || 0);
  const sluggingPercentage = Number(hitting.sluggingPercentage || 0);

  const components = {
    "On-base": Math.round(scale(onBasePercentage, 0.28, 0.46)),
    Power: Math.round(scale(sluggingPercentage, 0.32, 0.7)),
    Contact: Math.round(scale(battingAverage, 0.22, 0.38)),
    Discipline: Math.round(scale(safeDivide(walks, Math.max(strikeouts, 1), 0), 0.2, 1.1)),
    Production: Math.round(scale(hits + runs + runsBattedIn, 0, 80)),
  };

  const score = Math.round(
    components["On-base"] * 0.28 +
      components.Power * 0.22 +
      components.Contact * 0.18 +
      components.Discipline * 0.14 +
      components.Production * 0.18,
  );

  const position = choosePrimaryPosition(player);
  const gamesLabel = `${player.gamesTracked || 0} tracked game${player.gamesTracked === 1 ? "" : "s"}`;

  return {
    id: player.id,
    schoolSlug: player.schoolSlug,
    school: player.school,
    schoolLongName: player.schoolLongName,
    name: player.name,
    normalizedName: player.normalizedName,
    role: "Hitter",
    position,
    score,
    fit: fitLabel(score),
    metaLine: `${gamesLabel} / ${position}`,
    summary: `${player.name} is covered through ${gamesLabel} in the NCAA season boxscore pool for ${player.school}. Season line: AVG ${formatAverage(battingAverage)}, OBP ${formatAverage(onBasePercentage)}, SLG ${formatAverage(sluggingPercentage)} with ${hits} hits and ${runsBattedIn} RBI.`,
    summaryMetrics: [
      `AVG ${formatAverage(battingAverage)}`,
      `OBP ${formatAverage(onBasePercentage)}`,
      `SLG ${formatAverage(sluggingPercentage)}`,
      gamesLabel,
    ],
    detailBadges: [
      player.school,
      position,
      gamesLabel,
      player.number ? `#${player.number}` : "",
      player.lastSeenDate || "",
    ].filter(Boolean),
    statCards: [
      { label: "AVG", value: formatAverage(battingAverage) },
      { label: "OBP", value: formatAverage(onBasePercentage) },
      { label: "SLG", value: formatAverage(sluggingPercentage) },
      { label: "H", value: String(hits) },
      { label: "RBI", value: String(runsBattedIn) },
      { label: "HR", value: String(homeRuns) },
      { label: "BB", value: String(walks) },
      { label: "SO", value: String(strikeouts) },
      { label: "TB", value: String(totalBases) },
    ],
    components,
    sourceSummary: `NCAA season boxscore pool (${gamesLabel})`,
    latestTrackedGame: {
      gameId: player.latestGameId || "",
      description: player.latestGameDescription || "",
      date: player.lastSeenDate || "",
    },
  };
}

function buildBoxscorePoolPitcher(player = {}) {
  const pitching = player.pitchingTotals || {};
  const inningsPitched = Number(pitching.inningsPitched || 0);
  const inningsPitchedRaw = pitching.inningsPitchedRaw || inningsToDisplay(inningsPitched);
  const hitsAllowed = Number(pitching.hitsAllowed || 0);
  const earnedRunsAllowed = Number(pitching.earnedRunsAllowed || 0);
  const walksAllowed = Number(pitching.walksAllowed || 0);
  const strikeouts = Number(pitching.strikeouts || 0);
  const wins = Number(pitching.wins || 0);
  const saves = Number(pitching.saves || 0);
  const era = Number(pitching.earnedRunAverage || 0);
  const whip = Number(pitching.whip || 0);
  const strikeoutsPerNine = Number(pitching.strikeoutsPerNine || 0);
  const walksPerNine = Number(pitching.walksPerNine || 0);

  const components = {
    "Run prevention": Math.round(inverseScale(era, 8, 1)),
    "Traffic control": Math.round(inverseScale(whip, 2, 0.8)),
    "Miss bats": Math.round(scale(strikeoutsPerNine, 4, 15)),
    Command: Math.round(inverseScale(walksPerNine, 8, 0.4)),
    Results: Math.round(scale(wins + saves, 0, 12)),
  };

  const score = Math.round(
    components["Run prevention"] * 0.28 +
      components["Traffic control"] * 0.22 +
      components["Miss bats"] * 0.22 +
      components.Command * 0.16 +
      components.Results * 0.12,
  );

  const position = choosePrimaryPosition(player);
  const gamesLabel = `${player.gamesTracked || 0} tracked appearance${player.gamesTracked === 1 ? "" : "s"}`;

  return {
    id: player.id,
    schoolSlug: player.schoolSlug,
    school: player.school,
    schoolLongName: player.schoolLongName,
    name: player.name,
    normalizedName: player.normalizedName,
    role: "Pitcher",
    position,
    score,
    fit: fitLabel(score),
    metaLine: `${gamesLabel} / ${position}`,
    summary: `${player.name} is covered through ${gamesLabel} in the NCAA season boxscore pool for ${player.school}. Tracked line: ${inningsPitchedRaw} IP, ${strikeouts} K, ${walksAllowed} BB, ${hitsAllowed} H, ${earnedRunsAllowed} ER.`,
    summaryMetrics: [
      `ERA ${formatDecimal(era, 2)}`,
      `WHIP ${formatDecimal(whip, 2)}`,
      `K/9 ${formatDecimal(strikeoutsPerNine, 1)}`,
      gamesLabel,
    ],
    detailBadges: [
      player.school,
      position,
      gamesLabel,
      player.number ? `#${player.number}` : "",
      player.lastSeenDate || "",
    ].filter(Boolean),
    statCards: [
      { label: "ERA", value: formatDecimal(era, 2) },
      { label: "WHIP", value: formatDecimal(whip, 2) },
      { label: "IP", value: inningsPitchedRaw },
      { label: "K", value: String(strikeouts) },
      { label: "BB", value: String(walksAllowed) },
      { label: "H", value: String(hitsAllowed) },
      { label: "W", value: String(wins) },
      { label: "SV", value: String(saves) },
    ],
    components,
    sourceSummary: `NCAA season boxscore pool (${gamesLabel})`,
    latestTrackedGame: {
      gameId: player.latestGameId || "",
      description: player.latestGameDescription || "",
      date: player.lastSeenDate || "",
    },
  };
}

function normalizeBoxscorePoolPlayer(player = {}) {
  return player.role === "Pitcher" ? buildBoxscorePoolPitcher(player) : buildBoxscorePoolHitter(player);
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

function inflateBoxscorePoolPlayers(dataset = {}) {
  if (Array.isArray(dataset.players) && dataset.players.length) {
    const playerMap = new Map();
    dataset.players.forEach((player) => {
      const normalizedPlayer = {
        ...player,
        normalizedName: player.normalizedName || String(player.name || "").toLowerCase(),
        school: player.school || player.schoolSlug || "Unknown School",
        schoolLongName: player.schoolLongName || player.school || player.schoolSlug || "Unknown School",
      };
      const key = getRawBoxscorePlayerKey(normalizedPlayer);
      playerMap.set(key, mergeRawBoxscorePlayers(playerMap.get(key), normalizedPlayer));
    });

    return [...playerMap.values()].map((player) => normalizeBoxscorePoolPlayer(player));
  }

  const schools = dataset.schools || {};
  const hitters = (dataset.hitters || []).map((row) => {
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
      battingAverage,
      onBasePercentage,
      sluggingPercentage,
    ] = row;
    const school = schools[schoolSlug] || { name: schoolSlug, longName: schoolSlug };
    return normalizeBoxscorePoolPlayer({
      id,
      schoolSlug,
      school: school.name,
      schoolLongName: school.longName,
      name,
      role: "Hitter",
      position,
      number,
      gamesTracked,
      gamesStarted,
      lastSeenDate,
      latestGameId,
      hittingSeason: {
        atBats,
        runsScored,
        hits,
        runsBattedIn,
        walks,
        strikeouts,
        doubles,
        triples,
        homeRuns,
        totalBases: Number(hits || 0) + Number(doubles || 0) + Number(triples || 0) * 2 + Number(homeRuns || 0) * 3,
        battingAverage,
        onBasePercentage,
        sluggingPercentage,
      },
    });
  });

  const pitchers = (dataset.pitchers || []).map((row) => {
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
    const school = schools[schoolSlug] || { name: schoolSlug, longName: schoolSlug };
    const innings = Number(inningsPitched || 0);
    return normalizeBoxscorePoolPlayer({
      id,
      schoolSlug,
      school: school.name,
      schoolLongName: school.longName,
      name,
      role: "Pitcher",
      position,
      number,
      gamesTracked,
      gamesStarted,
      lastSeenDate,
      latestGameId,
      pitchingTotals: {
        inningsPitched: innings,
        inningsPitchedRaw: inningsToDisplay(innings),
        hitsAllowed,
        earnedRunsAllowed,
        walksAllowed,
        strikeouts,
        wins,
        losses,
        saves,
        earnedRunAverage: innings > 0 ? (Number(earnedRunsAllowed || 0) * 9) / innings : 0,
        whip: innings > 0 ? (Number(hitsAllowed || 0) + Number(walksAllowed || 0)) / innings : 0,
        strikeoutsPerNine: innings > 0 ? (Number(strikeouts || 0) * 9) / innings : 0,
        walksPerNine: innings > 0 ? (Number(walksAllowed || 0) * 9) / innings : 0,
      },
    });
  });

  return [...hitters, ...pitchers];
}

function getMergeKey(player = {}) {
  return [
    normalizeKeyPart(player.name),
    normalizeKeyPart(player.school),
    normalizeKeyPart(player.role),
  ].join("::");
}

function uniqueItems(values = []) {
  return [...new Set((values || []).filter(Boolean))];
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
    sourcePlayerIds: uniqueItems([...(player.sourcePlayerIds || []), player.id]),
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
  merged.sourcePlayerIds = uniqueItems([...(existing.sourcePlayerIds || []), ...(incoming.sourcePlayerIds || [])]);

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

function summarizeUniverseSources(boardCounts = {}, nationalError = "") {
  const parts = [];
  if (boardCounts.toledoSeasonRoster) {
    parts.push(`${boardCounts.toledoSeasonRoster} Toledo season`);
  }
  if (boardCounts.transferTargetsPool) {
    parts.push(`${boardCounts.transferTargetsPool} transfer pool`);
  }
  if (boardCounts.fullRosterPool) {
    parts.push(`${boardCounts.fullRosterPool} full roster pool`);
  }
  if (boardCounts.ncaaBoxscorePool) {
    parts.push(`${boardCounts.ncaaBoxscorePool} NCAA boxscore pool`);
  }
  if (boardCounts.nationalBoard) {
    parts.push(`${boardCounts.nationalBoard} national API`);
  }
  if (!parts.length) {
    return nationalError ? `Sources unavailable: ${nationalError}` : "Sources unavailable";
  }
  return parts.join(" • ");
}

function getLocalPlayerSourcePayloads() {
  const sourcePayloads = [];
  const fullRosterSchoolSlugs = new Set();

  if (toledoDataset?.playerBoard?.players?.length) {
    if (toledoDataset.school?.slug) {
      fullRosterSchoolSlugs.add(toledoDataset.school.slug);
    }
    sourcePayloads.push({
      label: "Toledo season roster",
      countKey: "toledoSeasonRoster",
      payload: {
        ...toledoDataset.playerBoard,
        school: toledoDataset.school,
        teamSummary: toledoDataset.teamSummary,
        coverage: toledoDataset.coverage,
        generatedAt: toledoDataset.generatedAt,
        source: toledoDataset.playerBoard?.source || "Toledo Athletics roster + cumulative stats",
      },
    });
  }

  if (sidearmPoolDataset?.playerBoard?.players?.length) {
    (sidearmPoolDataset.schools || []).forEach((school) => {
      if (school.slug) {
        fullRosterSchoolSlugs.add(school.slug);
      }
    });
    sourcePayloads.push({
      label: "Transfer targets pool",
      countKey: "transferTargetsPool",
      payload: {
        ...sidearmPoolDataset.playerBoard,
        schools: sidearmPoolDataset.schools,
        coverage: sidearmPoolDataset.coverage,
        generatedAt: sidearmPoolDataset.generatedAt,
        source: sidearmPoolDataset.playerBoard?.source || "Generated Sidearm baseball school-site pool",
        note: sidearmPoolDataset.playerBoard?.note || sidearmPoolDataset.note,
      },
    });
  }

  const rosterPoolPlayers = inflateRosterPoolPlayers(sidearmRosterPoolDataset, {
    excludedSchoolSlugs: fullRosterSchoolSlugs,
  });
  if (rosterPoolPlayers.length) {
    sourcePayloads.push({
      label: "Full roster pool",
      countKey: "fullRosterPool",
      payload: {
        players: rosterPoolPlayers,
        schools: sidearmRosterPoolDataset.schools,
        coverage: sidearmRosterPoolDataset.coverage,
        generatedAt: sidearmRosterPoolDataset.generatedAt,
        source: sidearmRosterPoolDataset.source,
        note: sidearmRosterPoolDataset.note,
      },
    });
  }

  const boxscorePoolPlayers = inflateBoxscorePoolPlayers(ncaaBoxscorePoolDataset);
  if (boxscorePoolPlayers.length) {
    sourcePayloads.push({
      label: "NCAA boxscore pool",
      countKey: "ncaaBoxscorePool",
      payload: {
        players: boxscorePoolPlayers,
        coverage: ncaaBoxscorePoolDataset.coverage,
        generatedAt: ncaaBoxscorePoolDataset.generatedAt,
        source: ncaaBoxscorePoolDataset.source,
        note: ncaaBoxscorePoolDataset.note,
      },
    });
  }

  return sourcePayloads;
}

function getCoverageSourceType(countKey = "") {
  if (["toledoSeasonRoster", "transferTargetsPool", "fullRosterPool"].includes(countKey)) {
    return "fullRoster";
  }
  if (countKey === "ncaaBoxscorePool") {
    return "boxscore";
  }
  if (countKey === "nationalBoard") {
    return "leaderboard";
  }
  return "";
}

function getCoverageSchoolEntry(schoolMap, details = {}) {
  const schoolKey = normalizeKeyPart(details.schoolSlug || details.name || details.longName || "unknown-school");
  if (!schoolMap.has(schoolKey)) {
    schoolMap.set(schoolKey, {
      schoolSlug: details.schoolSlug || schoolKey,
      name: details.name || details.schoolSlug || schoolKey,
      longName: details.longName || details.name || details.schoolSlug || schoolKey,
      sourceFlags: {
        fullRoster: false,
        boxscore: false,
        leaderboard: false,
      },
      playerKeys: {
        fullRoster: new Set(),
        boxscore: new Set(),
        leaderboard: new Set(),
      },
      universePlayers: 0,
      roleCounts: {
        Hitter: 0,
        Pitcher: 0,
      },
    });
  }

  const entry = schoolMap.get(schoolKey);
  entry.schoolSlug = entry.schoolSlug || details.schoolSlug || schoolKey;
  entry.name = entry.name || details.name || entry.schoolSlug;
  entry.longName = entry.longName || details.longName || entry.name || entry.schoolSlug;
  return entry;
}

function seedCoverageSchools(schoolMap, payload = {}, sourceType = "") {
  if (!sourceType) {
    return;
  }

  if (payload.school) {
    const entry = getCoverageSchoolEntry(schoolMap, {
      schoolSlug: payload.school.slug,
      name: payload.school.name,
      longName: payload.school.longName,
    });
    entry.sourceFlags[sourceType] = true;
  }

  if (Array.isArray(payload.schools)) {
    payload.schools.forEach((school) => {
      const entry = getCoverageSchoolEntry(schoolMap, {
        schoolSlug: school.slug,
        name: school.name,
        longName: school.longName,
      });
      entry.sourceFlags[sourceType] = true;
    });
  }

  if (payload.schools && !Array.isArray(payload.schools)) {
    Object.entries(payload.schools).forEach(([schoolSlug, school]) => {
      const entry = getCoverageSchoolEntry(schoolMap, {
        schoolSlug,
        name: school.name,
        longName: school.longName,
      });
      entry.sourceFlags[sourceType] = true;
    });
  }
}

function buildSchoolCoverage(sourcePayloads = [], players = [], boardCoverage = "", note = "", boardCounts = {}) {
  const schoolMap = new Map();

  sourcePayloads.forEach(({ countKey, payload }) => {
    const sourceType = getCoverageSourceType(countKey);
    if (!sourceType) {
      return;
    }

    seedCoverageSchools(schoolMap, payload, sourceType);
    (payload?.players || []).forEach((player) => {
      const entry = getCoverageSchoolEntry(schoolMap, {
        schoolSlug: player.schoolSlug,
        name: player.school,
        longName: player.schoolLongName,
      });
      entry.sourceFlags[sourceType] = true;
      entry.playerKeys[sourceType].add(getMergeKey(player));
    });
  });

  (players || []).forEach((player) => {
    const entry = getCoverageSchoolEntry(schoolMap, {
      schoolSlug: player.schoolSlug,
      name: player.school,
      longName: player.schoolLongName,
    });
    entry.universePlayers += 1;
    if (player.role === "Pitcher") {
      entry.roleCounts.Pitcher += 1;
    } else {
      entry.roleCounts.Hitter += 1;
    }
  });

  const statusOrder = {
    "full-roster": 0,
    "boxscore-only": 1,
    "leaderboard-only": 2,
  };

  const schools = [...schoolMap.values()]
    .map((entry) => {
      const playerCounts = {
        fullRoster: entry.playerKeys.fullRoster.size,
        boxscore: entry.playerKeys.boxscore.size,
        leaderboard: entry.playerKeys.leaderboard.size,
      };
      const hasFullRoster = entry.sourceFlags.fullRoster || playerCounts.fullRoster > 0;
      const hasBoxscore = entry.sourceFlags.boxscore || playerCounts.boxscore > 0;
      const hasLeaderboard = entry.sourceFlags.leaderboard || playerCounts.leaderboard > 0;
      const status = hasFullRoster ? "full-roster" : hasBoxscore ? "boxscore-only" : "leaderboard-only";
      const statusLabel =
        status === "full-roster"
          ? "Full roster"
          : status === "boxscore-only"
            ? "Boxscore only"
            : "Leaderboard only";
      const sources = [hasFullRoster ? "Full roster" : "", hasBoxscore ? "Boxscore" : "", hasLeaderboard ? "Leaderboard" : ""].filter(
        Boolean,
      );

      return {
        schoolSlug: entry.schoolSlug,
        name: entry.name,
        longName: entry.longName,
        status,
        statusLabel,
        sources,
        sourceSummary: sources.join(" • "),
        sourceNote: hasFullRoster
          ? "A school-site roster ingest is available for this school."
          : hasBoxscore
            ? "Coverage is coming from tracked NCAA boxscores, so pure roster-only players can still be missing."
            : "Coverage is only coming from leaderboard rows right now.",
        playerCounts,
        universePlayers: entry.universePlayers,
        roleCounts: entry.roleCounts,
      };
    })
    .filter((entry) => entry.sources.length > 0 || entry.universePlayers > 0)
    .sort((left, right) => {
      if (statusOrder[left.status] !== statusOrder[right.status]) {
        return statusOrder[left.status] - statusOrder[right.status];
      }
      if (right.universePlayers !== left.universePlayers) {
        return right.universePlayers - left.universePlayers;
      }
      return left.name.localeCompare(right.name);
    });

  const summary = schools.reduce(
    (totals, school) => {
      if (school.status === "full-roster") {
        totals.fullRosterSchools += 1;
      } else if (school.status === "boxscore-only") {
        totals.boxscoreOnlySchools += 1;
      } else {
        totals.leaderboardOnlySchools += 1;
      }

      totals.sourceSchoolCounts.fullRoster += school.sources.includes("Full roster") ? 1 : 0;
      totals.sourceSchoolCounts.boxscore += school.sources.includes("Boxscore") ? 1 : 0;
      totals.sourceSchoolCounts.leaderboard += school.sources.includes("Leaderboard") ? 1 : 0;
      totals.sourcePlayerCounts.fullRoster += school.playerCounts.fullRoster;
      totals.sourcePlayerCounts.boxscore += school.playerCounts.boxscore;
      totals.sourcePlayerCounts.leaderboard += school.playerCounts.leaderboard;
      return totals;
    },
    {
      totalCoveredSchools: schools.length,
      totalUniversePlayers: (players || []).length,
      fullRosterSchools: 0,
      boxscoreOnlySchools: 0,
      leaderboardOnlySchools: 0,
      sourceSchoolCounts: {
        fullRoster: 0,
        boxscore: 0,
        leaderboard: 0,
      },
      sourcePlayerCounts: {
        fullRoster: 0,
        boxscore: 0,
        leaderboard: 0,
      },
      nationalBoardAvailable: Boolean(boardCounts.nationalBoard),
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    boardCoverage,
    note,
    summary,
    schools,
  };
}

export function buildPlayerUniverse({ nationalPayload = null, nationalError = "" } = {}) {
  const playerMap = new Map();
  const boardCounts = {};
  const sourcePayloads = getLocalPlayerSourcePayloads();

  if (nationalPayload?.players?.length) {
    sourcePayloads.push({
      label: "National API board",
      countKey: "nationalBoard",
      payload: nationalPayload,
    });
  }

  sourcePayloads.forEach(({ label, countKey, payload }) => {
    (payload?.players || []).forEach((player) => {
      boardCounts[countKey] = (boardCounts[countKey] || 0) + 1;
      const taggedPlayer = attachBoardOrigin(player, label);
      const mergeKey = getMergeKey(taggedPlayer);
      playerMap.set(mergeKey, mergeUnifiedPlayers(playerMap.get(mergeKey), taggedPlayer));
    });
  });

  const players = [...playerMap.entries()]
    .map(([id, player]) => ({
      ...player,
      id,
      canonicalId: id,
    }))
    .sort((left, right) => {
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

  const boardCoverage = summarizeUniverseSources(boardCounts, nationalError);
  const note = [
    boardCounts.fullRosterPool && boardCounts.ncaaBoxscorePool && nationalPayload?.players?.length
      ? "Unified player universe merges stored school datasets, the expanded full-roster pool, the NCAA season boxscore pool, and the API-backed national player board."
      : boardCounts.fullRosterPool && boardCounts.ncaaBoxscorePool
        ? "Unified player universe merges stored school datasets, the expanded full-roster pool, and the NCAA season boxscore pool."
        : boardCounts.fullRosterPool
          ? "Unified player universe merges stored school datasets with the expanded full-roster pool."
          : boardCounts.ncaaBoxscorePool && nationalPayload?.players?.length
            ? "Unified player universe merges stored school datasets, the NCAA season boxscore pool, and the API-backed national player board."
            : boardCounts.ncaaBoxscorePool
              ? "Unified player universe merges stored school datasets with the NCAA season boxscore pool."
              : nationalPayload?.players?.length
                ? "Unified player universe merges stored school datasets with the API-backed national player board."
                : "Unified player universe is using stored school datasets only right now.",
    nationalPayload?.note || "",
    !nationalPayload && nationalError ? `National API unavailable right now: ${nationalError}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const schoolCoverage = buildSchoolCoverage(sourcePayloads, players, boardCoverage, note, boardCounts);

  return {
    source: "Stored player universe",
    generatedAt: new Date().toISOString(),
    totalPlayers: players.length,
    roleCounts,
    boardCounts,
    boardCoverage,
    note,
    schoolCoverage,
    players,
  };
}

export function queryPlayerUniverse(universe, options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const role = String(options.role || "All");
  const position = String(options.position || "").trim().toLowerCase();
  const sort = String(options.sort || "score");
  const pageSize = clamp(Number.parseInt(String(options.pageSize || "40"), 10) || 40, 10, 100);

  let filtered = role === "All" ? [...(universe.players || [])] : (universe.players || []).filter((player) => player.role === role);

  if (position) {
    filtered = filtered.filter((player) => String(player.position || "").toLowerCase().includes(position));
  }

  if (query) {
    filtered = filtered.filter((player) => {
      const haystack = [player.name, player.school, player.position, player.classYear, player.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  filtered.sort((left, right) => {
    if (sort === "name") {
      return left.name.localeCompare(right.name);
    }
    if (sort === "position") {
      return String(left.position || "").localeCompare(String(right.position || ""));
    }
    return right.score - left.score;
  });

  const totalPlayers = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalPlayers / pageSize));
  const page = clamp(Number.parseInt(String(options.page || "1"), 10) || 1, 1, totalPages);
  const startIndex = (page - 1) * pageSize;
  const data = filtered.slice(startIndex, startIndex + pageSize).map((player) => ({
    id: player.id,
    name: player.name,
    school: player.school,
    schoolSlug: player.schoolSlug,
    schoolLongName: player.schoolLongName,
    role: player.role,
    position: player.position,
    classYear: player.classYear,
    handedness: player.handedness,
    number: player.number,
    metaLine: player.metaLine,
    summary: player.summary,
    summaryMetrics: player.summaryMetrics,
    detailBadges: player.detailBadges,
    statCards: player.statCards,
    components: player.components,
    boardOrigins: player.boardOrigins,
    sourceSummary: player.sourceSummary,
    profileUrl: player.profileUrl,
    imageUrl: player.imageUrl,
    latestGameImpact: player.latestGameImpact,
    recentTrend: player.recentTrend,
    sourceGame: player.sourceGame,
    score: player.score,
    fit: player.fit,
  }));

  return {
    source: universe.source,
    generatedAt: universe.generatedAt,
    totalPlayers,
    totalPages,
    page,
    pageSize,
    query,
    role,
    sort,
    boardCoverage: universe.boardCoverage,
    roleCounts: universe.roleCounts,
    note: universe.note,
    data,
  };
}

export function getUniversePlayerById(universe, playerId) {
  return (universe.players || []).find((player) => player.id === playerId) || null;
}
