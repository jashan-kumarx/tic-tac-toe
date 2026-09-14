import test from "node:test";
import assert from "node:assert";
import { parseScores, describeScoreError } from "../src/lib/scores.mjs";

test("a normal reply passes through", () => {
  const rows = [{ id: 1, winner: "X", played_at: "now" }];
  assert.deepStrictEqual(parseScores(true, rows), { scores: rows, error: null });
});

test("a post-reset 503 yields an empty list, never the error object", () => {
  const { scores, error } = parseScores(false, { error: 'relation "scores" does not exist' });
  assert.ok(Array.isArray(scores) && scores.length === 0);
  assert.match(error, /relation "scores" does not exist/);
});

test("an unreachable API (no body) still yields an array", () => {
  const { scores, error } = parseScores(false, null);
  assert.deepStrictEqual(scores, []);
  assert.match(error, /unreachable/);
});

test("a 200 with a non-array body is treated as an error", () => {
  assert.deepStrictEqual(parseScores(true, { error: "weird" }).scores, []);
  assert.strictEqual(describeScoreError({ error: "weird" }), "score API error — weird");
});
