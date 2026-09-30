const test = require("node:test");
const assert = require("node:assert");
const { isValidEmail, buildRawMessage, encodeSubject, resultEmail, callConnector, sendResultEmail } = require("../gmail");

const env = { LOOPER_CONNECTORS_URL: "https://app.example/__looper/connectors/", LOOPER_CONNECTORS_TOKEN: "tok" };

test("isValidEmail accepts one bare address only", () => {
  assert.ok(isValidEmail("a@b.co"));
  for (const bad of ["", "a@b", "a b@c.d", "a@b.c, x@y.z", "A <a@b.c>", "a@b.c\r\nBcc: x@y.z", null]) {
    assert.ok(!isValidEmail(bad), String(bad));
  }
});

test("buildRawMessage keeps headers on one line (no header injection)", () => {
  const raw = buildRawMessage({ to: "a@b.co\r\nBcc: evil@x.y", subject: "Hi\nBcc: evil@x.y", body: "line1\nline2" });
  const headers = raw.split("\r\n\r\n")[0].split("\r\n");
  assert.ok(!headers.some((h) => h.startsWith("Bcc:")));
  assert.ok(raw.endsWith("line1\r\nline2"));
});

test("encodeSubject encodes non-ASCII only", () => {
  assert.strictEqual(encodeSubject("X wins"), "X wins");
  assert.match(encodeSubject("Tic Tac Toe — X wins"), /^=\?UTF-8\?B\?.+\?=$/);
});

test("resultEmail describes wins and draws", () => {
  assert.match(resultEmail({ winner: "O", moves: 7 }).body, /O wins!\nThe game took 7 moves/);
  assert.match(resultEmail({ winner: "draw", moves: NaN }).subject, /draw/);
});

test("callConnector refuses with 503 when the door is not wired", async () => {
  await assert.rejects(callConnector("gmail", "x", {}, { env: {}, fetchImpl: () => assert.fail() }), (e) => e.status === 503);
});

test("sendResultEmail posts gmail_send_message to the door", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: "m1" } }) };
  };
  const result = await sendResultEmail({ to: "a@b.co", winner: "X", moves: 5 }, { env, fetchImpl });
  assert.deepStrictEqual(result, { id: "m1" });
  assert.strictEqual(seen.url, "https://app.example/__looper/connectors/call");
  assert.strictEqual(seen.init.headers.authorization, "Bearer tok");
  const body = JSON.parse(seen.init.body);
  assert.strictEqual(body.alias, "gmail");
  assert.strictEqual(body.action, "gmail_send_message");
  assert.match(body.params.raw_message, /^To: a@b\.co\r\n/);
});

test("callConnector surfaces the door's error and code", async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: "alias not bound", errorCode: "UNBOUND" }) });
  await assert.rejects(callConnector("gmail", "x", {}, { env, fetchImpl }), (e) => e.status === 404 && e.code === "UNBOUND");
  const okButFailed = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: "gmail 403" }) });
  await assert.rejects(callConnector("gmail", "x", {}, { env, fetchImpl: okButFailed }), (e) => e.status === 502);
});
