const test = require("node:test");
const assert = require("node:assert");
const { isRecoverableDbError } = require("../dbErrors");

test("a reset wipes the schema — the missing table is recoverable", () => {
  assert.strictEqual(isRecoverableDbError({ code: "42P01", message: 'relation "scores" does not exist' }), true);
});

test("a recreated database and a dropped connection are recoverable", () => {
  for (const code of ["3D000", "57P01", "08006", "ECONNREFUSED", "ECONNRESET"]) {
    assert.strictEqual(isRecoverableDbError({ code }), true, code);
  }
  assert.strictEqual(isRecoverableDbError({ message: "Connection terminated unexpectedly" }), true);
});

test("a real query bug is not retried", () => {
  assert.strictEqual(isRecoverableDbError({ code: "42703", message: "column x does not exist" }), false);
  assert.strictEqual(isRecoverableDbError(null), false);
});
