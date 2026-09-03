/**
 * Minimal score API to exercise Looper-provisioned databases end to end.
 * One server, two engines, picked by the DATABASE_URL scheme:
 *   postgresql://…  → PostgreSQL (pg)
 *   anything else   → SQLite file path (better-sqlite3)
 * Wire DATABASE_URL={{db.<name>.url}} on this runner. DATABASE_FILE is still
 * accepted as an alias so the original sqlite wiring keeps working. The server
 * fails loudly when neither is set so a broken wiring is visible immediately.
 */
const express = require("express");

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_FILE;
if (!dbUrl) {
  console.error(
    "[ttt-db] DATABASE_URL is not set — add DATABASE_URL={{db.<name>.url}} to this runner's env."
  );
  process.exit(1);
}

/** Pick the adapter from the URL scheme. Each exposes init/count/list/insert. */
function engineFor(url) {
  if (/^postgres(ql)?:\/\//.test(url)) return "postgres";
  return "sqlite";
}
const engine = engineFor(dbUrl);

function sqliteAdapter(file) {
  const Database = require("better-sqlite3");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS scores (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    winner    TEXT NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  return {
    init: async () => {},
    count: async () => db.prepare("SELECT COUNT(*) AS n FROM scores").get().n,
    list: async () => db.prepare("SELECT * FROM scores ORDER BY id DESC LIMIT 20").all(),
    insert: async (winner) => db.prepare("INSERT INTO scores (winner) VALUES (?)").run(winner).lastInsertRowid,
  };
}

function postgresAdapter(url) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  return {
    init: async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS scores (
        id        SERIAL PRIMARY KEY,
        winner    TEXT NOT NULL,
        played_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    },
    count: async () => Number((await pool.query("SELECT COUNT(*) AS n FROM scores")).rows[0].n),
    list: async () => (await pool.query("SELECT * FROM scores ORDER BY id DESC LIMIT 20")).rows,
    insert: async (winner) =>
      (await pool.query("INSERT INTO scores (winner) VALUES ($1) RETURNING id", [winner])).rows[0].id,
  };
}

const db =
  engine === "postgres" ? postgresAdapter(dbUrl) : sqliteAdapter(dbUrl);

// Credentials never reach logs or the status page.
const safeUrl = dbUrl.replace(/\/\/([^@/]+)@/, "//***@");

const app = express();
app.use(express.json());

// Every handler is async against a network DB now — surface failures as 4xx
// JSON instead of a hung request.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => res.status(400).json({ error: String(err.message || err) }));

app.get("/api/health", wrap(async (_req, res) => {
  res.json({ ok: true, engine, db: safeUrl, scores: await db.count() });
}));

app.get("/api/scores", wrap(async (_req, res) => {
  res.json(await db.list());
}));

app.post("/api/scores", wrap(async (req, res) => {
  const winner = String((req.body && req.body.winner) || "");
  if (!["X", "O", "draw"].includes(winner)) {
    return res.status(400).json({ error: "winner must be X, O or draw" });
  }
  res.json({ id: await db.insert(winner), winner });
}));

// Built-in status page: verifies the whole DB loop without the game UI.
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html><head><title>ttt-db test</title>
<style>body{font-family:monospace;background:#111;color:#ddd;padding:2rem;max-width:40rem}
button{margin-right:.5rem;padding:.4rem .8rem;cursor:pointer}
table{border-collapse:collapse;margin-top:1rem}td,th{border:1px solid #444;padding:.3rem .8rem}</style>
</head><body data-cmp="tttdb.page_root">
<h2 data-cmp="tttdb.page_title">${engine} test server</h2>
<p data-cmp="tttdb.page_dbfile">DB: <b>${safeUrl}</b></p>
<p data-cmp="tttdb.page_actions">
  <button data-cmp="tttdb.addx_btn" onclick="add('X')">Record X win</button>
  <button data-cmp="tttdb.addo_btn" onclick="add('O')">Record O win</button>
  <button data-cmp="tttdb.adddraw_btn" onclick="add('draw')">Record draw</button>
</p>
<div id="out" data-cmp="tttdb.rows_wrap"></div>
<script>
async function refresh(){
  const rows = await (await fetch('/api/scores')).json();
  document.getElementById('out').innerHTML = '<table><tr><th>id</th><th>winner</th><th>played_at</th></tr>'
    + rows.map(r => '<tr><td>'+r.id+'</td><td>'+r.winner+'</td><td>'+r.played_at+'</td></tr>').join('')
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
db.init()
  .then(() => app.listen(port, () =>
    console.log(`[ttt-db] score API on :${port} — engine: ${engine}, db: ${safeUrl}`)))
  .catch((err) => {
    // Fail loudly: an unreachable DB should show in the runner logs, not hang.
    console.error(`[ttt-db] could not connect to ${engine} at ${safeUrl}: ${err.message || err}`);
    process.exit(1);
  });
