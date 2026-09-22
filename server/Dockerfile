# Score API image for the Tic Tac Toe app (SQLite flavour).
# Build context is this folder (server/), which is what Looper defaults to for
# a Dockerfile in a runner's workdir. Doubles as the isolated-runner image:
# Looper builds this file, then mounts the repo at /workspace and runs the
# runner's command inside the container.
#
# Node 22, not 24, on purpose: better-sqlite3 11.x ships prebuilt binaries only
# up to Node 23's ABI (v131). On Node 24 npm falls back to compiling from
# source, which needs python3/make/g++ — and Looper installs a runner's deps
# inside THIS image, so a slim runtime image fails the publish's deps step.
# Staying on a prebuilt ABI keeps the image slim and the install fast.
FROM node:22-slim

# curl keeps /api/health debuggable from inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/server

# Deps first — this layer is reused until package.json / the lockfile change.
# Looper mounts its own node_modules volume over this at run time; baking them
# in keeps the image runnable on its own (docker run) too.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./

# DATABASE_FILE is injected per runner ({{db.<name>.url}}); Looper sets PORT.
ENV NODE_ENV=production \
    PORT=5050
EXPOSE 5050

CMD ["node", "index.js"]
