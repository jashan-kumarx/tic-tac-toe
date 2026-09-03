/**
 * Minimal score API to exercise a Looper-provisioned SQLite database.
 * The DB file path arrives via DATABASE_FILE (wire it to {{db.<name>.url}}
 * in the runner env); the server fails loudly when it's missing so a broken
 * wiring is visible immediately instead of silently using a local file.
 */
const express = require("express");
const Database = require("better-sqlite3");

const dbFile = process.env.DATABASE_FILE;
if (!dbFile) {
  console.error(
    "[ttt-db] DATABASE_FILE is not set — add DATABASE_FILE={{db.<name>.url}} to this runner's env."
  );
  process.exit(1);
}

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  winner    TEXT NOT NULL,
  played_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM scores").get();
  res.json({ ok: true, dbFile, scores: n });
});

app.get("/api/scores", (_req, res) => {
  res.json(db.prepare("SELECT * FROM scores ORDER BY id DESC LIMIT 20").all());
});

app.post("/api/scores", (req, res) => {
  const winner = String((req.body && req.body.winner) || "");
  if (!["X", "O", "draw"].includes(winner)) {
    return res.status(400).json({ error: "winner must be X, O or draw" });
  }
  const info = db.prepare("INSERT INTO scores (winner) VALUES (?)").run(winner);
  res.json({ id: info.lastInsertRowid, winner });
});

// Built-in status page: verifies the whole DB loop without the game UI.
app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html><head><title>ttt-db test</title>
<style>body{font-family:monospace;background:#111;color:#ddd;padding:2rem;max-width:40rem}
button{margin-right:.5rem;padding:.4rem .8rem;cursor:pointer}
table{border-collapse:collapse;margin-top:1rem}td,th{border:1px solid #444;padding:.3rem .8rem}</style>
</head><body data-cmp="tttdb.page_root">
<h2 data-cmp="tttdb.page_title">SQLite test server</h2>
<p data-cmp="tttdb.page_dbfile">DB file: <b>${dbFile}</b></p>
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
app.listen(port, () =>
  console.log(`[ttt-db] score API on :${port} — db: ${dbFile}`)
);
