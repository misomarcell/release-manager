# AGENTS

## Architecture

- pnpm workspace monorepo (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, pnpm version pinned via `packageManager`) with three folders:
  - `web/`: Angular SSR + Material app (frontend)
  - `backend/`: Express API server with PostgreSQL
  - `shared/`: shared TypeScript models used by both app and backend
- Frontend serves Angular SSR and proxies `/api/*` requests to the backend.
- Backend handles tracker search (nCore and The Pirate Bay, as plugins behind one tracker service), TMDB enrichment and title search, caching, Passkey authentication, qBittorrent integration, Jellyfin library sync, and the per-user release watchlist.
- PostgreSQL stores metadata cache, user credentials, sessions, watchlist items with their known releases, and the settings saved from the UI.

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
- Trackers are plugins (see "Trackers" below): UI copy says "trackers", every release carries a `tracker` id, and nothing outside a tracker's own service may depend on that tracker.

## Frontend Design System

- `DESIGN.md` describes the visual system; `docs/redesign-brief.md` is the brief it was built from.
- Theme lives in `web/src/styles.scss`: `mat.theme` plus `mat.theme-overrides` with `light-dark()` values, following the device colour scheme. Components use `--mat-sys-*` roles (plus `--rm-positive`, `--rm-bar`, `--rm-mono`) and never hard-coded hexes.
- Fonts: Google Sans Flex (UI), Google Sans Code (`.mono`: release names, paths), Material Symbols Rounded (`mat-icon`, add `.filled` for the filled variant).
- Shared global classes in `styles.scss`: `.seg-list` + `.tile` (segmented groups), `.kv`, `.tag` (`.res`, `.hdr`), `.state` (`.own`, `.following`, `.new`), `.chip` (`.on`), `.list-head`, `.section-head`, `.seed`, `.leech`, `.fl`, `.pressable`, `.skeleton`, `.message`, `.hint`, `.phone-only`, `.desktop-only`.
- Shell (`components/shell`): bottom navigation on phones, navigation rail from 960px; admin pages (Manage Users, Settings, Administration, Logs) and sign out are behind `app-account-menu`.
- Settings (`components/settings`) is read-only `.seg-list` groups; editing happens in sheets: `app-settings-dialog` for a service's fields, `app-schedule-dialog` for a schedule.
- On phones the document itself scrolls (sticky bottom navigation, no inner scroll containers besides the open title page) so mobile browsers can collapse their toolbars; from 960px the shell is a fixed `100dvh` frame and the list and detail panes scroll on their own.
- Zoom is locked on purpose: `touch-action: pan-x pan-y` on `html` (no pinch or double-tap zoom) and `maximum-scale=1` in the viewport meta; keep text inputs at 16px or more so iOS does not zoom on focus.
- Every list page is `app-list-detail` (list column + title page; a full-screen layer on phones, a side pane on desktop) filled with `app-title-row` rows and one `app-title-detail`. Page-specific content is projected into the detail; the single filled button goes into its `[primary]` slot.
- `app-filter-search` is the 56px search bar with visible filter chips; `app-page-title` is the title bar for pages without search.
- `app-failure-notice` is the generic notice for a service or API call that failed without breaking the page: give it `FailureNotice[]` (`utils/failure-notice.ts`, heading + detail) and it offers "Reload", which reloads the page. There is no per-call retry logic; map a new kind of failure to `FailureNotice` next to `trackerFailureNotices()`.
- Dialogs that act on a title (download, watchlist, NFO) and the settings editors open with `sheetConfig()` from `utils/sheet.ts`: a bottom sheet on phones, a centred dialog otherwise.
- Route changes run through `withViewTransitions`; `utils/view-transitions.ts` skips the transition when only filters or the page change.

## Shared Models

- `shared/src/` contains shared TypeScript models and constants used by both frontend and backend.
- `shared/src/tracker.models.ts` — `TRACKERS` (id, name, `nfo` capability), `TrackerId`, `trackerName()`, `trackerHasNfo()`, `ReleaseCategory`, `TvInfo`, `TrackerRelease`, `TitleReleases` (releases grouped under one title), `TrackerFailure`, `ReleaseSearchResponse`, `TitleReleasesResponse`.
- `shared/src/release-tags.ts` — `parseReleaseTags()`: resolution, HDR, source and audio tags parsed from a release name; `summarizeReleaseTags()`: the tags a set of releases carries.
- `shared/src/tmdb.models.ts` — TMDB metadata types: `MetadataLookup`, `MovieMetadata` (includes `inJellyfinLibrary`), `TitleSummary`, `TitleSearchResponse`.
- `shared/src/download.models.ts` — Download types: `DownloadRequest` (`tracker` + `downloadRef`), `DownloadResponse`, `DownloadPaths`.
- `shared/src/settings.models.ts` — `SETTINGS_GROUPS` (the fields the Settings page offers, per service), `SCHEDULED_JOBS`, `SettingKey`, `SettingsResponse`, `SettingsUpdateRequest`.
- `shared/src/schedule.ts` — `Schedule` (days + time, every N hours, or a custom cron) with `cronToSchedule()`, `scheduleToCron()`, `describeSchedule()`.
- `shared/src/user.models.ts` — User types: `UserInfo`.
- `shared/src/recommendations.models.ts` — Recommendation types: `Recommendation`, `FeedbackValue`, `RecommendationFeedbackRequest`.
- `shared/src/constants.ts` — Shared constants: `TMDB_GENRE_MAP`, `DOWNLOAD_CATEGORIES`, `DownloadCategory`.
- `shared/src/jellyfin.models.ts` — Jellyfin library types: `MediaStream`, `MediaInfo`, `SeasonInfo`, `LibraryItem` (includes per-season episode counts for TV), `LibraryResponse`.
- `shared/src/watchlist.models.ts` — Watchlist types: `WatchlistItem`, `WatchlistRelease`, `WatchlistAddRequest`, `WatchlistUpdateRequest`, `WatchlistResponse`, `WatchlistCheckResponse` (items + tracker failures), keyword limits.
- `shared/src/log.models.ts` — Logging types: `LogLevel`, `LogEntry`, `LogsResponse`.
- Both frontend and backend import from `shared` — never duplicate these types.

- `shared/src/sync.models.ts` — Shared sync status types: `SyncService`, `SyncStatus`.

## Backend Structure

```
backend/src/
  index.ts              # Express app entry point
  config.ts             # Environment configuration
  db/connection.ts      # PostgreSQL pool + schema init
  db/schema.ts          # Schema SQL run on startup
  middleware/auth.ts     # Session authentication middleware
  routes/
    auth.routes.ts      # Passkey registration/login endpoints
    search.routes.ts    # Release search, per-title release lookup, title metadata, TMDB title search, NFO, download, download paths
    version.routes.ts   # App version endpoint (latest GitHub commit)
    recommendations.routes.ts # AI-powered recommendations + feedback
    admin.routes.ts     # Admin actions incl. Jellyfin sync + qBittorrent test
    settings.routes.ts  # Read and save the UI-editable settings (admin only)
    watchlist.routes.ts # Per-user watchlist CRUD, mark as read, manual check
  services/
    auth.service.ts     # WebAuthn/Passkey logic
    settings.service.ts # UI-editable settings: validation, storage, applying them to `config` at runtime
    scheduler.service.ts # Cron jobs (Jellyfin sync, qBittorrent sync, watchlist check), re-applied on config changes
    github.service.ts   # GitHub API integration (latest commit info)
    tracker-provider.ts # Tracker plugin contract: `TrackerProvider`, query types, `TorrentSource`
    tracker.service.ts  # Tracker registry + everything cross-tracker: combined search, title grouping, failures
    ncore.service.ts    # nCore plugin: search, top list, title lookup, NFO, torrent file download
    apibay.service.ts   # The Pirate Bay plugin (apibay.org): search, title lookup, magnet links, throttling
    watchlist.service.ts # Watchlist release check: title lookup on every tracker, keyword filter, new release detection
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
    settings.repository.ts      # Saved settings (`settings` table)
    watchlist.repository.ts     # Watchlist items, known/unseen releases and baselines per tracker
    jellyfin.repository.ts      # Jellyfin library DB operations + in-memory lookup cache + owned titles for recs
  utils/
    coerce.ts           # Type coercion helpers
    concurrent.ts       # Concurrent promise mapper
    release-parser.ts   # Release name + TV info parsing, metadata lookup building, title matching
    logger.ts           # Structured logger — writes to console + DB `logs` table
    secret-box.ts       # AES-256-GCM encryption for secrets saved from the UI
```

## Authentication

- Uses WebAuthn/Passkey via `@simplewebauthn/server`.
- `requireUserVerification: false` in both registration and authentication to support desktop password managers.
- Single-user app — no rate limiting or challenge expiry needed.

## Settings

- `config` (`config.ts`) is built from the environment and is the single place services read configuration from. Read it at call time (`config.x.y` inside the function), never copy a value into a module-level constant, so a change from the UI applies without a restart.
- The Settings page edits the keys listed in `SETTINGS_GROUPS` and `SCHEDULED_JOBS` (`shared/src/settings.models.ts`). A key is a `section.field` path into `config`; to make another option editable, add it there.
- Saved values live in the `settings` table and override the environment. `loadSettings()` applies them on startup; `updateSettings()` validates everything, stores it, mutates `config` and calls `applySchedules()`. Resetting a key deletes its row and restores the environment value.
- `scheduler.service.ts` owns every cron task. `applySchedules()` is idempotent: it compares each job's wanted schedule with the running one and restarts only what changed, and starts or stops a job when its service becomes configured or unconfigured.
- Schedules are stored as cron expressions; the UI edits them as a `Schedule` and shows cron text only for expressions it cannot represent. Times are in the server's time zone.
- Secrets are write-only: the API reports only whether one is set, they are stored encrypted with `SETTINGS_ENCRYPTION_KEY` (without that variable they cannot be saved from the UI), and they are never logged. Every change is logged with the key names and the admin's username.
- `DATABASE_URL`, `PORT`, `RP_ID`, `RP_ORIGIN` and `SETTINGS_ENCRYPTION_KEY` are environment-only on purpose.

## Trackers

- `app -> tracker.service -> ncore.service | apibay.service | ...`. Routes and other services only talk to `trackerService`; they never import a tracker's own service.
- A tracker is one service implementing `TrackerProvider` (`services/tracker-provider.ts`): `search`, `browseTop`, `findTitle` and `getTorrent` are required, `fetchNfo` is optional. A tracker without a top list returns an empty page from `browseTop`.
- `REGISTRY` in `tracker.service.ts` is `{ primaryTracker, secondaryTrackers }`. The primary tracker (nCore) supplies the Releases top list and its releases are listed first; secondary trackers are only asked for text searches, title lookups and watchlist checks.
- To add, remove or swap a tracker: add or delete its service file, its place in `REGISTRY` and its entry in `TRACKERS` (`shared/src/tracker.models.ts`, including the `nfo` flag the UI reads). `TRACKERS` is in display order and must list the primary tracker first.
- A tracker service holds only that tracker's business logic (URLs, auth, categories, result mapping, rate limits). Anything that spans trackers (picking trackers, merging, ordering, TMDB enrichment, grouping releases into titles, failure collection) lives in `tracker.service.ts`.
- Ordering is shared code: `sortReleases()` (tracker order, then most seeders or largest size; the Releases page keeps the choice in the `sort` query param) and `sortTitles()` (titles the primary tracker has first, then most seeded) in `shared/src/tracker.models.ts`.
- A search with text asks every selected tracker and merges the results; releases are grouped into titles by TMDB id, so titles that exist on only one tracker still get a row.
- A list only holds the releases of its own page, so opening a title on the Releases page calls `GET /api/search/releases` (`findTitle` on every selected tracker) and shows the full release list, grouped per tracker, with a short status line while it loads. Title rows therefore show no release or seeder counts, only the quality tags found on the page (`releaseQualities()`). `findTitle` goes by IMDb id; without one nCore falls back to a name search narrowed to the same parsed title and year, while The Pirate Bay returns nothing.
- A failing tracker never fails the request: whatever a plugin throws becomes an entry in the response's `failures` (tracker + message), which `trackerFailureNotices()` turns into notices for `app-failure-notice`.
- Plugins return results in any order; `tracker.service.ts` does all sorting.
- The Pirate Bay torrents with 0 seeders are dropped.
- The Pirate Bay only contributes releases that carry an IMDb id: its text search drops uploads without one and its title lookup is strictly by id, so its results can always be tied to a title.
- apibay has no paging (one page, at most 100 results), no top list, no NFO and no `.torrent` files, and it rate limits quickly. `apibay.service.ts` therefore runs requests one at a time with a pause, caches results for 10 minutes and, after a 429, fails fast until the cooldown has passed.
- `TrackerRelease.downloadRef` is an opaque value only its tracker understands (nCore: the download URL, The Pirate Bay: the info hash).

## Download Flow

1. Frontend calculates a suggested save path from `GET /api/search/download-paths` (the configured movie and TV folders) and lets the user edit it.
2. Frontend sends `{ tracker, downloadRef, savePath, category }` to `POST /api/search/download`.
3. Backend validates `tracker` against `TRACKERS` and `category` against `DOWNLOAD_CATEGORIES` from shared models.
4. `trackerService.getTorrent(tracker, downloadRef)` returns a `TorrentSource`: nCore fetches the `.torrent` file using its cookies (with hostname validation against `config.ncore.baseUrl`), The Pirate Bay builds a magnet link from the info hash.
5. `qbittorrent.service` uploads it with `addTorrent(torrentBuffer, savePath, category)` or `addMagnet(magnetUri, savePath, category)`.
6. nCore cookies are built via a private `getCookieHeader()` helper in `ncore.service.ts`.

## Watchlist

- Any title with TMDB metadata can be followed from its title page or from a Discover search row (`WatchlistSheetService` → `app-watchlist-dialog`); items are stored per user in `watchlist_items`.
- Discover's "Search all titles" (`GET /api/search/titles`, TMDB) lets a title be followed before any release exists.
- `watchlist_releases` keeps every known torrent id per item and tracker. `watchlist_tracker_checks` records which trackers have been checked for an item: a tracker's first successful check is its baseline (all `seen`), later checks insert unknown torrent ids as unseen. A tracker that fails a check is simply baselined on its next successful one.
- Releases are looked up on every tracker through `trackerService.findTitle()`: by IMDb id, with nCore falling back to a title search filtered by parsed title/year when no IMDb id is known.
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

| Variable                  | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`            | PostgreSQL connection string                                             |
| `PORT`                    | Backend listen port (default: `3000`)                                    |
| `SETTINGS_ENCRYPTION_KEY` | Key that encrypts secrets saved on the Settings page (optional)          |
| `NCORE_BASE_URL`          | nCore base URL (default: `https://ncore.pro`)                            |
| `NCORE_USERNAME`          | nCore account username                                                   |
| `NCORE_COOKIE_PASS`       | nCore cookie passkey                                                     |
| `APIBAY_BASE_URL`         | The Pirate Bay API base URL (default: `https://apibay.org`)              |
| `TMDB_ACCESS_TOKEN`       | TMDB API read access token                                               |
| `GITHUB_REPO`             | GitHub repo for version check (default: `misomarcell/release-manager`)   |
| `GITHUB_TOKEN`            | GitHub personal access token                                             |
| `RP_ID`                   | WebAuthn relying party ID (default: `localhost`)                         |
| `RP_ORIGIN`               | Comma-separated allowed origins for WebAuthn                             |
| `QBITTORRENT_URL`         | qBittorrent Web UI URL (e.g. `http://qbittorrent:8080`)                  |
| `QBITTORRENT_USERNAME`    | qBittorrent username (default: `admin`)                                  |
| `QBITTORRENT_PASSWORD`    | qBittorrent password                                                     |
| `QBITTORRENT_CRON`        | Cron schedule for torrent sync (default: `0 6 * * *` — daily at 6 AM)    |
| `DOWNLOAD_PATH_MOVIES`    | Save path for movies (default: `/media/Movies`)                          |
| `DOWNLOAD_PATH_TV`        | Save path for TV shows (default: `/media/TV_Shows`)                      |
| `OPENAI_API_KEY`          | OpenAI API key for AI-powered recommendations (optional)                 |
| `JELLYFIN_URL`            | Jellyfin server URL (e.g. `http://jellyfin:8096`)                        |
| `JELLYFIN_API_KEY`        | Jellyfin admin API key                                                   |
| `JELLYFIN_USER_ID`        | Jellyfin user ID to scope library sync to (optional)                     |
| `JELLYFIN_CRON`           | Cron schedule for library sync (default: `0 6 * * *` — daily at 6 AM)    |
| `WATCHLIST_CRON`          | Cron schedule for watchlist check (default: `0 9 * * *` — daily at 9 AM) |

Every variable from `NCORE_BASE_URL` down is only the starting value: it can be overridden on the Settings page.

## Validation Rules

- Mandatory local quality gates after code changes:
  1. `pnpm format:check`
  2. `pnpm lint`
  3. `pnpm build`
  4. `pnpm knip`
- `pnpm validate` runs all checks and should pass before pushing.
- Always run `pnpm validate` at the end of every task to catch errors early.

## CI

- `.github/workflows/checks.yml` runs on every pull request to `master` and on pushes to `master`, as four parallel jobs: 🎨 Formatting (`pnpm format:check`), 🧹 Lint (`pnpm lint`), 🏗️ Build (`pnpm build`) and 🧟 Dead code (`pnpm knip`, after building `shared`).
- Together they cover the same ground as `pnpm validate`; when a gate is added to `validate`, add a matching job here.

## Formatting

- Prettier is the only formatter; its version is pinned in the root `package.json` and configured in `.prettierrc` (120 columns, single quotes, 4 spaces, 2 spaces for JSON/YAML/Markdown, LF line endings). `.prettierignore` lists what it skips.
- Run `pnpm format` after editing files so the working tree matches what the editor's format-on-save produces. `pnpm format:check` is part of `pnpm validate`.
- ESLint carries no formatting rules, so `eslint --fix` and Prettier never disagree. Keep it that way: do not add stylistic ESLint rules that overlap with Prettier.
- `.gitattributes` keeps every text file on LF.

## Maintainability Lint Rules

`eslint.config.js` enforces these as errors for all TypeScript in `web`, `backend` and `shared`:

| Rule                     | Limit                                            |
| ------------------------ | ------------------------------------------------ |
| `complexity`             | 10 per function (`??`, `\|\|`, `&&`, `?.` count) |
| `max-lines-per-function` | 50 (blank lines and comments excluded)           |
| `max-params`             | 4                                                |
| `max-depth`              | 3                                                |
| `max-nested-callbacks`   | 3                                                |
| `max-lines`              | 300 per file (blank lines and comments excluded) |
| `no-nested-ternary`      | —                                                |
| `no-else-return`         | —                                                |

Angular templates: `@angular-eslint/template/cyclomatic-complexity` 12 (counted over the whole template) and `@angular-eslint/template/conditional-complexity` 5 (per expression).

- Write code to fit the limits from the start; do not raise a threshold or add `eslint-disable` to get a change through.
- A fix must make the code simpler to read, not just move the count around. Prefer, in this order: a lookup table instead of an `if`/`else if` chain, an options object instead of a long parameter list, a named helper for one self-contained step, data-driven `@for` rendering instead of repeated template blocks.
- Do not split a function into fragments that only make sense together, and do not add a component, service or abstraction solely to satisfy a rule.
- Long static data (SQL schema, prompts, tables) belongs in a module-level constant or its own file, not inside a function body.

## Pre-commit Hook

- Husky + lint-staged is configured for pre-commit checks.
- On commit, staged `*.ts` and `*.html` files run through `eslint --max-warnings=0`, then every staged file Prettier understands is formatted with `prettier --write`.

## Maintenance

- Keep this file synchronized with actual architecture and tooling.
- If scripts, linting, build, deploy, or workspace structure changes, update this file in the same change set.
