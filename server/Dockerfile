# Score API image for the Tic Tac Toe app (PostgreSQL flavour).
# Build context is this folder (server/), which is what Looper defaults to for
# a Dockerfile in a runner's workdir. Doubles as the isolated-runner image:
# Looper builds this file, then mounts the repo at /workspace and runs the
# runner's command inside the container.
FROM node:24-slim

# pg needs no build toolchain; curl keeps /api/health debuggable from inside.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/server

# Deps first — this layer is reused until package.json / the lockfile change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

# DATABASE_URL is injected per runner ({{db.<name>.url}}); Looper sets PORT.
ENV NODE_ENV=production \
    PORT=5050
EXPOSE 5050

CMD ["node", "index.js"]
