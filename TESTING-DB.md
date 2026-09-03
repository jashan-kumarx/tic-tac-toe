# Testing Looper-provisioned databases with this repo

This branch adds a small Express score API (`server/index.js`) and wires the
game to record every finished game into it. It exists to verify the
dev-provisioned databases feature end-to-end. This branch covers SQLite and
PostgreSQL — the engine is picked from the `DATABASE_URL` scheme (`postgresql://` → pg, anything
else → a SQLite file path), so switching engines is only a matter of re-pointing the
env var at a different `{{db.<name>.url}}`.

## Steps (in Looper)

1. **Provision the DB** — DBs panel → “+” → *Provision new (Looper-managed)* →
   pick SQLite or PostgreSQL → name it e.g. `ttt-scores`.
2. **Add the API runner** — Runners panel:
   - command: `npm run server`
   - port: any (5050 by default; Looper may remap it — note the port shown on the card)
   - env: `DATABASE_URL={{db.ttt-scores.url}}` (`DATABASE_FILE` still works as an
     alias for the sqlite case)
3. **Add the game runner** — command: `npm start` (CRA picks up `PORT` from Looper).
   - env: `SCORE_API_PORT=<port the API runner actually got>` — the CRA dev
     proxy (`src/setupProxy.js`) forwards `/api` there. Without it the proxy
     falls back to 5050, which only works when the API really runs on 5050.
     A mismatch shows up as `Proxy error: ECONNREFUSED` in the game runner logs.
4. **Start both**, open the game preview, finish a game (win or draw).

## What proves it works

- The game sidebar shows **Saved Results (SQLite)** with the finished game.
- The DBs panel connection now lists a `scores` table with the rows.
- The API runner’s preview tab has a status page showing the engine and the
  resolved DB target (credentials masked) plus buttons to insert rows manually
  — use it to test the DB loop without playing.
- `GET /api/health` returns `{ ok, engine, db, scores }`.
- The runner log's first line reads `[ttt-db] score API on :<port> — engine:
  <engine>, db: <target>` — confirm the engine is the one you provisioned.

The server exits immediately with a clear error when `DATABASE_URL` is not
set, or when the engine can't be reached at startup, so a broken
`{{db.*.url}}` wiring shows up in the runner logs instead of a silent fallback.

## Switching engines

Provision the next engine, then edit the API runner's `DATABASE_URL` to the
new `{{db.<new-name>.url}}` and restart just that runner. The game runner is
untouched — it only talks to `/api`.
