# syntax=docker/dockerfile:1
# One image serves the API and the built web app from one origin, so the app needs no CORS and
# the CSP can stay at 'self'. The build stage has the dev tools; the runtime stage has only the
# server's production dependencies and runs as the unprivileged "node" user.

FROM node:22.23-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY web web
RUN npm run build -w web

FROM node:22.23-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=web/dist \
    TRUST_PROXY=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
COPY web/package.json web/
# Every workspace manifest is copied so the lockfile matches, but only the server's production
# dependencies are installed (the core is linked); the web app's packages never reach this image.
RUN npm ci --omit=dev --ignore-scripts --workspace=server --include-workspace-root=false \
    && npm cache clean --force
COPY packages/core/src packages/core/src
COPY server/src server/src
COPY --from=build /app/web/dist web/dist
USER node
EXPOSE 8080
# Node 22.18+ strips TypeScript types natively, so the server runs from source without a build.
# GEMINI_API_KEY comes from Secret Manager at deploy time; without it the server refuses to start.
CMD ["node", "server/src/index.ts"]
