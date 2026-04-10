# Toledo Baseball API Scaffold

This backend is the small owned API layer I recommend putting in front of the dashboard.

## Why this exists

The front-end should not care whether the data came from the NCAA wrapper, a paid source, or a local cache. It should always call one Toledo-owned contract.

That gives us:

- stable frontend code
- easier caching
- easier source switching later
- a safe place to merge multiple sources

## Current endpoints

- `/api/health`
- `/api/meta/sources`
- `/api/baseball/positions`
- `/api/demo/players`
- `/api/schools`
- `/api/schools/:slug`
- `/api/schools/:slug/live-summary`
- `/api/schools/:slug/recent-form`
- `/api/scoreboard/baseball/d1`
- `/api/scoreboard/baseball/d1/live`
- `/api/toledo/recent-games`
- `/api/toledo/live-summary`
- `/api/toledo/recent-form`
- `/api/games/:id/summary`
- `/api/games/:id/live-summary`
- `/api/games/:id/analysis`
- `/api/games/:id/boxscore`
- `/api/games/:id/play-by-play`

## Planned next endpoints

- `/api/toledo/roster`
- `/api/toledo/team-stats`
- `/api/toledo/schedule`
- `/api/players/search`
- `/api/targets/archetypes`

## Do you need to do anything right now?

No. We can keep building locally without you doing anything.

Later, you would only need to do something if:

1. we decide to use a paid API and need an API key
2. we want to deploy this Worker somewhere
3. we want to connect Toledo-only private data sources

## Deployment recommendation

For now, treat this backend as optional.

The safest deployment path is:

1. host the frontend on GitHub Pages
2. keep the frontend static-first
3. only deploy this Worker when you actually want live Overview, Games, school search, scoreboard, and national leader enrichment

That keeps baseball from quietly consuming Cloudflare Worker requests while the project is still low priority.

## Recommended flow

1. Front-end requests Toledo data from this API.
2. This API fetches and normalizes NCAA-backed data.
3. We cache and shape the response for the dashboard.
4. If a better paid source is added later, we swap it here without rewriting the UI.

## Local dev

From this folder, run:

1. `npx wrangler dev`

The current frontend expects the local Worker on `http://127.0.0.1:8787` when the app is opened locally.

## Notes on the NCAA path

- Toledo school identity is verified through the NCAA school index.
- School game windows are built from dated scoreboard lookups.
- Boxscores expose real player names and positions.
- The scoreboard window is fetched sequentially on purpose because parallel date requests can trigger upstream `428` responses.
