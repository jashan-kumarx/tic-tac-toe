/**
 * CRA dev-server proxy for the score API. Replaces the static "proxy" field
 * in package.json: Looper can remap the api runner onto any port (3100-3999),
 * so the target must come from env. Set SCORE_API_PORT on the FRONTEND runner
 * to the port shown on the api runner's card; defaults to 5050 for plain
 * non-Looper local runs. http-proxy-middleware ships inside react-scripts.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const port = process.env.SCORE_API_PORT || 5050;
  app.use(
    "/api",
    createProxyMiddleware({
      target: `http://localhost:${port}`,
      changeOrigin: true,
    })
  );
};
