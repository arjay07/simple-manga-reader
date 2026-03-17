## Context

The manga reader is a Next.js 16 app with a `better-sqlite3` database and filesystem-based manga PDF storage. It currently requires manual Node.js setup, native compilation of `better-sqlite3`, and environment configuration. The goal is to make deployment a one-command operation via Docker, targeting a Windows PC running Docker Desktop (WSL2 backend).

Key constraints:
- `better-sqlite3` is a native C++ addon requiring build tools at compile time
- SQLite DB (`data/manga-reader.db`) and generated covers (`public/covers/`) must persist across container restarts
- Manga PDFs are stored on the host filesystem and mounted read-only into the container
- Next.js standalone output mode is the canonical way to containerize Next.js apps

## Goals / Non-Goals

**Goals:**
- One-command deployment: `docker compose up -d` after cloning the repo
- Minimal final image size via multi-stage build
- Persistent data (DB, covers) via Docker volumes
- Host manga directory mounted via bind mount
- Configurable via `.env` file (no need to edit compose file)

**Non-Goals:**
- CI/CD pipeline or automated image publishing to a registry
- HTTPS/TLS termination (use a reverse proxy if needed)
- Multi-architecture image builds (build on the target machine)
- Kubernetes or orchestration support
- Backup/restore tooling for the SQLite database

## Decisions

### 1. Multi-stage Dockerfile (3 stages)

**Choice:** Three-stage build — deps, build, runner.

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `deps` | `node:22-alpine` | Install all node_modules (including native `better-sqlite3` compilation) |
| `build` | `node:22-alpine` | Copy deps, run `next build` with `output: 'standalone'` |
| `runner` | `node:22-alpine` | Copy standalone output + public + static, run with minimal footprint |

**Why alpine:** Smallest image size. `better-sqlite3` compiles fine on alpine with `build-base` and `python3` packages.

**Why not distroless/scratch:** Need a shell for debugging and `node` runtime.

**Alternatives considered:**
- Single-stage build: simpler but produces a ~1GB+ image with dev dependencies and build tools
- `node:22-slim` (Debian): larger base but avoids potential musl/glibc issues — alpine is fine for this stack

### 2. Standalone output mode

**Choice:** Set `output: 'standalone'` in `next.config.ts`.

**Why:** Next.js traces dependencies and produces a minimal `node_modules` folder (~50MB vs ~300MB+). This is the officially recommended approach for Docker.

### 3. Volume strategy

**Choice:** Named volumes for app data, bind mount for manga PDFs.

```
manga PDFs   → bind mount  (host path → /manga)
SQLite DB    → named volume (manga-data → /app/data)
Covers       → named volume (manga-covers → /app/public/covers)
```

**Why bind mount for PDFs:** User needs to easily add/remove manga files from the host filesystem. Named volumes are opaque.

**Why named volumes for DB/covers:** These are managed by the app, not the user. Named volumes avoid Windows filesystem performance issues with SQLite writes.

### 4. Environment configuration via .env file

**Choice:** `docker-compose.yml` references variables with defaults. User creates `.env` from `.env.example` to override.

**Why:** Avoids editing `docker-compose.yml` directly. The compose file stays version-controlled; `.env` is gitignored.

### 5. Non-root user in container

**Choice:** Run the Next.js process as a non-root `nodejs` user (UID 1001).

**Why:** Security best practice. The app only needs read access to manga PDFs and read/write to data + covers directories.

## Risks / Trade-offs

- **[Risk] Alpine + better-sqlite3 compilation** → Mitigated by installing `build-base` and `python3` in the deps stage; these packages are excluded from the final runner stage.
- **[Risk] SQLite in Docker volume on Windows** → Mitigated by using named volumes (stored in WSL2 ext4 filesystem) rather than bind-mounting from the Windows filesystem.
- **[Risk] Covers directory permissions** → The runner stage must `chown` the covers directory to the `nodejs` user. The Dockerfile handles this during build.
- **[Trade-off] No pre-built registry image** → Users must build on their machine (~2-3 min first time). Acceptable for a self-hosted personal app; can add GHCR later if desired.
