/**
 * Minimal score API to exercise a Looper-provisioned PostgreSQL database.
 * The connection string arrives via DATABASE_URL (wire it to {{db.<name>.url}}
 * in the runner env); the server fails loudly when it's missing so a broken
 * wiring is visible immediately instead of silently pointing elsewhere.
 */
const express = require("express");
const { Pool } = require("pg");
const { isRecoverableDbError } = require("./dbErrors");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "[ttt-db] DATABASE_URL is not set — add DATABASE_URL={{db.<name>.url}} to this runner's env."
  );
  process.exit(1);
}

// Password hidden in logs/status page; host+port+db are what matter for wiring checks.
const dbLabel = dbUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
const pool = new Pool({ connectionString: dbUrl });

// A database reset removes the DB container; pooled idle clients then emit
// 'error'. Unhandled, that event takes the whole API process down.
pool.on("error", (err) => {
  console.warn("[ttt-db] idle connection dropped:", err.message || err);
});

/** Create the scores table when it is absent — safe to call any number of times. */
async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    id        SERIAL PRIMARY KEY,
    winner    TEXT NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

/**
 * Run a query, healing the schema once on a reset-induced failure. Looper's
 * "Reset" drops this DB's container + volume and recreates them empty, so the
 * table created at boot disappears under a running API; without this the
 * endpoints answered 503 forever until someone restarted the runner.
 */
async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    if (!isRecoverableDbError(err)) throw err;
    console.warn("[ttt-db] recovering from", err.code || err.message, "— re-creating the scores table");
    await ensureTable();
    return pool.query(text, params);
  }
}

const app = express();
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await query("SELECT COUNT(*)::int AS n FROM scores");
    res.json({ ok: true, dbUrl: dbLabel, scores: rows[0].n });
  } catch (err) {
    res.status(503).json({ ok: false, dbUrl: dbLabel, error: String(err.message || err) });
  }
});

app.get("/api/scores", async (_req, res) => {
  try {
    const { rows } = await query("SELECT * FROM scores ORDER BY id DESC LIMIT 20");
    res.json(rows);
  } catch (err) {
    res.status(503).json({ error: String(err.message || err) });
  }
});

app.post("/api/scores", async (req, res) => {
  const winner = String((req.body && req.body.winner) || "");
  if (!["X", "O", "draw"].includes(winner)) {
    return res.status(400).json({ error: "winner must be X, O or draw" });
  }
  try {
    const { rows } = await query(
      "INSERT INTO scores (winner) VALUES ($1) RETURNING id",
      [winner]
    );
    res.json({ id: rows[0].id, winner });
  } catch (err) {
    res.status(503).json({ error: String(err.message || err) });
  }
});

// Built-in status page: verifies the whole DB loop without the game UI.
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html><head><title>ttt-db test</title>
<style>body{font-family:monospace;background:#111;color:#ddd;padding:2rem;max-width:40rem}
button{margin-right:.5rem;padding:.4rem .8rem;cursor:pointer}
table{border-collapse:collapse;margin-top:1rem}td,th{border:1px solid #444;padding:.3rem .8rem}</style>
</head><body data-cmp="tttdb.page_root">
<h2 data-cmp="tttdb.page_title">PostgreSQL test server</h2>
<p data-cmp="tttdb.page_dburl">DB: <b>${dbLabel}</b></p>
<p data-cmp="tttdb.page_actions">
  <button data-cmp="tttdb.addx_btn" onclick="add('X')">Record X win</button>
  <button data-cmp="tttdb.addo_btn" onclick="add('O')">Record O win</button>
  <button data-cmp="tttdb.adddraw_btn" onclick="add('draw')">Record draw</button>
</p>
<div id="out" data-cmp="tttdb.rows_wrap"></div>
<script>
async function refresh(){
  // The endpoint answers { error } on a DB failure — never assume an array.
  const body = await (await fetch('/api/scores')).json().catch(() => null);
  const out = document.getElementById('out');
  if (!Array.isArray(body)) {
    out.innerHTML = '<p data-cmp="tttdb.rows_error">' + ((body && body.error) || 'score API error') + '</p>';
    return;
  }
  out.innerHTML = '<table><tr><th>id</th><th>winner</th><th>played_at</th></tr>'
    + body.map(r => '<tr><td>'+r.id+'</td><td>'+r.winner+'</td><td>'+r.played_at+'</td></tr>').join('')
    + '</table>';
}
async function add(winner){
  await fetch('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({winner})});
  refresh();
}
refresh();
</script></body></html>`);
});

const port = Number(process.env.PORT) || 5050;
// Listen even when the table can't be created yet: a DB that is still booting
// (or was just reset) must not leave the API in a restart loop with no
// diagnostics — every query re-creates the table on demand, and /api/health
// reports the failure meanwhile.
ensureTable()
  .catch((err) => console.error("[ttt-db] scores table not ready yet:", err.message || err))
  .then(() => app.listen(port, () => console.log(`[ttt-db] score API on :${port} — db: ${dbLabel}`)));
