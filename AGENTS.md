# AGENTS

## Architecture

- Monorepo workspace with three folders:
  - `web/`: Angular SSR + Material app (frontend)
  - `backend/`: Express API server with PostgreSQL
  - `shared/`: shared TypeScript models used by both app and backend
- Frontend serves Angular SSR and proxies `/api/*` requests to the backend.
- Backend handles nCore search, TMDB enrichment, caching, Passkey authentication, and qBittorrent integration.
- PostgreSQL stores metadata cache, user credentials, and sessions.

## Workflow

- Keep app code in `web/src` and API code in `backend/src`.
- Shared models should be authored in `shared/src` and imported where needed.
- Keep components standalone and mobile-first.
- Prefer Signals-friendly patterns and avoid unnecessary RxJS state plumbing.
- Keep code comments to the minimum.
- Character coding should be UTF-8 in all files, supporting Hungarian characters.
- No need for explicit readonly keyword in Angular components, leave private fields as simply private.
- Always separate Angular component files into `.ts`, `.html`, and `.scss` — never use inline templates or styles.

## Shared Models

- `shared/src/ncore.models.ts` is the single source of truth for types shared between frontend and backend.
- `DOWNLOAD_CATEGORIES = ['Movies', 'TV Shows'] as const` — canonical list of download categories.
- `DownloadCategory` type is derived from `DOWNLOAD_CATEGORIES`.
- `DownloadRequest` contains `downloadUrl`, `savePath`, and `category`.
- Both frontend and backend import from `shared` — never duplicate these types.

## Backend Structure

```
backend/src/
  index.ts              # Express app entry point
  config.ts             # Environment configuration
  db/connection.ts      # PostgreSQL pool + schema init
  middleware/auth.ts     # Session authentication middleware
  routes/
    auth.routes.ts      # Passkey registration/login endpoints
    search.routes.ts    # nCore search + TMDB enrichment + download
    version.routes.ts   # App version endpoint (latest GitHub commit)
  services/
    auth.service.ts     # WebAuthn/Passkey logic
    github.service.ts   # GitHub API integration (latest commit info)
    ncore.service.ts    # nCore API: search, NFO, torrent file download
    tmdb.service.ts     # TMDB API + PostgreSQL caching
    qbittorrent.service.ts # qBittorrent Web API integration
  repositories/
    cache.repository.ts # Metadata cache database operations
    user.repository.ts  # User/credential/session database operations
  utils/
    coerce.ts           # Type coercion helpers
    concurrent.ts       # Concurrent promise mapper
    release-parser.ts   # Release name + TV info parsing
```

## Authentication

- Uses WebAuthn/Passkey via `@simplewebauthn/server`.
- `requireUserVerification: false` in both registration and authentication to support desktop password managers.
- Single-user app — no rate limiting or challenge expiry needed.

## Download Flow

1. Frontend calculates a suggested save path and lets the user edit it.
2. Frontend sends `{ downloadUrl, savePath, category }` to `POST /api/download`.
3. Backend validates `category` against `DOWNLOAD_CATEGORIES` from shared models.
4. `ncore.service.downloadTorrentFile(downloadUrl)` fetches the `.torrent` file using nCore cookies, with hostname validation against `config.ncore.baseUrl`.
5. `qbittorrent.service.addTorrent(torrentBuffer, savePath, category)` uploads the torrent to qBittorrent.
6. nCore cookies are built via a private `getCookieHeader()` helper in `ncore.service.ts`.

## Docker

- `docker-compose.yml` runs four services: `db` (PostgreSQL), `backend` (Express), `frontend` (Angular SSR), `pgadmin` (pgAdmin 4 database UI).
- Backend is on both `default` and `media` networks — `media` is an external Docker network shared with qBittorrent.
- Configuration via `.env` file at project root.
- `Dockerfile` uses multi-stage builds with separate targets for backend and frontend.
- For development, start only `db` and `pgadmin`: `docker compose up db pgadmin -d`.

## Environment Variables

| Variable               | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                          |
| `PORT`                 | Backend listen port (default: `3000`)                                 |
| `NCORE_BASE_URL`       | nCore base URL (default: `https://ncore.pro`)                         |
| `NCORE_USERNAME`       | nCore account username                                                |
| `NCORE_COOKIE_PASS`    | nCore cookie passkey                                                  |
| `TMDB_ACCESS_TOKEN`    | TMDB API read access token                                            |
| `GITHUB_REPO`          | GitHub repo for version check (default: `misomarcell/release-manager`) |
| `GITHUB_TOKEN`         | GitHub personal access token                                          |
| `RP_ID`                | WebAuthn relying party ID (default: `localhost`)                      |
| `RP_ORIGIN`            | Comma-separated allowed origins for WebAuthn                          |
| `QBITTORRENT_URL`      | qBittorrent Web UI URL (e.g. `http://qbittorrent:8080`)               |
| `QBITTORRENT_USERNAME` | qBittorrent username (default: `admin`)                               |
| `QBITTORRENT_PASSWORD` | qBittorrent password                                                  |
| `DOWNLOAD_PATH_MOVIES` | Save path for movies (default: `/media/Movies`)                       |
| `DOWNLOAD_PATH_TV`     | Save path for TV shows (default: `/media/TV_Shows`)                   |

## Validation Rules

- Mandatory local quality gates after code changes:
  1. `npm run lint`
  2. `npm run build`
  3. `npm run knip`
- `npm run validate` runs all checks and should pass before pushing.

## Pre-commit Hook

- Husky + lint-staged is configured for pre-commit checks.
- On commit, staged `*.ts` and `*.html` files run through `eslint --max-warnings=0`.

## Maintenance

- Keep this file synchronized with actual architecture and tooling.
- If scripts, linting, build, deploy, or workspace structure changes, update this file in the same change set.
