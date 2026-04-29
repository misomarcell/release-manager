# AGENTS

## Architecture

- Monorepo workspace with three folders:
  - `web/`: Angular SSR + Material app (frontend)
  - `backend/`: Express API server with PostgreSQL
  - `shared/`: shared TypeScript models used by both app and backend
- Frontend serves Angular SSR and proxies `/api/*` requests to the backend.
- Backend handles nCore search, TMDB enrichment, caching, Passkey authentication, qBittorrent integration, and Jellyfin library sync.
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

- `shared/src/` contains shared TypeScript models and constants used by both frontend and backend.
- `shared/src/ncore.models.ts` — nCore-specific types: `NcoreCategoryKey`, `TvType`, `TvInfo`, `NcoreResult`, `NcoreSearchResponse`.
- `shared/src/tmdb.models.ts` — TMDB metadata types: `MetadataLookup`, `MovieMetadata` (includes `inJellyfinLibrary`), `MovieDetailMetadata`.
- `shared/src/download.models.ts` — Download types: `DownloadRequest`, `DownloadResponse`.
- `shared/src/user.models.ts` — User types: `UserInfo`.
- `shared/src/recommendations.models.ts` — Recommendation types: `Recommendation`, `FeedbackValue`, `RecommendationFeedbackRequest`.
- `shared/src/constants.ts` — Shared constants: `TMDB_GENRE_MAP`, `DOWNLOAD_CATEGORIES`, `DownloadCategory`.
- `shared/src/log.models.ts` — Logging types: `LogLevel`, `LogEntry`, `LogsResponse`.
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
    recommendations.routes.ts # AI-powered recommendations + feedback
    admin.routes.ts     # Admin actions incl. Jellyfin sync + qBittorrent test
  services/
    auth.service.ts     # WebAuthn/Passkey logic
    github.service.ts   # GitHub API integration (latest commit info)
    ncore.service.ts    # nCore API: search, NFO, torrent file download
    tmdb.service.ts     # TMDB API + PostgreSQL caching; enriches all results with inJellyfinLibrary
    qbittorrent.service.ts # qBittorrent Web API integration
    jellyfin.service.ts # Jellyfin API: library sync + connection test
    recommendations.service.ts # OpenAI + TMDB top-rated recommendations
  repositories/
    cache.repository.ts # Metadata cache database operations
    user.repository.ts  # User/credential/session database operations
    recommendations.repository.ts # Feedback and recommendation cache DB operations
    log.repository.ts           # Log query database operations
    jellyfin.repository.ts      # Jellyfin library DB operations + in-memory lookup cache
  utils/
    coerce.ts           # Type coercion helpers
    concurrent.ts       # Concurrent promise mapper
    release-parser.ts   # Release name + TV info parsing
    logger.ts           # Structured logger — writes to console + DB `logs` table
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

| Variable               | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                           |
| `PORT`                 | Backend listen port (default: `3000`)                                  |
| `NCORE_BASE_URL`       | nCore base URL (default: `https://ncore.pro`)                          |
| `NCORE_USERNAME`       | nCore account username                                                 |
| `NCORE_COOKIE_PASS`    | nCore cookie passkey                                                   |
| `TMDB_ACCESS_TOKEN`    | TMDB API read access token                                             |
| `GITHUB_REPO`          | GitHub repo for version check (default: `misomarcell/release-manager`) |
| `GITHUB_TOKEN`         | GitHub personal access token                                           |
| `RP_ID`                | WebAuthn relying party ID (default: `localhost`)                       |
| `RP_ORIGIN`            | Comma-separated allowed origins for WebAuthn                           |
| `QBITTORRENT_URL`      | qBittorrent Web UI URL (e.g. `http://qbittorrent:8080`)                |
| `QBITTORRENT_USERNAME` | qBittorrent username (default: `admin`)                                |
| `QBITTORRENT_PASSWORD` | qBittorrent password                                                   |
| `DOWNLOAD_PATH_MOVIES` | Save path for movies (default: `/media/Movies`)                        |
| `DOWNLOAD_PATH_TV`     | Save path for TV shows (default: `/media/TV_Shows`)                    |
| `OPENAI_API_KEY`       | OpenAI API key for AI-powered recommendations (optional)               |
| `JELLYFIN_URL`         | Jellyfin server URL (e.g. `http://jellyfin:8096`)                      |
| `JELLYFIN_API_KEY`     | Jellyfin admin API key                                                 |
| `JELLYFIN_CRON`        | Cron schedule for library sync (default: `0 6 * * *` — daily at 6 AM)  |

## Validation Rules

- Mandatory local quality gates after code changes:
  1. `npm run lint`
  2. `npm run build`
  3. `npm run knip`
- `npm run validate` runs all checks and should pass before pushing.
- Always run `npm run validate` at the end of every task to catch errors early.

## Pre-commit Hook

- Husky + lint-staged is configured for pre-commit checks.
- On commit, staged `*.ts` and `*.html` files run through `eslint --max-warnings=0`.

## Maintenance

- Keep this file synchronized with actual architecture and tooling.
- If scripts, linting, build, deploy, or workspace structure changes, update this file in the same change set.
