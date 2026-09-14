/**
 * Normalizer for the /api/scores reply. The endpoint answers 503 + `{ error }`
 * whenever the database is unavailable — which is exactly what happens right
 * after a *reset*, since the container and volume are recreated empty. Feeding
 * that object straight into state crashed the whole game with
 * "scores.map is not a function", so parsing always yields an array.
 */
export function parseScores(ok, body) {
  if (ok && Array.isArray(body)) return { scores: body, error: null };
  return { scores: [], error: describeScoreError(body) };
}

/** Human-readable reason for a failed score-API call. */
export function describeScoreError(body) {
  const reported = body && typeof body === "object" ? body.error : null;
  if (typeof reported === "string" && reported.trim()) {
    return `score API error — ${reported}`;
  }
  return "score API unreachable — is the db server runner started?";
}
