import { buildPlayerUniverse } from "../backend/toledo-baseball-api/src/player-universe.js";

function parseArgs(argv) {
  const options = {
    includeNational: false,
    apiBase: "https://toledo-baseball-api.bryanhkwan.workers.dev",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--include-national") {
      options.includeNational = true;
      continue;
    }
    if (token === "--api-base") {
      options.apiBase = argv[index + 1] || options.apiBase;
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  let nationalPayload = null;
  let nationalError = "";

  if (options.includeNational) {
    try {
      const response = await fetch(`${options.apiBase.replace(/\/$/, "")}/api/players/national-board`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`National board request failed: ${response.status}`);
      }
      nationalPayload = await response.json();
    } catch (error) {
      nationalError = error instanceof Error ? error.message : String(error);
    }
  }

  const payload = buildPlayerUniverse({ nationalPayload, nationalError });

  console.log(
    JSON.stringify(
      {
        totalPlayers: payload.totalPlayers,
        roleCounts: payload.roleCounts,
        boardCoverage: payload.boardCoverage,
        note: payload.note,
        includedNational: Boolean(nationalPayload?.players?.length),
        nationalError,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});