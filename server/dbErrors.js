/**
 * Classifier for database errors that a *reset* (or a restarting DB container)
 * produces. Looper's "Reset" removes the Postgres container **and** its volume
 * and recreates them, so a long-running API is left with dead pooled clients
 * and a brand-new, empty database — the `scores` table it created at boot is
 * gone. Every one of these is recoverable by re-creating the table and
 * retrying the query once.
 */

/** Postgres SQLSTATEs + socket errors that mean "reconnect and re-create the table". */
const RECOVERABLE = new Set([
  "42P01", // undefined_table — the reset wiped the schema
  "3D000", // invalid_catalog_name — the database itself was recreated
  "57P01", // admin_shutdown — the server went away under us
  "57P03", // cannot_connect_now — still starting up
  "08006", // connection_failure
  "08003", // connection_does_not_exist
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ENOTFOUND",
]);

/** True when `err` is a transient/reset-induced failure worth one retry. */
function isRecoverableDbError(err) {
  if (!err) return false;
  if (RECOVERABLE.has(err.code)) return true;
  // node-postgres reports a pool client that died mid-query without a code.
  return /terminating connection|server closed the connection|Connection terminated/i.test(
    String(err.message || "")
  );
}

module.exports = { isRecoverableDbError, RECOVERABLE };
