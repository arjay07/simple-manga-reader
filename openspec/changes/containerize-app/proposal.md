## Why

The manga reader is currently run directly with Node.js, making deployment to another machine cumbersome — it requires installing the right Node version, native build tools for better-sqlite3, and manually configuring environment variables. Containerizing the app enables a single `docker compose up` command to get everything running on any machine (including the target Windows PC with Docker Desktop).

## What Changes

- Add multi-stage `Dockerfile` optimized for Next.js standalone output with native `better-sqlite3` compilation
- Add `docker-compose.yml` with opinionated defaults for volume mounts (manga PDFs, SQLite DB, generated covers) and environment variables
- Add `.dockerignore` to keep the build context small
- Enable Next.js `output: 'standalone'` in `next.config.ts`
- Add `.env.example` documenting available environment variables for easy configuration

## Capabilities

### New Capabilities
- `docker-deployment`: Dockerfile, docker-compose.yml, .dockerignore, and .env.example for one-command containerized deployment

### Modified Capabilities
<!-- No existing spec-level requirements are changing — this is purely additive infrastructure -->

## Impact

- **Config**: `next.config.ts` gains `output: 'standalone'`
- **New files**: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`
- **Dependencies**: No new runtime dependencies; build stage needs Node + build tools (already in base images)
- **Data persistence**: SQLite DB and covers persist via Docker volumes; manga PDFs mounted from host
- **Deployment**: `git clone` → `docker compose up -d` on any Docker-capable machine
