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

module.exports = function (app) {
  const target = process.env.BACKEND_URL || "http://localhost:5050";
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
