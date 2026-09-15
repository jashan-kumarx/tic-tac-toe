# Score API image for the Tic Tac Toe app (SQLite flavour).
# Build context is this folder (server/), which is what Looper defaults to for
# a Dockerfile in a runner's workdir. Doubles as the isolated-runner image:
# Looper builds this file, then mounts the repo at /workspace and runs the
# runner's command inside the container.
#
# Two stages because better-sqlite3 is a native addon with no prebuilt binary
# for this node/ABI — it has to be compiled, but the compiler has no business
# in the image that ships. Same base in both stages so the .node it produces
# matches the runtime's node and libc.
FROM node:24-slim AS deps

# node-gyp needs python3 + a C++ toolchain to build better-sqlite3.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/server

# Deps first — this layer is reused until package.json / the lockfile change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim

# curl keeps /api/health debuggable from inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/server

COPY --from=deps /workspace/server/node_modules ./node_modules
COPY package.json package-lock.json index.js ./

# DATABASE_FILE is injected per runner ({{db.<name>.url}}); Looper sets PORT.
ENV NODE_ENV=production \
    PORT=5050
EXPOSE 5050

CMD ["node", "index.js"]
