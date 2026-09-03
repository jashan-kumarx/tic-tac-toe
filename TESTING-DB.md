# Testing a Looper-provisioned MongoDB with this repo

This branch adds a small Express score API (`server/index.js`) and wires the
game to record every finished game into it. It exists to verify the
dev-provisioned databases feature end-to-end. **This branch speaks MongoDB
only** — the server refuses any `DATABASE_URL` that is not a `mongodb://` url.
One branch per engine: `feature/test-db` (SQLite), `feature/test-db-pg`
(PostgreSQL), `feature/test-db-mongo` (this one).

## Steps (in Looper)

1. **Provision the DB** — DBs panel → “+” → *Provision new (Looper-managed)* →
   pick MongoDB → name it e.g. `ttt-scores`.
2. **Add the API runner** — Runners panel:
   - command: `npm run server`
   - port: any (5050 by default; Looper may remap it — note the port shown on the card)
   - env: `DATABASE_URL={{db.ttt-scores.url}}`
3. **Add the game runner** — command: `npm start` (CRA picks up `PORT` from Looper).
   - env: `SCORE_API_PORT=<port the API runner actually got>` — the CRA dev
     proxy (`src/setupProxy.js`) forwards `/api` there. Without it the proxy
     falls back to 5050, which only works when the API really runs on 5050.
     A mismatch shows up as `[HPM] … ECONNREFUSED` in the game runner logs.
     Env changes only apply on the next start of that runner.
4. **Start both**, open the game preview, finish a game (win or draw).

## What proves it works

- The game sidebar shows **Saved Results (MongoDB)** with the finished game.
- The DBs panel connection now lists a `scores` collection with the documents.
- The API runner’s preview tab has a status page showing the resolved DB
  target (credentials masked) plus buttons to insert documents manually — use
  it to test the DB loop without playing.
- `GET /api/health` returns `{ ok, dbUrl, scores }`.
- The runner log's first line reads `[ttt-db] score API on :<port> — db:
  mongodb://looper:***@<host>:<port>/ttt-scores?authSource=admin`.

The server exits immediately with a clear error when `DATABASE_URL` is not
set, is not a `mongodb://` url, or when MongoDB can't be reached at startup, so
a broken `{{db.*.url}}` wiring shows up in the runner logs instead of a silent
fallback.

## Notes

- Looper's managed Mongo url carries the app database name in its path and
  `authSource=admin` for the root user; the server uses that db name (the
  driver falls back to `test` when a hand-written url has none).
- With isolated (docker) runners Looper rewrites the url host to
  `host.docker.internal` automatically — nothing to change on the app side.
