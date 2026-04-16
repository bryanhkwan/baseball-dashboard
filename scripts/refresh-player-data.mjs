import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_SEASON = 2026;
const DEFAULT_MANIFEST = "data/school-manifest.baseball.expanded.json";
const DEFAULT_TIMEZONE = "America/New_York";

function parseArgs(argv) {
  const options = {
    season: DEFAULT_SEASON,
    startDate: "",
    endDate: "",
    manifest: DEFAULT_MANIFEST,
    skipValidate: false,
    promoteSidearm: false,
    promoteCandidates: "data/sidearm-candidate-domains.json",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--season") {
      const parsed = Number.parseInt(argv[index + 1] || "", 10);
      if (!Number.isNaN(parsed)) {
        options.season = parsed;
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

    if (token === "--manifest") {
      options.manifest = argv[index + 1] || options.manifest;
      index += 1;
      continue;
    }

    if (token === "--skip-validate") {
      options.skipValidate = true;
      continue;
    }

    if (token === "--promote-sidearm") {
      options.promoteSidearm = true;
      continue;
    }

    if (token === "--promote-candidates") {
      options.promoteCandidates = argv[index + 1] || options.promoteCandidates;
      index += 1;
    }
  }

  return options;
}

function getTodayForTimezone(timeZone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || String(DEFAULT_SEASON);
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function runNodeScript(scriptPath, args) {
  const command = [scriptPath, ...args].join(" ");
  console.log(`\n> node ${command}`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  const options = parseArgs(process.argv);
  const season = options.season || DEFAULT_SEASON;
  const startDate = options.startDate || `${season}-02-01`;
  const endDate = options.endDate || getTodayForTimezone(DEFAULT_TIMEZONE);

  if (options.promoteSidearm) {
    runNodeScript("scripts/promote-sidearm-schools.mjs", [
      "--manifest",
      options.manifest,
      "--candidates",
      options.promoteCandidates,
      "--season",
      String(season),
      "--write",
    ]);
  }

  runNodeScript("scripts/generate-baseball-dataset.mjs", [
    "--manifest",
    options.manifest,
    "--team",
    "all",
    "--season",
    String(season),
  ]);

  runNodeScript("scripts/generate-sidearm-roster-pool.mjs", [
    "--manifest",
    options.manifest,
    "--team",
    "all",
    "--season",
    String(season),
    "--output",
    `data/generated/sidearm-roster-pool-baseball-${season}.json`,
  ]);

  runNodeScript("scripts/backfill-ncaa-boxscore-pool.mjs", [
    "--season",
    String(season),
    "--start-date",
    startDate,
    "--end-date",
    endDate,
    "--chunk-days",
    "7",
    "--output",
    `data/generated/ncaa-boxscore-pool-${season}.json`,
  ]);

  if (!options.skipValidate) {
    runNodeScript("scripts/validate-player-universe.mjs", []);
    runNodeScript("scripts/validate-stat-accuracy.mjs", []);
  }
}

main();
