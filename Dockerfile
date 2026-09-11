# syntax=docker/dockerfile:1.7
#
# The Dean's List site, as one image.
#
# Four stages, and the reason for each:
#
#   deps        node_modules, with the Prisma client generated for THIS Linux.
#               Kept separate so a code change does not reinstall every package.
#   prisma-cli  the Prisma CLI and everything it requires, installed on its own.
#   builder     `next build`, producing the standalone server.
#   runner      what actually ships: the standalone output, static assets, the
#               migrations and the Prisma CLI to apply them. No compiler, no
#               devDependencies, no source.
#
# The same image runs the app (`node server.js`) and the one-shot migration
# (`node prisma-cli/node_modules/prisma/build/index.js migrate deploy`). One image means
# one thing to build, push, pull and roll back, and the migrations can never be
# a different version from the code that expects them.
#
# NO SECRETS ARE BAKED IN. An image is cached, copied and pushed to a registry,
# so a secret inside one is a secret published. Everything secret arrives as an
# environment variable when the container starts. The only values fixed at
# build time are the three NEXT_PUBLIC_* ones, which end up in the browser's
# JavaScript anyway and are public by definition.

ARG NODE_VERSION=22

# Debian slim rather than Alpine. Prisma's query engine links against glibc and
# OpenSSL; on musl it needs a separate engine build and a matching binaryTarget,
# and getting that wrong fails at the first database query rather than at build.
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------ deps
FROM base AS deps
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ------------------------------------------------------------ prisma-cli
# The Prisma CLI, with its whole dependency tree, for the migrate service.
#
# Copying node_modules/prisma out of `deps` is not enough. The CLI requires
# packages of its own (effect, c12 and more) that npm hoists to the top of the
# tree beside everything else, and the first CI run of this image failed on
# exactly that: "Cannot find module 'effect'". A clean install into a directory
# of its own brings the CLI and what it needs, and nothing of the app's.
#
# Pinned to the version in package-lock.json, so migrations run with the same
# Prisma that generated the client.
FROM base AS prisma-cli
WORKDIR /prisma-cli
COPY package-lock.json /tmp/package-lock.json
RUN version=$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version") \
 && echo '{"private":true}' > package.json \
 && npm install --no-audit --no-fund "prisma@${version}" \
 && rm /tmp/package-lock.json

# --------------------------------------------------------------- builder
FROM deps AS builder
COPY . .

ARG NEXT_PUBLIC_SITE_URL=https://deanslist.live
ARG NEXT_PUBLIC_MEDIA_IMAGE_BASE=
ARG NEXT_PUBLIC_MEDIA_VIDEO_BASE=
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_MEDIA_IMAGE_BASE=${NEXT_PUBLIC_MEDIA_IMAGE_BASE} \
    NEXT_PUBLIC_MEDIA_VIDEO_BASE=${NEXT_PUBLIC_MEDIA_VIDEO_BASE} \
    # Lets src/lib/env.ts accept placeholder DATABASE_URL and AUTH_SECRET for
    # the length of the build. It is honoured only during `next build` and is
    # not carried into the runner stage below.
    SKIP_ENV_VALIDATION=1

RUN npm run build

# ---------------------------------------------------------------- runner
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

# Never root. A compromised Node process running as root owns the container.
#
# /app/uploads is where uploaded files are written. It has to exist in the
# image, owned by the app user: Docker seeds a new named volume from the
# directory it is mounted over, ownership included, and that is what makes the
# volume writable by a non-root process on its first start.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs \
 && mkdir -p /app/uploads \
 && chown nextjs:nodejs /app/uploads

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The generated Prisma client and its query engine for this Linux, copied in
# full rather than trusting the standalone trace to have picked up the native
# engine file: a missing engine fails at the first query, not at boot.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# For the migrate service: the schema and migrations, and the CLI from its own
# stage. Kept out of node_modules so it cannot shadow or be shadowed by the
# packages the server resolves.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=prisma-cli --chown=nextjs:nodejs /prisma-cli/node_modules ./prisma-cli/node_modules

USER nextjs
EXPOSE 3000

# Node's own fetch rather than curl, so there is no extra package to install
# and patch. /api/health answers 503 when the database is unreachable, because
# a server that cannot reach its database renders every page as an error.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
