# Toledo Baseball Dashboard

This repo is now set up as the first Toledo-first baseball dashboard scaffold.

## What changed

- UI shell now feels much closer to the basketball dashboard: branded header, sticky nav, ops hero, KPI strip, clean card layout
- baseball positions are explained in plain language inside the product
- player evaluation is split into hitter and pitcher scoring instead of forcing one blended model
- a backend scaffold now exists under `backend/toledo-baseball-api`
- the overview now wires into live NCAA-backed Toledo identity, recent or upcoming game data, and a verified Toledo boxscore player list
- a real-data explorer now lets you search live schools, inspect recent and upcoming games, browse a live scoreboard sample, and open real game detail payloads
- the Players page now uses a backend-served paginated player universe with row click-through into a full player profile card

## Baseball basics

There are not only two positions in baseball.

The first useful split for the dashboard is:

- hitters
- pitchers

But the actual roster positions still matter:

- pitcher
- catcher
- first base
- second base
- third base
- shortstop
- left field
- center field
- right field
- designated hitter

Pitchers also break into roles like starters, relievers, and closers.

## Toledo verification

Toledo was directly confirmed in the NCAA wrapper school index with:

- `slug`: `toledo`
- `name`: `Toledo`
- `long`: `University of Toledo`

That makes the NCAA-backed path the safest first source for this build.

## Verified endpoint coverage

The current NCAA-backed path has enough useful information to start building real baseball workflows:

- school index: school slug, short name, long name
- scoreboard: game IDs, team names, start dates, start times, scores, game state, matchup URLs
- boxscore: player names, positions, starter flags, batting lines, pitching lines, team totals
- play-by-play: inning-by-inning event text with player names and score changes

This means the answer to "does this have player names and team names?" is yes.

The new live explorer is meant to pressure-test exactly that before we build more product on top of it.

## Backend path

The recommended architecture is:

1. the front-end calls a small Toledo-owned API
2. that API fetches and normalizes NCAA-backed baseball data
3. we cache it and return a clean contract to the UI
4. if we later add a paid provider, we swap it in at the backend without rewriting the UI

Right now, you do not need to do anything to keep building.

You would only need to step in later if:

1. we choose a paid API and need a key
2. we deploy the backend worker
3. we connect private Toledo-only data

## Recommended deploy path

The safest low-priority setup for this project is:

1. host the frontend on GitHub Pages
2. keep the frontend static-first
3. leave the Cloudflare backend optional

That means the hosted site can still show the unified player board from the committed generated datasets without spending Cloudflare Worker requests on every page load.

Live Overview, Games, school search, and scoreboard only turn on after you explicitly configure a backend API URL.

The current deployed baseball Worker URL is:

- `https://toledo-baseball-api.bryanhkwan.workers.dev`

## Local live data

The frontend now tries to call the local Worker at `http://127.0.0.1:8787` when you open the static app locally.

To power the live Toledo cards and Games views, run:

1. `cd backend/toledo-baseball-api`
2. `npx wrangler dev`

Notes:

- the backend now powers `Players`, `Overview`, and `Games`
- the generated Toledo and sidearm-pool datasets seed the backend player-universe service
- the older NCAA national leaderboard route still exists in the Worker, but it is no longer part of the normal player-page load path

If the worker is not running, the dashboard falls back to the static shell.

## Hosted mode

When this repo is hosted on GitHub Pages, the frontend is wired to the deployed Worker by default:

- `Players` opens first
- `Players` uses the backend player-universe endpoints
- live backend calls are used for `Overview` and `Games`
- the committed generated datasets still matter because they seed the stored player universe the Worker serves

To turn the live backend on later, set `window.BASEBALL_API_BASE` or `data-api-base` in the HTML to your deployed Worker URL.

## Toledo dataset ingest

There is now a Toledo-first free ingest script at `scripts/generate-baseball-dataset.mjs`.

Run it with:

1. `node scripts/generate-baseball-dataset.mjs`

It writes:

- `data/generated/toledo-baseball-2026.json`
- `data/generated/toledo-baseball-2026.js`

What it does right now:

- pulls Toledo's public roster page from `utrockets.com`
- pulls Toledo's public cumulative stats page from `utrockets.com`
- verifies Toledo in the NCAA school index
- checks ESPN's college baseball team feed for Toledo
- merges roster identity with hitting, pitching, and fielding season stats into one local dataset
- builds a `playerBoard` payload that is shaped to plug into the existing dashboard later

Important note:

- Toledo's school-site data is strong
- ESPN's Toledo roster endpoint currently appears stale against the current 2026 school-site roster, so ESPN is useful here for team identity checks but not yet for current-player enrichment

This gives us a real free-data path for Toledo without paying for a provider first.

## Generated pool ingest

The same script can now build a broader multi-school free player pool from verified Sidearm baseball sites.

Run it with:

1. `node scripts/generate-baseball-dataset.mjs --team all`

It currently builds:

- Toledo
- Wake Forest
- TCU
- Houston
- Middle Tennessee
- Missouri
- Sam Houston

And it writes:

- one per-school JSON file and browser bundle for each verified school
- `data/generated/sidearm-pool-baseball-2026.json`
- `data/generated/sidearm-pool-baseball-2026.js`

The current generated free pool covers 7 schools and 263 players.

Inside the app, those generated datasets now seed the backend-owned player universe.

That universe merges:

- Toledo's real school-site season roster
- the broader free generated transfer-target pool
- the backend national player board when the NCAA wrapper is reachable

This keeps the baseball UX closer to the basketball dashboard: one main player list on the left, one full profile on the right, and no source sub-tabs inside the player workflow.

## Manifest expansion

The school ingest layer is now manifest-driven.

Base manifest:

- `data/school-manifest.baseball.json`

Expanded discovery manifest:

- `data/school-manifest.baseball.expanded.json`

To refresh the expanded manifest from the NCAA school index, recent D1 baseball scoreboards, and national leaderboards, run:

1. `node scripts/expand-baseball-manifest.mjs --write`

The current expanded manifest discovers 338 candidate baseball schools, with 7 ready Sidearm ingests and 331 discovered entries left disabled until their site paths are configured.

The dataset generator now accepts a manifest override and only ingests entries that are actually ready:

1. `node scripts/generate-baseball-dataset.mjs --manifest data/school-manifest.baseball.expanded.json --team toledo`
2. `node scripts/generate-baseball-dataset.mjs --manifest data/school-manifest.baseball.expanded.json --team all`

## Files

- `index.html`: dashboard shell
- `styles.css`: basketball-dashboard-style visual system
- `app.js`: live school explorer, live scoreboard sample, game detail viewer, player board, scoring model
- `backend/toledo-baseball-api/src/index.js`: Worker-style backend scaffold
- `backend/toledo-baseball-api/wrangler.jsonc`: Worker config
- `backend/toledo-baseball-api/README.md`: backend notes
- `scripts/generate-baseball-dataset.mjs`: Toledo-first free roster and stats ingest
- `scripts/expand-baseball-manifest.mjs`: NCAA-backed manifest discovery and expansion
- `data/school-manifest.baseball.json`: ready-school ingest manifest
- `data/school-manifest.baseball.expanded.json`: generated expanded baseball school manifest
- `data/generated/toledo-baseball-2026.json`: generated Toledo player dataset
- `data/generated/toledo-baseball-2026.js`: browser-loadable Toledo dataset bundle for the Players UI
- `data/generated/sidearm-pool-baseball-2026.json`: combined multi-school generated player pool
- `data/generated/sidearm-pool-baseball-2026.js`: browser-loadable generated pool bundle for the Players UI
