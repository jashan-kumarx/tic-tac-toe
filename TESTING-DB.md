# Testing a Looper-provisioned SQLite DB with this repo

This branch splits the repo into two packages so Looper's scans attribute
things correctly: the CRA game in `client/`, and a small Express +
better-sqlite3 score API in `server/`. The game records every finished game
into the API. It exists to verify the dev-provisioned databases feature
end-to-end.

## Layout

- `client/package.json` — the React app; `npm start` runs the CRA dev server.
- `server/package.json` — `express` + `better-sqlite3`; `npm start` runs `index.js`.
- no manifest at the root, so Looper detects exactly two services and each
  runner's env-var and database scans see only its own folder.

## Steps (in Looper, docker-runner session)

1. **Scan runners** — Looper detects `tic-tac-toe-score-api` (subdir `server`,
   role api) and `tic-tac-toe` (subdir `client`, role frontend). The API
   listens on whatever `PORT` Looper injects (5050 when run by hand).
2. **Provision + wire the DB from the runner** — expand the API runner →
   *Databases* tab → the SQLite row is amber → *Add database* → *Provision new
   (Looper-managed)…* → name it e.g. `ttt-scores`, leave *Wire into <runner>*
   ticked with `DATABASE_FILE`. Looper starts the DB and writes
   `DATABASE_FILE={{db.ttt-scores.url}}` into the runner's session env override.
   (Provisioning from the DBs panel "+" works too; then use the row's *Env var*
   menu to wire it.)
3. **Point the game at the API** — on the `client` runner's Environment
   variables tab add `BACKEND_URL=http://localhost:{{tic-tac-toe-score-api.port}}`
   — the CRA dev proxy (`client/src/setupProxy.js`) forwards `/api` there. The
   template key is the API runner's name, lowercased with non-alphanumerics as
   dashes; adjust it if you renamed the runner.
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
