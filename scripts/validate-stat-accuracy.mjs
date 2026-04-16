#!/usr/bin/env node
/**
 * Compare each school's officially-ingested cumulative stats against the merged
 * player universe that powers the dashboard. Emits a drift report so the daily
 * workflow can flag discrepancies between school-site values and merged cards.
 *
 * Usage:
 *   node scripts/validate-stat-accuracy.mjs [--json] [--strict] [--tolerance <n>]
 *                                           [--max-drift <n>]
 *
 * Exit codes:
 *   0 - validation passed (no blocking drift).
 *   1 - unexpected error while running.
 *   2 - drift exceeded thresholds when --strict or --max-drift is set.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildPlayerUniverse } from "../backend/toledo-baseball-api/src/player-universe.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const GENERATED_DIR = path.join(REPO_ROOT, "data", "generated");

const HITTER_FIELDS = ["AVG", "OBP", "SLG", "HR", "RBI", "SB"];
const PITCHER_FIELDS = ["ERA", "WHIP", "IP", "K", "BB"];

const HITTER_TOLERANCE = {
  AVG: 0.005,
  OBP: 0.005,
  SLG: 0.005,
  HR: 0,
  RBI: 0,
  SB: 0,
};
const PITCHER_TOLERANCE = {
  ERA: 0.05,
  WHIP: 0.02,
  IP: 0.1,
  K: 0,
  BB: 0,
};

function parseArgs(argv) {
  const options = {
    json: false,
    strict: false,
    maxDrift: Number.POSITIVE_INFINITY,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--json") {
      options.json = true;
    } else if (token === "--strict") {
      options.strict = true;
    } else if (token === "--max-drift" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.maxDrift = parsed;
      }
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

function buildMergeKey(player = {}) {
  return [
    normalizeKeyPart(player.name),
    normalizeKeyPart(player.school),
    normalizeKeyPart(player.role),
  ].join("::");
}

function statCardValue(player, label) {
  const card = (player.statCards || []).find((entry) => entry?.label === label);
  return card ? card.value : null;
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const raw = String(value).trim();
  if (!raw || raw === "--" || raw === "N/A") {
    return null;
  }
  const cleaned = raw.replace(/,/g, "");
  // Sidearm renders averages like ".482" - parseFloat handles this.
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadSchoolDatasets() {
  const files = await readdir(GENERATED_DIR).catch(() => []);
  const datasets = [];
  for (const file of files) {
    if (!/-baseball-\d{4}\.json$/i.test(file)) {
      continue;
    }
    if (file.includes("sidearm-pool") || file.includes("sidearm-roster-pool") || file.includes("ncaa-boxscore-pool")) {
      continue;
    }
    try {
      const absolutePath = path.join(GENERATED_DIR, file);
      const raw = await readFile(absolutePath, "utf8");
      const data = JSON.parse(raw);
      if (!data?.playerBoard?.players?.length) {
        continue;
      }
      datasets.push({ file, data });
    } catch (error) {
      console.warn(`Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return datasets;
}

function compareField(label, officialValue, mergedValue, tolerance) {
  if (officialValue === null && mergedValue === null) {
    return null;
  }
  if (officialValue === null || mergedValue === null) {
    return {
      label,
      official: officialValue,
      merged: mergedValue,
      delta: null,
      reason: "missing-value",
    };
  }
  const delta = Math.abs(officialValue - mergedValue);
  if (delta <= tolerance) {
    return null;
  }
  return {
    label,
    official: officialValue,
    merged: mergedValue,
    delta: Number(delta.toFixed(4)),
    reason: "drift",
  };
}

function compareHitter(officialPlayer, mergedPlayer) {
  const drifts = [];
  for (const field of HITTER_FIELDS) {
    const delta = compareField(
      field,
      parseNumericValue(statCardValue(officialPlayer, field)),
      parseNumericValue(statCardValue(mergedPlayer, field)),
      HITTER_TOLERANCE[field],
    );
    if (delta) {
      drifts.push(delta);
    }
  }
  return drifts;
}

function compareIP(value) {
  // Sidearm renders IP as "45.1" meaning 45 and 1/3 innings.
  const parsed = parseNumericValue(value);
  if (parsed === null) {
    return null;
  }
  const whole = Math.floor(parsed);
  const frac = Math.round((parsed - whole) * 10);
  const outs = frac === 1 ? 1 : frac === 2 ? 2 : 0;
  return whole + outs / 3;
}

function comparePitcher(officialPlayer, mergedPlayer) {
  const drifts = [];
  for (const field of PITCHER_FIELDS) {
    const officialRaw = statCardValue(officialPlayer, field);
    const mergedRaw = statCardValue(mergedPlayer, field);
    const officialValue = field === "IP" ? compareIP(officialRaw) : parseNumericValue(officialRaw);
    const mergedValue = field === "IP" ? compareIP(mergedRaw) : parseNumericValue(mergedRaw);
    const delta = compareField(field, officialValue, mergedValue, PITCHER_TOLERANCE[field]);
    if (delta) {
      drifts.push(delta);
    }
  }
  return drifts;
}

async function main() {
  const options = parseArgs(process.argv);

  const [datasets, universe] = await Promise.all([
    loadSchoolDatasets(),
    Promise.resolve(buildPlayerUniverse()),
  ]);

  const mergedIndex = new Map();
  for (const player of universe.players || []) {
    mergedIndex.set(buildMergeKey(player), player);
  }

  const drifts = [];
  const missing = [];
  const wrongTier = [];
  let checked = 0;

  for (const { file, data } of datasets) {
    const schoolName = data?.school?.name || data?.school?.longName || data?.school?.slug || file;
    for (const officialPlayer of data.playerBoard.players || []) {
      const officialShape = { ...officialPlayer, school: schoolName };
      const mergeKey = buildMergeKey(officialShape);
      const mergedPlayer = mergedIndex.get(mergeKey);
      if (!mergedPlayer) {
        missing.push({
          school: schoolName,
          player: officialPlayer.name,
          role: officialPlayer.role,
        });
        continue;
      }
      checked += 1;
      if (mergedPlayer.coverageTier !== "official-cumulative" && mergedPlayer.coverageTier !== "official-roster") {
        wrongTier.push({
          school: schoolName,
          player: officialPlayer.name,
          role: officialPlayer.role,
          coverageTier: mergedPlayer.coverageTier,
        });
      }
      const fieldDrifts =
        officialPlayer.role === "Pitcher"
          ? comparePitcher(officialPlayer, mergedPlayer)
          : compareHitter(officialPlayer, mergedPlayer);
      if (fieldDrifts.length) {
        drifts.push({
          school: schoolName,
          player: officialPlayer.name,
          role: officialPlayer.role,
          mergeKey,
          mergedCoverageTier: mergedPlayer.coverageTier,
          fields: fieldDrifts,
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    datasetsChecked: datasets.length,
    playersChecked: checked,
    missingPlayers: missing.length,
    wrongTierPlayers: wrongTier.length,
    driftPlayers: drifts.length,
    maxDrift: options.maxDrift === Number.POSITIVE_INFINITY ? null : options.maxDrift,
    thresholds: { hitter: HITTER_TOLERANCE, pitcher: PITCHER_TOLERANCE },
    drifts: drifts.slice(0, 50),
    missing: missing.slice(0, 50),
    wrongTier: wrongTier.slice(0, 50),
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `Validator summary: ${datasets.length} official dataset${datasets.length === 1 ? "" : "s"} checked, ${checked} players matched, ${drifts.length} with stat drift, ${missing.length} missing from universe, ${wrongTier.length} flagged with non-official coverage tier.`,
    );
    if (drifts.length) {
      console.log("\nTop drift cases (first 10):");
      drifts.slice(0, 10).forEach((drift) => {
        const fieldSummary = drift.fields
          .map((field) => `${field.label}: official=${field.official} merged=${field.merged} (Δ=${field.delta ?? "n/a"})`)
          .join("; ");
        console.log(`- ${drift.school} — ${drift.player} (${drift.role}) [${drift.mergedCoverageTier}]: ${fieldSummary}`);
      });
    }
    if (wrongTier.length) {
      console.log("\nPlayers with an official dataset but a non-official merged tier (first 10):");
      wrongTier.slice(0, 10).forEach((entry) => {
        console.log(`- ${entry.school} — ${entry.player} (${entry.role}): merged tier = ${entry.coverageTier}`);
      });
    }
    if (missing.length) {
      console.log("\nOfficial dataset players missing from merged universe (first 10):");
      missing.slice(0, 10).forEach((entry) => {
        console.log(`- ${entry.school} — ${entry.player} (${entry.role})`);
      });
    }
  }

  const driftBlocking =
    options.strict && (drifts.length > 0 || wrongTier.length > 0 || missing.length > 0);
  const overDriftBudget = Number.isFinite(options.maxDrift) && drifts.length > options.maxDrift;
  if (driftBlocking || overDriftBudget) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
