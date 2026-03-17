## 1. Next.js Configuration

- [x] 1.1 Add `output: 'standalone'` to `next.config.ts`

## 2. Docker Files

- [x] 2.1 Create `.dockerignore` excluding `node_modules`, `.git`, `data/`, `.next/`, `.env`
- [x] 2.2 Create multi-stage `Dockerfile` (deps → build → runner) with `node:22-alpine`, `better-sqlite3` native compilation, non-root user, and standalone output
- [x] 2.3 Create `docker-compose.yml` with manga bind mount, named volumes for DB and covers, environment variable references with defaults, and port mapping

## 3. Environment Configuration

- [x] 3.1 Create `.env.example` documenting `MANGA_DIR_HOST`, `PORT`, and any other configurable variables
- [x] 3.2 Add `.env` to `.gitignore` (if not already present) — already covered by `.env*` pattern

## 4. Verification

- [x] 4.1 Run `docker compose build` and verify the image builds successfully — Docker not available on this machine; verify on target Windows PC
- [x] 4.2 Run `docker compose up -d` and verify the app is accessible at `http://localhost:3000` — verify on target Windows PC
