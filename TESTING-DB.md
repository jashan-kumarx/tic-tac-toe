# Testing a Looper-provisioned SQLite DB with this repo

This branch adds a small Express + better-sqlite3 score API in `server/` (its
own package, so Looper's driver scan attributes the database to the API runner
only — the CRA frontend runner has no database of its own) and wires the game
to record every finished game into it. It exists to verify the dev-provisioned
databases feature end-to-end.

## Layout

- `server/package.json` — `express` + `better-sqlite3`, `npm start` runs `index.js`.
- root `package.json` — the React app only; `npm run server` is a convenience
  alias for `npm --prefix server start`.

## Steps (in Looper, docker-runner session)

1. **Add the API runner** — Runners panel:
   - repo `tic-tac-toe`, subdir `server`, command `npm start`
   - port: any (5050 by default; Looper may remap it)
2. **Provision + wire the DB from the runner** — expand the API runner →
   *Databases* tab → the SQLite row is amber → *Add database* → *Provision new
   (Looper-managed)…* → name it e.g. `ttt-scores`, leave *Wire into <runner>*
   ticked with `DATABASE_FILE`. Looper starts the DB and writes
   `DATABASE_FILE={{db.ttt-scores.url}}` into the runner's session env override.
   (Provisioning from the DBs panel "+" works too; then use the row's *Env var*
   menu to wire it.)
3. **Add the game runner** — command `npm start` (CRA picks up `PORT` from Looper).
   - env: `BACKEND_URL=http://localhost:{{<api-runner-name>.port}}` — the CRA dev
     proxy (`src/setupProxy.js`) forwards `/api` there. The runner name is
     lowercased with non-alphanumerics as dashes, e.g. `{{ttt-score-api-sqlite.port}}`.
     Without it the proxy falls back to `http://localhost:5050`, which only works
     when the API really runs on 5050. A mismatch shows up as
     `Proxy error: ECONNREFUSED` in the game runner logs, and the game shows
     "score API unreachable".
4. **Start both**, open the game preview, finish a game (win or draw).

## What proves it works

- The game sidebar shows **Saved Results (SQLite)** with the finished game.
- The DBs panel connection now lists a `scores` table with the rows.
- The API runner's preview tab has a status page with the resolved
  DB file path and buttons to insert rows manually — use it to test the DB loop
  without playing.
- `GET /api/health` returns `{ ok, dbFile, scores }`.

The server exits immediately with a clear error when `DATABASE_FILE` is not
set, so a broken `{{db.*.url}}` wiring is visible in the runner logs instead of
silently writing to a local file.
