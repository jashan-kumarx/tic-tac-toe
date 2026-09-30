/**
 * Helpers for the AI-hint and email features (server: /api/hint,
 * /api/email-result, /api/integrations). Pure so they're testable with
 * `node --test` like scores.mjs.
 */

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/** Mirrors the server's check so obvious typos never leave the browser. */
export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}

/** "row 1, column 3" for board index 2 — easier to read than an index. */
export function describeSquare(index) {
  return `row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}`;
}

/** Human-readable hint line from a /api/hint reply. */
export function describeHint(hint) {
  if (!hint || !Number.isInteger(hint.square)) return "No hint available.";
  const by = hint.source === "fallback" ? "rule-based (no LLM wired)" : `AI via ${hint.source}`;
  return `Try ${describeSquare(hint.square)}. ${hint.reason || ""} [${by}]`.replace(/\s+\[/, " [");
}

/** Reason for a failed call, preferring the server's own message. */
export function describeApiError(body, fallback) {
  const msg = body && typeof body === "object" ? body.error : null;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}
