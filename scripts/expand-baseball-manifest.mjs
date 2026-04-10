import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const NCAA_API_BASE = "https://ncaa-api.henrygd.me";
const DEFAULT_MANIFEST_PATH = path.join(REPO_ROOT, "data", "school-manifest.baseball.json");
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, "data", "school-manifest.baseball.expanded.json");
const DEFAULT_LOOKBACK_DAYS = 21;
const DEFAULT_LOOKAHEAD_DAYS = 7;
const DEFAULT_LEADERBOARD_PAGES = 3;

const MANUAL_ALIAS_OVERRIDES = {
  [normalizeKey("NC State")]: "north-carolina-st",
  [normalizeKey("Coastal Carolina")]: "coastal-caro",
  [normalizeKey("Mount St. Mary's")]: "mt-st-marys",
  [normalizeKey("Mount St Mary's")]: "mt-st-marys",
  [normalizeKey("Mount Saint Mary's")]: "mt-st-marys",
  [normalizeKey("CSUN")]: "cal-st-northridge",
  [normalizeKey("ULM")]: "la-monroe",
  [normalizeKey("NIU")]: "northern-ill",
  [normalizeKey("Sam Houston")]: "sam-houston-st",
  [normalizeKey("A&M-Corpus Christi")]: "am-corpus-chris",
  [normalizeKey("Texas A&M-Corpus Christi")]: "am-corpus-chris",
  [normalizeKey("DBU")]: "dallas-baptist",
  [normalizeKey("ETSU")]: "east-tenn-st",
  [normalizeKey("App State")]: "appalachian-st",
  [normalizeKey("Louisiana")]: "la-lafayette",
  [normalizeKey("Nicholls")]: "nicholls-st",
  [normalizeKey("McNeese")]: "mcneese-st",
  [normalizeKey("SFA")]: "stephen-f-austin",
  [normalizeKey("UIC")]: "ill-chicago",
  [normalizeKey("UMES")]: "md-east-shore",
  [normalizeKey("UT Arlington")]: "texas-arlington",
  [normalizeKey("Seattle U")]: "seattle",
  [normalizeKey("UAlbany")]: "albany-ny",
  [normalizeKey("Saint Joseph's")]: "saint-josephs",
  [normalizeKey("St. Joseph's")]: "saint-josephs",
};

const LEADERBOARD_SPECS = [
  { id: 200, label: "Batting Average" },
  { id: 470, label: "Home Runs" },
  { id: 487, label: "Runs Batted In" },
  { id: 492, label: "Stolen Bases" },
  { id: 205, label: "Earned Run Average" },
  { id: 207, label: "Strikeouts Per Nine Innings" },
  { id: 208, label: "Victories" },
  { id: 209, label: "Saves" },
];

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST_PATH,
    output: DEFAULT_OUTPUT_PATH,
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    lookaheadDays: DEFAULT_LOOKAHEAD_DAYS,
    leaderboardPages: DEFAULT_LEADERBOARD_PAGES,
    write: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--manifest") {
      options.manifest = path.resolve(process.cwd(), argv[index + 1] || options.manifest);
      index += 1;
      continue;
    }

    if (token === "--output") {
      options.output = path.resolve(process.cwd(), argv[index + 1] || options.output);
      index += 1;
      continue;
    }

    if (token === "--lookback-days") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.lookbackDays = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--lookahead-days") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.lookaheadDays = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--leaderboard-pages") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.leaderboardPages = parsed;
      }
      index += 1;
      continue;
    }

    if (token === "--write") {
      options.write = true;
    }
  }

  return options;
}

function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value = "") {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value = "") {
  return normalizeKey(value).replace(/\s+/g, "-");
}

function buildNameVariants(value = "") {
  const raw = normalizeWhitespace(value);
  const variants = new Set();

  if (!raw) {
    return variants;
  }

  const rawVariants = new Set([
    raw,
    raw.replace(/\([^)]*\)/g, " "),
    raw.replace(/\./g, " "),
  ]);

  for (const item of rawVariants) {
    variants.add(normalizeKey(item));
    variants.add(normalizeKey(item.replace(/\bst\b\.?/gi, " state ")));
    variants.add(normalizeKey(item.replace(/\bst\b\.?/gi, " saint ")));
    variants.add(normalizeKey(item.replace(/\buniv\b\.?/gi, " university ")));
    variants.add(normalizeKey(item.replace(/\bmich\b\.?/gi, " michigan ")));
    variants.add(normalizeKey(item.replace(/\btenn\b\.?/gi, " tennessee ")));
    variants.add(normalizeKey(item.replace(/\bky\b\.?/gi, " kentucky ")));
    variants.add(normalizeKey(item.replace(/\bala\b\.?/gi, " alabama ")));
    variants.add(normalizeKey(item.replace(/\bmiss\b\.?/gi, " mississippi ")));
    variants.add(normalizeKey(item.replace(/\bark\b\.?/gi, " arkansas ")));
    variants.add(normalizeKey(item.replace(/\bfla\b\.?/gi, " florida ")));
    variants.add(normalizeKey(item.replace(/\bga\b\.?/gi, " georgia ")));
    variants.add(normalizeKey(item.replace(/\bill\b\.?/gi, " illinois ")));
    variants.add(normalizeKey(item.replace(/\bind\b\.?/gi, " indiana ")));
    variants.add(normalizeKey(item.replace(/\btex\b\.?/gi, " texas ")));
    variants.add(normalizeKey(item.replace(/\bcolo\b\.?/gi, " colorado ")));
  }

  variants.delete("");
  return variants;
}

function titleCaseSlug(slug = "") {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readInt(value, fallback = 1, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function formatIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatApiDate(date) {
  return formatIsoDate(date).replace(/-/g, "/");
}

function addDays(date, delta) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
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

function buildSchoolAliasMap(schools) {
  const bySlug = new Map();
  const aliasMap = new Map();
  const exactNameMap = new Map();

  for (const school of schools) {
    const slug = slugify(school.slug || school.name || school.long);
    if (!slug) {
      continue;
    }

    const normalizedSchool = {
      slug,
      name: normalizeWhitespace(school.name || titleCaseSlug(slug)),
      long: normalizeWhitespace(school.long || school.name || titleCaseSlug(slug)),
    };

    bySlug.set(slug, normalizedSchool);

    const exactNameKey = normalizeKey(normalizedSchool.name);
    if (exactNameKey) {
      const candidates = exactNameMap.get(exactNameKey) || new Set();
      candidates.add(slug);
      exactNameMap.set(exactNameKey, candidates);
    }

    const aliasKeys = new Set([
      ...buildNameVariants(normalizedSchool.slug.replace(/-/g, " ")),
      ...buildNameVariants(normalizedSchool.name),
      ...buildNameVariants(normalizedSchool.long),
    ]);

    if (slug.endsWith("-st")) {
      aliasKeys.add(normalizeKey(`${slug.slice(0, -3).replace(/-/g, " ")} state`));
    }

    for (const aliasKey of aliasKeys) {
      if (!aliasKey) {
        continue;
      }
      const candidates = aliasMap.get(aliasKey) || new Set();
      candidates.add(slug);
      aliasMap.set(aliasKey, candidates);
    }
  }

  return { bySlug, aliasMap, exactNameMap };
}

function resolveSchoolByName(name, aliasMap, exactNameMap, schoolsBySlug) {
  const manualSlug = MANUAL_ALIAS_OVERRIDES[normalizeKey(name)];
  if (manualSlug && schoolsBySlug.has(manualSlug)) {
    return schoolsBySlug.get(manualSlug);
  }

  const exactNameMatches = exactNameMap.get(normalizeKey(name));
  if (exactNameMatches?.size === 1) {
    return schoolsBySlug.get([...exactNameMatches][0]) || null;
  }

  const scores = new Map();

  for (const aliasKey of buildNameVariants(name)) {
    const matches = aliasMap.get(aliasKey);
    if (!matches) {
      continue;
    }

    for (const slug of matches) {
      scores.set(slug, (scores.get(slug) || 0) + 1);
    }
  }

  const ranked = [...scores.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  if (!ranked.length) {
    return null;
  }

  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    return null;
  }

  return schoolsBySlug.get(ranked[0][0]) || null;
}

function upsertEvidence(evidenceBySlug, school, details = {}) {
  const slug = slugify(school.slug || school.name || school.long);
  if (!slug) {
    return;
  }

  const current = evidenceBySlug.get(slug) || {
    school: {
      slug,
      name: normalizeWhitespace(school.name || titleCaseSlug(slug)),
      long: normalizeWhitespace(school.long || school.name || titleCaseSlug(slug)),
    },
    sources: new Set(),
    scoreboardDates: new Set(),
    scoreboardAppearances: 0,
    leaderboardCategories: new Set(),
    leaderboardHits: 0,
    matchedNames: new Set(),
  };

  current.school = {
    slug,
    name: normalizeWhitespace(school.name || current.school.name || titleCaseSlug(slug)),
    long: normalizeWhitespace(school.long || current.school.long || school.name || titleCaseSlug(slug)),
  };

  if (details.source) {
    current.sources.add(details.source);
  }

  if (details.source === "scoreboard") {
    current.scoreboardAppearances += 1;
    if (details.date) {
      current.scoreboardDates.add(details.date);
    }
  }

  if (details.source === "leaderboard") {
    current.leaderboardHits += 1;
    if (details.category) {
      current.leaderboardCategories.add(details.category);
    }
    if (details.rawName) {
      current.matchedNames.add(normalizeWhitespace(details.rawName));
    }
  }

  evidenceBySlug.set(slug, current);
}

async function discoverScoreboardSchools(options, schoolsBySlug) {
  const baseDate = new Date();
  const offsets = Array.from(
    { length: options.lookbackDays + options.lookaheadDays + 1 },
    (_, index) => index - options.lookbackDays,
  );
  const days = offsets.map((offset) => {
    const date = addDays(baseDate, offset);
    return {
      isoDate: formatIsoDate(date),
      apiDate: formatApiDate(date),
    };
  });

  const warnings = [];
  const evidenceBySlug = new Map();

  const payloads = await mapWithConcurrency(days, 4, async (day) => {
    try {
      const payload = await fetchJson(`${NCAA_API_BASE}/scoreboard/baseball/d1/${day.apiDate}/all-conf`);
      return { day, payload };
    } catch (error) {
      return { day, error };
    }
  });

  for (const item of payloads) {
    if (item.error) {
      warnings.push(`Scoreboard ${item.day.isoDate}: ${item.error instanceof Error ? item.error.message : String(item.error)}`);
      continue;
    }

    for (const wrapper of item.payload.games || []) {
      const game = wrapper?.game || wrapper;
      for (const sideKey of ["away", "home"]) {
        const side = game?.[sideKey];
        const seoSlug = slugify(side?.names?.seo || "");
        if (!seoSlug) {
          continue;
        }
        const school = schoolsBySlug.get(seoSlug) || {
          slug: seoSlug,
          name: normalizeWhitespace(side?.names?.short || titleCaseSlug(seoSlug)),
          long: normalizeWhitespace(side?.names?.full || side?.names?.short || titleCaseSlug(seoSlug)),
        };
        upsertEvidence(evidenceBySlug, school, {
          source: "scoreboard",
          date: item.day.isoDate,
        });
      }
    }
  }

  return { evidenceBySlug, warnings, baseDate };
}

async function discoverLeaderboardSchools(options, aliasMap, exactNameMap, schoolsBySlug) {
  const evidenceBySlug = new Map();
  const unresolved = new Map();
  const warnings = [];

  const payloads = await mapWithConcurrency(LEADERBOARD_SPECS, 2, async (spec) => {
    try {
      const firstPage = await fetchJson(`${NCAA_API_BASE}/stats/baseball/d1/current/individual/${spec.id}`);
      const totalPages = Math.min(readInt(firstPage.pages, 1, 1, 20), options.leaderboardPages);
      const pages = [firstPage, ...(await mapWithConcurrency(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2),
        2,
        async (pageNumber) => fetchJson(`${NCAA_API_BASE}/stats/baseball/d1/current/individual/${spec.id}?page=${pageNumber}`),
      ))];
      return { spec, pages };
    } catch (error) {
      return { spec, error };
    }
  });

  for (const item of payloads) {
    if (item.error) {
      warnings.push(`Leaderboard ${item.spec.label}: ${item.error instanceof Error ? item.error.message : String(item.error)}`);
      continue;
    }

    for (const page of item.pages) {
      for (const row of page.data || []) {
        const teamName = normalizeWhitespace(row.Team || "");
        if (!teamName) {
          continue;
        }

        const school = resolveSchoolByName(teamName, aliasMap, exactNameMap, schoolsBySlug);
        if (!school) {
          const current = unresolved.get(teamName) || {
            count: 0,
            categories: new Set(),
          };
          current.count += 1;
          current.categories.add(item.spec.label);
          unresolved.set(teamName, current);
          continue;
        }

        upsertEvidence(evidenceBySlug, school, {
          source: "leaderboard",
          category: item.spec.label,
          rawName: teamName,
        });
      }
    }
  }

  return { evidenceBySlug, unresolved, warnings };
}

function isReadyTeam(team = {}) {
  return (
    team.enabled !== false &&
    Boolean(team.schoolSiteBase) &&
    Boolean(team.rosterPath) &&
    Boolean(team.statsPath)
  );
}

function buildDiscoveryPayload(existingDiscovery = {}, evidence, includeSeedManifest) {
  const payload = { ...(existingDiscovery || {}) };
  const sources = new Set(existingDiscovery?.sources || []);
  const scoreboardDates = new Set(existingDiscovery?.scoreboardDates || []);
  const leaderboardCategories = new Set(existingDiscovery?.leaderboardCategories || []);
  const matchedNames = new Set(existingDiscovery?.matchedNames || []);
  let scoreboardAppearances = readInt(existingDiscovery?.scoreboardAppearances, 0, 0);
  let leaderboardHits = readInt(existingDiscovery?.leaderboardHits, 0, 0);

  if (includeSeedManifest) {
    sources.add("seed-manifest");
  }

  if (evidence) {
    for (const source of evidence.sources) {
      sources.add(source);
    }
    for (const date of evidence.scoreboardDates) {
      scoreboardDates.add(date);
    }
    for (const category of evidence.leaderboardCategories) {
      leaderboardCategories.add(category);
    }
    for (const matchedName of evidence.matchedNames) {
      matchedNames.add(matchedName);
    }
    scoreboardAppearances += evidence.scoreboardAppearances;
    leaderboardHits += evidence.leaderboardHits;
  }

  payload.sources = [...sources].sort();

  if (scoreboardAppearances > 0) {
    payload.scoreboardAppearances = scoreboardAppearances;
  } else {
    delete payload.scoreboardAppearances;
  }

  if (scoreboardDates.size) {
    payload.scoreboardDates = [...scoreboardDates].sort();
    payload.lastSeenDate = payload.scoreboardDates[payload.scoreboardDates.length - 1];
  } else {
    delete payload.scoreboardDates;
    delete payload.lastSeenDate;
  }

  if (leaderboardHits > 0) {
    payload.leaderboardHits = leaderboardHits;
  } else {
    delete payload.leaderboardHits;
  }

  if (leaderboardCategories.size) {
    payload.leaderboardCategories = [...leaderboardCategories].sort();
  } else {
    delete payload.leaderboardCategories;
  }

  if (matchedNames.size) {
    payload.matchedNames = [...matchedNames].sort();
  } else {
    delete payload.matchedNames;
  }

  return payload;
}

function mergeEvidenceMaps(...maps) {
  const merged = new Map();

  for (const map of maps) {
    for (const evidence of map.values()) {
      const current = merged.get(evidence.school.slug) || {
        school: {
          slug: evidence.school.slug,
          name: evidence.school.name,
          long: evidence.school.long,
        },
        sources: new Set(),
        scoreboardDates: new Set(),
        scoreboardAppearances: 0,
        leaderboardCategories: new Set(),
        leaderboardHits: 0,
        matchedNames: new Set(),
      };
      current.sources = new Set([...current.sources, ...evidence.sources]);
      current.scoreboardAppearances += evidence.scoreboardAppearances;
      current.leaderboardHits += evidence.leaderboardHits;
      current.scoreboardDates = new Set([...current.scoreboardDates, ...evidence.scoreboardDates]);
      current.leaderboardCategories = new Set([...current.leaderboardCategories, ...evidence.leaderboardCategories]);
      current.matchedNames = new Set([...current.matchedNames, ...evidence.matchedNames]);
      merged.set(evidence.school.slug, current);
    }
  }

  return merged;
}

function compareTeams(left, right) {
  const statusOrder = {
    ready: 0,
    pending: 1,
    discovered: 2,
  };

  const leftOrder = statusOrder[left.status] ?? 99;
  const rightOrder = statusOrder[right.status] ?? 99;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return String(left.schoolName || left.key).localeCompare(String(right.schoolName || right.key));
}

function buildExpandedManifest(manifest, mergedEvidence, unresolvedLeaderboards, warnings, options, schoolsBySlug, baseDate) {
  const defaultSeason = manifest.defaultSeason || new Date().getFullYear();
  const existingSlugs = new Set();
  const teams = [];

  for (const team of manifest.teams || []) {
    const schoolSlug = slugify(team.schoolSlug || team.key || team.schoolName);
    const school = schoolsBySlug.get(schoolSlug) || {
      slug: schoolSlug,
      name: normalizeWhitespace(team.schoolName || titleCaseSlug(schoolSlug)),
      long: normalizeWhitespace(team.schoolLongName || team.schoolName || titleCaseSlug(schoolSlug)),
    };
    const evidence = mergedEvidence.get(schoolSlug);
    existingSlugs.add(schoolSlug);
    teams.push({
      ...team,
      key: team.key || schoolSlug,
      season: team.season || defaultSeason,
      schoolSlug,
      schoolName: normalizeWhitespace(team.schoolName || school.name),
      schoolLongName: normalizeWhitespace(team.schoolLongName || school.long || school.name),
      enabled: team.enabled !== false,
      status: team.status || (isReadyTeam(team) ? "ready" : "pending"),
      adapter: team.adapter || (team.schoolSiteBase ? "sidearm" : "unknown"),
      discovery: buildDiscoveryPayload(team.discovery, evidence, true),
    });
  }

  for (const [schoolSlug, evidence] of mergedEvidence.entries()) {
    if (existingSlugs.has(schoolSlug)) {
      continue;
    }

    const school = schoolsBySlug.get(schoolSlug) || evidence.school;
    teams.push({
      key: schoolSlug,
      season: defaultSeason,
      schoolSlug,
      schoolName: normalizeWhitespace(school?.name || titleCaseSlug(schoolSlug)),
      schoolLongName: normalizeWhitespace(school?.long || school?.name || titleCaseSlug(schoolSlug)),
      enabled: false,
      status: "discovered",
      adapter: "unknown",
      discovery: buildDiscoveryPayload({}, evidence, false),
      notes: "Fill in schoolSiteBase, rosterPath, and statsPath before enabling ingest.",
    });
  }

  teams.sort(compareTeams);

  const reviewQueue = [...unresolvedLeaderboards.entries()]
    .map(([schoolName, value]) => ({
      schoolName,
      count: value.count,
      categories: [...value.categories].sort(),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.schoolName.localeCompare(right.schoolName);
    });

  const summary = {
    totalTeams: teams.length,
    readyTeams: teams.filter((team) => team.status === "ready").length,
    pendingTeams: teams.filter((team) => team.status === "pending").length,
    discoveredTeams: teams.filter((team) => team.status === "discovered").length,
    enabledTeams: teams.filter((team) => team.enabled !== false).length,
    scoreboardTaggedTeams: teams.filter((team) => team.discovery?.sources?.includes("scoreboard")).length,
    leaderboardTaggedTeams: teams.filter((team) => team.discovery?.sources?.includes("leaderboard")).length,
    unresolvedLeaderboardNames: reviewQueue.length,
  };

  return {
    ...manifest,
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/expand-baseball-manifest.mjs",
    source: "NCAA school index + recent baseball scoreboards + national leaderboards",
    discoveryWindow: {
      lookbackDays: options.lookbackDays,
      lookaheadDays: options.lookaheadDays,
      startDate: formatIsoDate(addDays(baseDate, -options.lookbackDays)),
      endDate: formatIsoDate(addDays(baseDate, options.lookaheadDays)),
    },
    leaderboardPages: options.leaderboardPages,
    leaderboardSpecs: LEADERBOARD_SPECS,
    summary,
    warnings,
    reviewQueue,
    teams,
  };
}

function printSummary(expandedManifest, outputPath, wroteFile) {
  const { summary, reviewQueue, discoveryWindow, warnings } = expandedManifest;
  console.log(`Manifest window: ${discoveryWindow.startDate} -> ${discoveryWindow.endDate}`);
  console.log(`Teams: ${summary.totalTeams} total | ${summary.readyTeams} ready | ${summary.discoveredTeams} discovered`);
  console.log(`Tagged by scoreboard: ${summary.scoreboardTaggedTeams} | tagged by leaderboards: ${summary.leaderboardTaggedTeams}`);
  console.log(`Unresolved leaderboard names: ${summary.unresolvedLeaderboardNames}`);
  if (warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
  }
  if (reviewQueue.length) {
    const preview = reviewQueue.slice(0, 8).map((item) => `${item.schoolName} (${item.count})`).join(", ");
    console.log(`Review queue preview: ${preview}`);
  }
  if (wroteFile) {
    console.log(`Wrote ${outputPath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const manifest = JSON.parse(await readFile(options.manifest, "utf8"));
  const schools = await fetchJson(`${NCAA_API_BASE}/schools-index`);
  const { bySlug: schoolsBySlug, aliasMap, exactNameMap } = buildSchoolAliasMap(schools);
  const scoreboardDiscovery = await discoverScoreboardSchools(options, schoolsBySlug);
  const leaderboardDiscovery = await discoverLeaderboardSchools(options, aliasMap, exactNameMap, schoolsBySlug);
  const mergedEvidence = mergeEvidenceMaps(scoreboardDiscovery.evidenceBySlug, leaderboardDiscovery.evidenceBySlug);
  const expandedManifest = buildExpandedManifest(
    manifest,
    mergedEvidence,
    leaderboardDiscovery.unresolved,
    [...scoreboardDiscovery.warnings, ...leaderboardDiscovery.warnings],
    options,
    schoolsBySlug,
    scoreboardDiscovery.baseDate,
  );

  if (options.write) {
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(expandedManifest, null, 2)}\n`, "utf8");
  }

  printSummary(expandedManifest, options.output, options.write);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});