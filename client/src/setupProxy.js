/**
 * CRA dev-server proxy for the score API. Replaces the static "proxy" field
 * in package.json: Looper can remap the api runner onto any port (3100-3999),
 * so the target must come from env. Set BACKEND_URL on the FRONTEND runner,
 * e.g. BACKEND_URL=http://localhost:{{<api-runner>.port}} (Looper resolves the
 * template to the port the api runner actually got). Defaults to
 * http://localhost:5050 for plain non-Looper local runs.
 * http-proxy-middleware ships inside react-scripts.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Accept the shorthands people actually type: a bare port ("5008") or a
 * host:port ("localhost:5008") — http-proxy silently fails on a target
 * without a scheme, which surfaces as "score API unreachable" in the UI.
 */
function toProxyTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) return "http://localhost:5050";
  if (/^\d+$/.test(value)) return `http://localhost:${value}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return `http://${value}`;
  return value;
}

module.exports = function (app) {
  const target = toProxyTarget(process.env.BACKEND_URL);
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
