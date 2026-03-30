## ADDED Requirements

### Requirement: Container builds successfully
The Dockerfile SHALL produce a working container image using a multi-stage build with `node:22-alpine` base images. The final image SHALL NOT contain build tools, dev dependencies, or source code beyond the Next.js standalone output.

#### Scenario: First-time build
- **WHEN** a user runs `docker compose build` in the repository root
- **THEN** the image builds successfully with `better-sqlite3` compiled for the alpine target

#### Scenario: Minimal final image
- **WHEN** the runner stage is built
- **THEN** it contains only the standalone output, `public/` assets, and `.next/static/` files

### Requirement: One-command startup
The application SHALL start with `docker compose up -d` after cloning the repository and configuring the manga directory path.

#### Scenario: Fresh deployment
- **WHEN** a user runs `docker compose up -d` with a valid `MANGA_DIR_HOST` path in `.env`
- **THEN** the manga reader is accessible at `http://localhost:3000`
- **AND** the SQLite database is created automatically on first run

#### Scenario: Restart preserves data
- **WHEN** a user runs `docker compose down` followed by `docker compose up -d`
- **THEN** all reading progress, profiles, and covers are preserved via named volumes

### Requirement: Manga PDFs accessible via bind mount
The container SHALL mount the host manga directory to `/manga` inside the container as a read-only bind mount. The `MANGA_DIR` environment variable inside the container SHALL be set to `/manga`.

#### Scenario: Host manga directory mounted
- **WHEN** the compose service starts with a configured host manga path
- **THEN** manga PDFs from the host directory are accessible at `/manga` inside the container
- **AND** the startup scan discovers all series and volumes

### Requirement: Persistent data volumes
The container SHALL use named Docker volumes for the SQLite database (`/app/data`) and generated cover images (`/app/public/covers`).

#### Scenario: Database persists across container recreations
- **WHEN** a user runs `docker compose down` and `docker compose up -d`
- **THEN** the SQLite database at `/app/data/manga-reader.db` retains all data

#### Scenario: Covers persist across container recreations
- **WHEN** a user runs `docker compose down` and `docker compose up -d`
- **THEN** previously generated cover images in `/app/public/covers/` are still present

### Requirement: Environment configuration via .env file
A `.env.example` file SHALL document all configurable environment variables. Users SHALL copy it to `.env` to customize deployment without editing `docker-compose.yml`.

#### Scenario: Custom manga directory
- **WHEN** a user sets `MANGA_DIR_HOST=/path/to/manga` in `.env`
- **THEN** the compose service mounts that path into the container

#### Scenario: Custom port
- **WHEN** a user sets `PORT=8080` in `.env`
- **THEN** the application is accessible at `http://localhost:8080`

### Requirement: Non-root container execution
The application process inside the container SHALL run as a non-root user (UID 1001).

#### Scenario: Process runs as non-root
- **WHEN** the container is running
- **THEN** the Node.js process runs as user `nodejs` (UID 1001), not root

### Requirement: Dockerignore excludes unnecessary files
A `.dockerignore` file SHALL exclude files not needed in the build context (e.g., `node_modules`, `.git`, `data/`, `.next/`, `.env`).

#### Scenario: Build context is minimal
- **WHEN** `docker compose build` is run
- **THEN** the build context excludes `.git`, `node_modules`, `data/`, `.next/`, and `.env`
