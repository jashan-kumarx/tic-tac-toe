/**
 * AI move hints through Looper's LLM gateway.
 *
 * A published app gets GATEWAY_URL + LOOPER_VAT + LOOPER_APP_KEY (Production →
 * LLM gateway). None is a real provider key: the VAT is a virtual token the
 * gateway swaps for the workspace's Anthropic key, and the app key proves the
 * call comes from this deployment. The gateway refuses browser calls (Origin
 * header), so this must run server-side. In dev there is no gateway — a plain
 * ANTHROPIC_API_KEY is used instead when present.
 */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/**
 * Validate a board from the client: 9 cells of "X" | "O" | null, plus whose turn.
 * @returns {string|null} an error message, or null when valid
 */
function validateBoard(squares, next) {
  if (!Array.isArray(squares) || squares.length !== 9) return "squares must be an array of 9 cells";
  if (!squares.every((c) => c === null || c === "X" || c === "O")) return "each cell must be X, O or null";
  if (next !== "X" && next !== "O") return "next must be X or O";
  if (!squares.includes(null)) return "the board is full";
  if (winnerOf(squares)) return "the game is already over";
  return null;
}

/** "X" | "O" | null for a board. */
function winnerOf(squares) {
  for (const [a, b, c] of LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
  }
  return null;
}

/**
 * Rule-based move (win → block → centre → corner → any). Used when no model is
 * configured or the model answers with an illegal square, so a hint never fails.
 */
function localHint(squares, next) {
  const other = next === "X" ? "O" : "X";
  const completing = (who) => {
    for (const line of LINES) {
      const marks = line.map((i) => squares[i]);
      if (marks.filter((m) => m === who).length === 2 && marks.includes(null)) return line[marks.indexOf(null)];
    }
    return -1;
  };
  const win = completing(next);
  if (win >= 0) return { square: win, reason: "Take the winning square." };
  const block = completing(other);
  if (block >= 0) return { square: block, reason: `Block ${other} from completing a line.` };
  if (squares[4] === null) return { square: 4, reason: "The centre is part of the most lines." };
  const corner = [0, 2, 6, 8].find((i) => squares[i] === null);
  if (corner !== undefined) return { square: corner, reason: "Corners open two diagonals." };
  return { square: squares.indexOf(null), reason: "Only edges are left." };
}

/**
 * Where the Anthropic call goes, from the environment. Gateway wins over a raw
 * key so a published app never needs a real key in its env.
 * @returns {{ mode: "gateway"|"direct", url: string, headers: object }|null}
 */
function resolveLlmTarget(env) {
  if (env.GATEWAY_URL && env.LOOPER_VAT && env.LOOPER_APP_KEY) {
    return {
      mode: "gateway",
      url: `${env.GATEWAY_URL.replace(/\/+$/, "")}/v1/messages`,
      headers: { "x-api-key": env.LOOPER_VAT, "X-Looper-App-Key": env.LOOPER_APP_KEY },
    };
  }
  if (env.ANTHROPIC_API_KEY) {
    return { mode: "direct", url: "https://api.anthropic.com/v1/messages", headers: { "x-api-key": env.ANTHROPIC_API_KEY } };
  }
  return null;
}

/** Prompt the model with a readable board; asks for strict JSON back. */
function buildPrompt(squares, next) {
  const cell = (i) => squares[i] || String(i);
  const rows = [0, 3, 6].map((r) => ` ${cell(r)} | ${cell(r + 1)} | ${cell(r + 2)}`).join("\n---+---+---\n");
  return (
    `You are a tic-tac-toe coach. It is ${next}'s turn. Empty squares show their index (0-8).\n\n${rows}\n\n` +
    `Reply with ONLY a JSON object: {"square": <index of an empty square>, "reason": "<one short sentence>"}`
  );
}

/** Pull {square, reason} out of a model reply; null when unusable or illegal. */
function parseHint(text, squares) {
  const match = /\{[\s\S]*\}/.exec(String(text || ""));
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const square = Number(obj.square);
    if (!Number.isInteger(square) || square < 0 || square > 8 || squares[square] !== null) return null;
    return { square, reason: String(obj.reason || "").slice(0, 200) };
  } catch {
    return null;
  }
}

/**
 * Ask the model for a move. Falls back to localHint when the model is not
 * configured or answers badly; throws only on an upstream HTTP/network error.
 * @returns {Promise<{square:number, reason:string, source:"gateway"|"direct"|"fallback"}>}
 */
async function getHint(squares, next, { env = process.env, fetchImpl = fetch } = {}) {
  const target = resolveLlmTarget(env);
  if (!target) return { ...localHint(squares, next), source: "fallback" };

  const res = await fetchImpl(target.url, {
    method: "POST",
    headers: { ...target.headers, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.HINT_MODEL || DEFAULT_MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: buildPrompt(squares, next) }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`LLM ${target.mode} answered ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const hint = parseHint(text, squares);
  return hint ? { ...hint, source: target.mode } : { ...localHint(squares, next), source: "fallback" };
}

module.exports = { validateBoard, winnerOf, localHint, resolveLlmTarget, buildPrompt, parseHint, getHint };
