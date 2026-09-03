# Testing a Looper-provisioned SQLite DB with this repo

This branch adds a small Express + better-sqlite3 score API (`server/index.js`)
and wires the game to record every finished game into it. It exists to verify
the dev-provisioned databases feature end-to-end.

## Steps (in Looper)

1. **Provision the DB** — DBs panel → “+” → *Provision new (Looper-managed)* →
   SQLite → name it e.g. `ttt-scores`.
2. **Add the API runner** — Runners panel:
   - command: `npm run server`
   - port: any (5050 by default; Looper may remap it — note the port shown on the card)
   - env: `DATABASE_FILE={{db.ttt-scores.url}}`
3. **Add the game runner** — command: `npm start` (CRA picks up `PORT` from Looper).
   - env: `SCORE_API_PORT=<port the API runner actually got>` — the CRA dev
     proxy (`src/setupProxy.js`) forwards `/api` there. Without it the proxy
     falls back to 5050, which only works when the API really runs on 5050.
     A mismatch shows up as `Proxy error: ECONNREFUSED` in the game runner logs.
4. **Start both**, open the game preview, finish a game (win or draw).

## What proves it works

- The game sidebar shows **Saved Results (SQLite)** with the finished game.
- The DBs panel connection now lists a `scores` table with the rows.
- The API runner’s preview tab has a status page with the resolved
  DB file path and buttons to insert rows manually — use it to test the DB loop
  without playing.
- `GET /api/health` returns `{ ok, dbFile, scores }`.

The server exits immediately with a clear error when `DATABASE_FILE` is not
set, so a broken `{{db.*.url}}` wiring is visible in the runner logs instead of
silently writing to a local file.
