const test = require("node:test");
const assert = require("node:assert");
const { validateBoard, localHint, resolveLlmTarget, parseHint, getHint } = require("../llm");

const E = null;
const board = (s) => s.split("").map((c) => (c === "." ? E : c));

test("validateBoard rejects malformed and finished boards", () => {
  assert.ok(validateBoard([], "X"));
  assert.ok(validateBoard(board("........."), "Z"));
  assert.ok(validateBoard(["x", E, E, E, E, E, E, E, E], "X"));
  assert.ok(validateBoard(board("XXXOO...."), "O"), "already won");
  assert.ok(validateBoard(board("XOXXOOOXX"), "X"), "full");
  assert.strictEqual(validateBoard(board("X...O...."), "X"), null);
});

test("localHint wins, then blocks, then takes the centre", () => {
  assert.strictEqual(localHint(board("XX.OO...."), "X").square, 2);
  assert.strictEqual(localHint(board("XX.O....."), "O").square, 2);
  assert.strictEqual(localHint(board("X........"), "O").square, 4);
});

test("resolveLlmTarget prefers the gateway and never needs a raw key there", () => {
  const gw = resolveLlmTarget({ GATEWAY_URL: "https://gw.example/", LOOPER_VAT: "vat", LOOPER_APP_KEY: "ak", ANTHROPIC_API_KEY: "raw" });
  assert.strictEqual(gw.mode, "gateway");
  assert.strictEqual(gw.url, "https://gw.example/v1/messages");
  assert.deepStrictEqual(gw.headers, { "x-api-key": "vat", "X-Looper-App-Key": "ak" });
  assert.strictEqual(resolveLlmTarget({ ANTHROPIC_API_KEY: "raw" }).mode, "direct");
  assert.strictEqual(resolveLlmTarget({ GATEWAY_URL: "https://gw" }), null, "partial gateway env is not enough");
});

test("parseHint only accepts an empty in-range square", () => {
  const b = board("X........");
  assert.deepStrictEqual(parseHint('Sure: {"square": 4, "reason": "centre"}', b), { square: 4, reason: "centre" });
  assert.strictEqual(parseHint('{"square": 0}', b), null, "occupied");
  assert.strictEqual(parseHint('{"square": 9}', b), null);
  assert.strictEqual(parseHint("no json", b), null);
});

test("getHint without any LLM env falls back without calling out", async () => {
  const hint = await getHint(board("X........"), "O", { env: {}, fetchImpl: () => assert.fail("no call") });
  assert.strictEqual(hint.source, "fallback");
  assert.strictEqual(hint.square, 4);
});

test("getHint calls the gateway with the app-key header", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"square":8,"reason":"corner"}' }] }) };
  };
  const env = { GATEWAY_URL: "https://gw", LOOPER_VAT: "vat", LOOPER_APP_KEY: "ak" };
  const hint = await getHint(board("X...O...."), "X", { env, fetchImpl });
  assert.deepStrictEqual(hint, { square: 8, reason: "corner", source: "gateway" });
  assert.strictEqual(seen.url, "https://gw/v1/messages");
  assert.strictEqual(seen.init.headers["X-Looper-App-Key"], "ak");
  assert.strictEqual(seen.init.headers["x-api-key"], "vat");
});

test("getHint falls back on an illegal model move and throws on HTTP errors", async () => {
  const env = { ANTHROPIC_API_KEY: "k" };
  const bad = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: '{"square":0}' }] }) });
  assert.strictEqual((await getHint(board("X........"), "O", { env, fetchImpl: bad })).source, "fallback");
  const down = async () => ({ ok: false, status: 401, text: async () => "denied" });
  await assert.rejects(getHint(board("X........"), "O", { env, fetchImpl: down }), (e) => e.status === 401);
});
