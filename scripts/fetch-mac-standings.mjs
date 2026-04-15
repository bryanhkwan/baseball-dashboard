import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAC_STANDINGS_URL = "https://getsomemaction.com/standings.aspx?path=baseball";

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

function normalizeRow(rowHtml, index) {
  const cellMatches = [...String(rowHtml || "").matchAll(/<td class="hide-on-medium-down"[^>]*>([\s\S]*?)<\/td>/gi)];
  const cells = cellMatches.map((match) => stripHtml(match[1]));
  if (cells.length < 9) {
    return null;
  }

  const [schoolName, conferenceRecord, conferencePct, overallRecord, overallPct, homeRecord, awayRecord, neutralRecord, streak] =
    cells;

  return {
    rank: index + 1,
    teamId: schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
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

async function main() {
  const response = await fetch(MAC_STANDINGS_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`MAC standings request failed: ${response.status}`);
  }

  const html = await response.text();
  const tableMatch = html.match(/<table[^>]*sidearm-standings-table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error("Could not find MAC standings table in the official page.");
  }

  const bodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) {
    throw new Error("Could not find MAC standings table body in the official page.");
  }

  const rows = [...bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
    .map((match, index) => normalizeRow(match[1], index))
    .filter(Boolean);

  const payload = {
    source: "Mid-American Conference standings page",
    fetchedAt: new Date().toISOString(),
    conference: {
      id: "mac",
      name: "Mid-American Conference",
      shortName: "MAC",
    },
    table: rows,
    note: "Official MAC baseball standings snapshot generated locally from getsomemaction.com.",
  };

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const generatedDir = path.join(__dirname, "..", "backend", "toledo-baseball-api", "src", "generated");
  const frontendGeneratedDir = path.join(__dirname, "..", "data", "generated");
  await mkdir(generatedDir, { recursive: true });
  await mkdir(frontendGeneratedDir, { recursive: true });

  const modulePath = path.join(generatedDir, "mac-baseball-standings.js");
  const jsonPath = path.join(generatedDir, "mac-baseball-standings.json");
  const frontendJsonPath = path.join(frontendGeneratedDir, "mac-baseball-standings.json");

  await writeFile(modulePath, `export default ${JSON.stringify(payload, null, 2)};\n`);
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(frontendJsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(`Wrote ${rows.length} MAC standings rows to ${modulePath}`);
  console.log(`Wrote MAC standings snapshot JSON to ${frontendJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
