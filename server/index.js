/**
 * Minimal score API to exercise a Looper-provisioned MongoDB database.
 * The connection string arrives via DATABASE_URL (wire it to {{db.<name>.url}}
 * in the runner env); the server fails loudly when it's missing so a broken
 * wiring is visible immediately instead of silently pointing elsewhere.
 */
const express = require("express");
const { MongoClient } = require("mongodb");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "[ttt-db] DATABASE_URL is not set — add DATABASE_URL={{db.<name>.url}} to this runner's env."
  );
  process.exit(1);
}
if (!/^mongodb(\+srv)?:\/\//.test(dbUrl)) {
  console.error(`[ttt-db] DATABASE_URL must be a mongodb:// url on this branch (got scheme "${dbUrl.split(":")[0]}").`);
  process.exit(1);
}

// Password hidden in logs/status page; host+port+db are what matter for wiring checks.
const dbLabel = dbUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
const client = new MongoClient(dbUrl);
let scores; // the "scores" collection, set once connected

async function init() {
  await client.connect();
  // Looper's managed Mongo url names the app db in its path; db() uses it
  // (the driver falls back to "test" when a hand-written url has none).
  scores = client.db().collection("scores");
  await scores.createIndex({ played_at: -1 });
}

// Documents → the same row shape the SQL branches return.
const toRow = (d) => ({ id: String(d._id), winner: d.winner, played_at: d.played_at });

const app = express();
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    res.json({ ok: true, dbUrl: dbLabel, scores: await scores.countDocuments() });
  } catch (err) {
    res.status(503).json({ ok: false, dbUrl: dbLabel, error: String(err.message || err) });
  }
});

app.get("/api/scores", async (_req, res) => {
  try {
    const docs = await scores.find().sort({ played_at: -1 }).limit(20).toArray();
    res.json(docs.map(toRow));
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
    const { insertedId } = await scores.insertOne({ winner, played_at: new Date() });
    res.json({ id: String(insertedId), winner });
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
<h2 data-cmp="tttdb.page_title">MongoDB test server</h2>
<p data-cmp="tttdb.page_dburl">DB: <b>${dbLabel}</b></p>
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
init()
  .then(() => app.listen(port, () => console.log(`[ttt-db] score API on :${port} — db: ${dbLabel}`)))
  .catch((err) => {
    // Fail loudly: an unreachable DB should show in the runner logs, not hang.
    console.error(`[ttt-db] could not connect to MongoDB at ${dbLabel}: ${err.message || err}`);
    process.exit(1);
  });
