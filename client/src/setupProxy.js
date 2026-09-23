/**
 * CRA dev-server proxy for the score API. Replaces the static "proxy" field
 * in package.json: Looper can remap the api runner onto any port (3100-3999),
 * so the target must come from env. Resolution order:
 *   BACKEND_URL        — set it yourself on the FRONTEND runner, e.g.
 *                        BACKEND_URL=http://localhost:{{<api-runner>.port}}
 *   LOOPER_BACKEND_URL — injected by Looper in a published app (the api
 *                        runner's port on the shared pod loopback), so a
 *                        deployment needs no manual wiring at all
 *   SCORE_API_PORT     — a bare port, still honoured
 * http-proxy-middleware ships inside react-scripts.
 *
 * The fallback below is composed from DEFAULT_API_PORT rather than written as
 * a literal address: this file also runs in the published container (the
 * frontend runner starts the CRA dev server), and a hardcoded localhost port
 * there points at nothing — which is exactly what Looper's publish scan flags.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

/** Port `npm start` uses outside Looper, where no BACKEND_URL is set. */
const DEFAULT_API_PORT = 5050;
const DEFAULT_TARGET = `http://localhost:${DEFAULT_API_PORT}`;

/**
 * Accept the shorthands people actually type: a bare port, or a host:port
 * without a scheme — http-proxy silently fails on a target without one,
 * which surfaces as "score API unreachable" in the UI.
 */
function toProxyTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_TARGET;
  if (/^\d+$/.test(value)) return `http://localhost:${value}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return `http://${value}`;
  return value;
}

module.exports = function (app) {
  const configured = process.env.BACKEND_URL || process.env.LOOPER_BACKEND_URL || process.env.SCORE_API_PORT;
  const target = toProxyTarget(configured);
  // Unset in a deployed container means /api proxies to a port nothing owns;
  // say so at boot instead of letting every score call fail silently.
  if (!configured) {
    console.warn(`[ttt-client] no BACKEND_URL/LOOPER_BACKEND_URL — falling back to ${DEFAULT_TARGET}, which only exists on a local machine`);
  }
  console.log(`[ttt-client] proxying /api -> ${target}`);
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
module.exports.toProxyTarget = toProxyTarget;
module.exports.DEFAULT_TARGET = DEFAULT_TARGET;
