# AGENTS

## Architecture

- pnpm workspace monorepo (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, pnpm version pinned via `packageManager`) with three folders:
  - `web/`: Angular SSR + Material app (frontend)
  - `backend/`: Express API server with PostgreSQL
  - `shared/`: shared TypeScript models used by both app and backend
- Frontend serves Angular SSR and proxies `/api/*` requests to the backend.
- Backend handles nCore search, TMDB enrichment and title search, caching, Passkey authentication, qBittorrent integration, Jellyfin library sync, and the per-user release watchlist.
- PostgreSQL stores metadata cache, user credentials, sessions, and watchlist items with their known releases.

## Workflow

- Keep app code in `web/src` and API code in `backend/src`.
- Shared models should be authored in `shared/src` and imported where needed.
- Keep components standalone and mobile-first.
- Prefer Signals-friendly patterns and avoid unnecessary RxJS state plumbing.
- Keep code comments to the minimum.
- Character coding should be UTF-8 in all files, supporting Hungarian characters.
- No need for explicit readonly keyword in Angular components, leave private fields as simply private.
- Always separate Angular component files into `.ts`, `.html`, and `.scss` — never use inline templates or styles.
- List pages (Releases, Library, Watchlist, Discover) keep search, filters, `page` and the opened title (`open`) in URL query params: read them as inputs via `withComponentInputBinding()` and change them with `router.navigate` / `routerLink` so the browser back button steps through pages, filters and the title page.
- nCore is the only tracker today, but more are planned: UI copy says "trackers", and every release carries a `tracker` id (`shared/src/tracker.models.ts`).

## Frontend Design System

- `DESIGN.md` describes the visual system; `docs/redesign-brief.md` is the brief it was built from.
- Theme lives in `web/src/styles.scss`: `mat.theme` plus `mat.theme-overrides` with `light-dark()` values, following the device colour scheme. Components use `--mat-sys-*` roles (plus `--rm-positive`, `--rm-bar`, `--rm-mono`) and never hard-coded hexes.
- Fonts: Google Sans Flex (UI), Google Sans Code (`.mono`: release names, paths), Material Symbols Rounded (`mat-icon`, add `.filled` for the filled variant).
- Shared global classes in `styles.scss`: `.seg-list` + `.tile` (segmented groups), `.kv`, `.tag` (`.res`, `.hdr`), `.state` (`.own`, `.following`, `.new`), `.chip` (`.on`), `.list-head`, `.section-head`, `.seed`, `.leech`, `.fl`, `.pressable`, `.skeleton`, `.message`, `.hint`, `.phone-only`, `.desktop-only`.
- Shell (`components/shell`): bottom navigation on phones, navigation rail from 960px; admin pages and sign out are behind `app-account-menu`.
- Every list page is `app-list-detail` (list column + title page; a full-screen layer on phones, a side pane on desktop) filled with `app-title-row` rows and one `app-title-detail`. Page-specific content is projected into the detail; the single filled button goes into its `[primary]` slot.
- `app-filter-search` is the 56px search bar with visible filter chips; `app-page-title` is the title bar for pages without search.
- Dialogs that act on a title (download, watchlist, NFO) open with `sheetConfig()` from `utils/sheet.ts`: a bottom sheet on phones, a centred dialog otherwise.
- Route changes run through `withViewTransitions`; `utils/view-transitions.ts` skips the transition when only filters or the page change.

## Shared Models

- `shared/src/` contains shared TypeScript models and constants used by both frontend and backend.
- `shared/src/ncore.models.ts` — nCore-specific types: `NcoreCategoryKey`, `TvType`, `TvInfo`, `NcoreResult` (includes `tracker`), `NcoreSearchResponse`.
- `shared/src/tracker.models.ts` — `TRACKERS`, `TrackerId`, `trackerName()`.
- `shared/src/release-tags.ts` — `parseReleaseTags()`: resolution, HDR, source and audio tags parsed from a release name.
- `shared/src/tmdb.models.ts` — TMDB metadata types: `MetadataLookup`, `MovieMetadata` (includes `inJellyfinLibrary`), `TitleSummary`, `TitleSearchResponse`.
- `shared/src/download.models.ts` — Download types: `DownloadRequest`, `DownloadResponse`.
- `shared/src/user.models.ts` — User types: `UserInfo`.
- `shared/src/recommendations.models.ts` — Recommendation types: `Recommendation`, `FeedbackValue`, `RecommendationFeedbackRequest`.
- `shared/src/constants.ts` — Shared constants: `TMDB_GENRE_MAP`, `DOWNLOAD_CATEGORIES`, `DownloadCategory`.
- `shared/src/jellyfin.models.ts` — Jellyfin library types: `MediaStream`, `MediaInfo`, `SeasonInfo`, `LibraryItem` (includes per-season episode counts for TV), `LibraryResponse`.
- `shared/src/watchlist.models.ts` — Watchlist types: `WatchlistItem`, `WatchlistRelease`, `WatchlistAddRequest`, `WatchlistUpdateRequest`, `WatchlistResponse`, keyword limits.
- `shared/src/log.models.ts` — Logging types: `LogLevel`, `LogEntry`, `LogsResponse`.
- Both frontend and backend import from `shared` — never duplicate these types.

- `shared/src/sync.models.ts` — Shared sync status types: `SyncService`, `SyncStatus`.

## Backend Structure

```
backend/src/
  index.ts              # Express app entry point
  config.ts             # Environment configuration
  db/connection.ts      # PostgreSQL pool + schema init
  middleware/auth.ts     # Session authentication middleware
  routes/
    auth.routes.ts      # Passkey registration/login endpoints
    search.routes.ts    # nCore search + TMDB enrichment, title metadata, TMDB title search, download
    version.routes.ts   # App version endpoint (latest GitHub commit)
    recommendations.routes.ts # AI-powered recommendations + feedback
    admin.routes.ts     # Admin actions incl. Jellyfin sync + qBittorrent test
    watchlist.routes.ts # Per-user watchlist CRUD, mark as read, manual check
  services/
    auth.service.ts     # WebAuthn/Passkey logic
    github.service.ts   # GitHub API integration (latest commit info)
    ncore.service.ts    # nCore API: search (by name or IMDb id), NFO, torrent file download
    watchlist.service.ts # Watchlist release check: nCore lookup, keyword filter, new release detection
    tmdb.service.ts     # TMDB API + PostgreSQL caching; enriches all results with inJellyfinLibrary
    qbittorrent.service.ts # qBittorrent Web API integration
    jellyfin.service.ts # Jellyfin API: library sync (incl. per-season episode counts) + connection test
    recommendations.service.ts # AI personalized recs (filtered by TMDB id) + TMDB top-rated/trending
    openai.service.ts   # OpenAI Responses API client (gpt-6-luna, structured output)
    recommendation-prompt.ts # Builds instructions + compact taste profile input
  repositories/
    cache.repository.ts # Metadata cache database operations
    user.repository.ts  # User/credential/session database operations
    recommendations.repository.ts # Feedback and recommendation cache DB operations
    log.repository.ts           # Log query database operations
    watchlist.repository.ts     # Watchlist items + known/unseen release DB operations
    jellyfin.repository.ts      # Jellyfin library DB operations + in-memory lookup cache + owned titles for recs
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

## Watchlist

- Any title with TMDB metadata can be followed from its title page or from a Discover search row (`WatchlistSheetService` → `app-watchlist-dialog`); items are stored per user in `watchlist_items`.
- Discover's "Search all titles" (`GET /api/search/titles`, TMDB) lets a title be followed before any release exists.
- `watchlist_releases` keeps every known nCore torrent id per item. The first successful check is the baseline (all `seen`); later checks insert unknown torrent ids as unseen.
- Releases are looked up through the nCore JSON search by IMDb id (`miben=imdb`, newest first), falling back to a title search filtered by parsed title/year when no IMDb id is known.
- Optional per-item keywords (`mat-chip-grid` in the dialog): a new release only counts when its name contains at least one keyword (case-insensitive). Non-matching releases are stored as already seen.
- The unseen count is shown in amber on the Watchlist nav item, the watchlist row and the title page status; "Mark as read" resets it for an item.
- Checks run on `WATCHLIST_CRON` and on demand via "Check now" (`POST /api/watchlist/check`).

## Docker

- `docker-compose.yml` runs four services: `db` (PostgreSQL), `backend` (Express), `frontend` (Angular SSR), `pgadmin` (pgAdmin 4 database UI).
- Backend is on both `default` and `media` networks — `media` is an external Docker network shared with qBittorrent.
- Configuration via `.env` file at project root.
- `Dockerfile` uses multi-stage builds with separate targets for backend and frontend. pnpm is only used in build stages; the backend runtime gets a `--prod` install filtered to `backend...`, the frontend runtime only ships the self-contained Angular SSR bundle.
- New native dependencies with install scripts must be allowed under `allowBuilds` in `pnpm-workspace.yaml`.
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
| `QBITTORRENT_CRON`     | Cron schedule for torrent sync (default: `0 6 * * *` — daily at 6 AM)  |
| `DOWNLOAD_PATH_MOVIES` | Save path for movies (default: `/media/Movies`)                        |
| `DOWNLOAD_PATH_TV`     | Save path for TV shows (default: `/media/TV_Shows`)                    |
| `OPENAI_API_KEY`       | OpenAI API key for AI-powered recommendations (optional)               |
| `JELLYFIN_URL`         | Jellyfin server URL (e.g. `http://jellyfin:8096`)                      |
| `JELLYFIN_API_KEY`     | Jellyfin admin API key                                                 |
| `JELLYFIN_USER_ID`     | Jellyfin user ID to scope library sync to (optional)                   |
| `JELLYFIN_CRON`        | Cron schedule for library sync (default: `0 6 * * *` — daily at 6 AM)  |
| `WATCHLIST_CRON`       | Cron schedule for watchlist check (default: `0 9 * * *` — daily at 9 AM) |

## Validation Rules

- Mandatory local quality gates after code changes:
  1. `pnpm lint`
  2. `pnpm build`
  3. `pnpm knip`
- `pnpm validate` runs all checks and should pass before pushing.
- Always run `pnpm validate` at the end of every task to catch errors early.

## Pre-commit Hook

- Husky + lint-staged is configured for pre-commit checks.
- On commit, staged `*.ts` and `*.html` files run through `eslint --max-warnings=0`.

## Maintenance

- Keep this file synchronized with actual architecture and tooling.
- If scripts, linting, build, deploy, or workspace structure changes, update this file in the same change set.
