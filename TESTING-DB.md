# Testing a Looper-provisioned PostgreSQL DB with this repo

This branch splits the repo into two packages so Looper's scans attribute
things correctly: the CRA game in `client/`, and a small Express + `pg`
score API in `server/`. The game records every finished game into the API.
It exists to verify the dev-provisioned databases feature end-to-end.

## Layout

- `client/package.json` — the React app; `npm start` runs the CRA dev server.
- `server/package.json` — `express` + `pg`; `npm start` runs `index.js`.
- no manifest at the root, so Looper detects exactly two services and each
  runner's env-var and database scans see only its own folder.

## Steps (in Looper, docker-runner session)

1. **Scan runners** — Looper detects `tic-tac-toe-score-api` (subdir `server`,
   role api) and `tic-tac-toe` (subdir `client`, role frontend). The API
   listens on whatever `PORT` Looper injects (5050 when run by hand).
2. **Provision + wire the DB from the runner** — expand the API runner →
   *Databases* tab → the PostgreSQL row is amber → *Add database* → *Provision
   new (Looper-managed)…* → name it e.g. `ttt-scores`, leave *Wire into <runner>*
   ticked with `DATABASE_URL`. Looper starts the DB and writes
   `DATABASE_URL={{db.ttt-scores.url}}` into the runner's session env override.
   (Provisioning from the DBs panel "+" works too; then use the row's *Env var*
   menu to wire it.)
3. **Point the game at the API** — on the `client` runner's Environment
   variables tab add `BACKEND_URL=http://localhost:{{tic-tac-toe-score-api.port}}`
   — the CRA dev proxy (`client/src/setupProxy.js`) forwards `/api` there. The
   template key is the API runner's name, lowercased with non-alphanumerics as
   dashes; adjust it if you renamed the runner. A bare port or `host:port`
   is accepted too (the proxy adds `http://localhost:` itself).
     Without it the proxy falls back to the local-machine default (port 5050),
     which only works when the API really runs there. A mismatch shows up as
     `Proxy error: ECONNREFUSED` in the game runner logs, and the game shows
     "score API unreachable"; the proxy also logs the fallback at boot.
     **Published apps need no wiring:** Looper injects `LOOPER_BACKEND_URL`
     (the API runner's port on the shared pod loopback) into the frontend
     runner, and the proxy reads it when `BACKEND_URL` is unset.
4. **Start both**, open the game preview, finish a game (win or draw).

## What proves it works

- The game sidebar shows **Saved Results (PostgreSQL)** with the finished game.
- The DBs panel connection now lists a `scores` table with the rows.
- The API runner's preview tab has a status page with the resolved DB url
  (password masked) and buttons to insert rows manually — use it to test the
  DB loop without playing.
- `GET /api/health` returns `{ ok, dbUrl, scores }`.
- The runner log's first line reads `[ttt-db] score API on :<port> — db: <url>`.

The server exits immediately with a clear error when `DATABASE_URL` is not
set, so a broken `{{db.*.url}}` wiring is visible in the runner logs instead
of a silent fallback. A database that is merely unreachable at startup does
**not** kill the process — it would restart-loop with no diagnostics — the
API listens anyway and reports the failure on `GET /api/health`.

## Resetting the database

The DBs card's **Reset** removes the Postgres container *and* its volume and
recreates them, so the running API is left with dead pooled connections and an
empty database — the `scores` table it created at boot is gone.

The API handles that on its own (`server/dbErrors.js` + the `query()` wrapper
in `server/index.js`): a reset-shaped failure (`42P01 undefined_table`,
`3D000`, a dropped connection, …) re-creates the table and retries the query
once, and a pool-level `error` handler keeps a dropped idle connection from
taking the process down. The game never renders the error payload as a list
either — `client/src/lib/scores.mjs` normalizes every reply to an array, so a
DB outage shows a one-line message in the sidebar and the board stays
playable.

Verify after a reset: play one game — it should record, and `GET /api/scores`
should return `[]` then the new row, without restarting the runner.

## Testing the publish-time migration step

`server/migrate.js` (`npm run migrate`) exists to exercise Looper's per-runner
**Migration command** — the pipeline runs it once per publish, in a throwaway
container that mirrors the runner (same image, env and DB wiring), *before* the
new version starts, and takes a pre-migration DB snapshot automatically.

Wire it: Deployments → **Production** → expand the `tic-tac-toe-score-api` card
→ **DB** → *Migration command* = `node migrate.js`.

The script creates `scores` (so a fresh DB is usable at boot) and appends one
row to `migration_marker` per run — that table is the proof the step executed:

```sql
SELECT * FROM migration_marker ORDER BY id;
```

One row per publish means the migration ran exactly once each time. To check
the failure path, set the command to `node -e "process.exit(1)"` and publish:
the pipeline must stop at `migrate`, never cut over, and leave the previous
version serving with the snapshot available to restore.
