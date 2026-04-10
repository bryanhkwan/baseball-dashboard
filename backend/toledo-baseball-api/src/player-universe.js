import toledoDataset from "../../../data/generated/toledo-baseball-2026.json" with { type: "json" };
import sidearmPoolDataset from "../../../data/generated/sidearm-pool-baseball-2026.json" with { type: "json" };

function normalizeKeyPart(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  if (toledoDataset?.playerBoard?.players?.length) {
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

  return sourcePayloads;
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

  return {
    source: "Stored player universe",
    generatedAt: new Date().toISOString(),
    totalPlayers: players.length,
    roleCounts,
    boardCounts,
    boardCoverage: summarizeUniverseSources(boardCounts, nationalError),
    note: [
      nationalPayload?.players?.length
        ? "Unified player universe merges stored school datasets with the API-backed national player board."
        : "Unified player universe is using stored school datasets only right now.",
      nationalPayload?.note || "",
      !nationalPayload && nationalError ? `National API unavailable right now: ${nationalError}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    players,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
    role: player.role,
    position: player.position,
    metaLine: player.metaLine,
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