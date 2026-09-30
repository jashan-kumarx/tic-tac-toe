import test from "node:test";
import assert from "node:assert";
import { isValidEmail, describeSquare, describeHint, describeApiError } from "../src/lib/integrations.mjs";

test("isValidEmail", () => {
  assert.ok(isValidEmail("a@b.co"));
  assert.ok(isValidEmail(" a@b.co "));
  assert.ok(!isValidEmail("a@b"));
  assert.ok(!isValidEmail("a@b.co, c@d.co"));
  assert.ok(!isValidEmail(undefined));
});

test("describeSquare uses 1-based row/column", () => {
  assert.strictEqual(describeSquare(0), "row 1, column 1");
  assert.strictEqual(describeSquare(5), "row 2, column 3");
});

test("describeHint names the source", () => {
  assert.strictEqual(describeHint({ square: 4, reason: "Centre.", source: "gateway" }), "Try row 2, column 2. Centre. [AI via gateway]");
  assert.match(describeHint({ square: 0, reason: "", source: "fallback" }), /^Try row 1, column 1\. \[rule-based/);
  assert.strictEqual(describeHint(null), "No hint available.");
});

test("describeApiError prefers the server message", () => {
  assert.strictEqual(describeApiError({ error: "not wired" }, "x"), "not wired");
  assert.strictEqual(describeApiError(null, "x"), "x");
});
