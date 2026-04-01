# AGENTS

## Architecture

- Monorepo workspace with three folders:
  - `web/`: Angular SSR + Material app (frontend)
  - `backend/`: Express API server with PostgreSQL
  - `shared/`: shared TypeScript models used by both app and backend
- Frontend serves Angular SSR and proxies `/api/*` requests to the backend.
- Backend handles nCore search, OMDB enrichment, caching, and Passkey authentication.
- PostgreSQL stores OMDB cache, user credentials, and sessions.

## Workflow

- Keep app code in `web/src` and API code in `backend/src`.
- Shared models should be authored in `shared/src` and imported where needed.
- Keep components standalone and mobile-first.
- Prefer Signals-friendly patterns and avoid unnecessary RxJS state plumbing.
- Keep code comments to the minimum.
- Character coding should be UTF-8 in all files, supporting Hungarian characters.
- No need for explicit readonly keyword in Angular components, leave private fields as simply private.
- Always separate Angular component files into `.ts`, `.html`, and `.scss` — never use inline templates or styles.

## Backend Structure

```
backend/src/
  index.ts              # Express app entry point
  config.ts             # Environment configuration
  db/connection.ts      # PostgreSQL pool + schema init
  middleware/auth.ts     # Session authentication middleware
  routes/
    auth.routes.ts      # Passkey registration/login endpoints
    search.routes.ts    # nCore search + OMDB enrichment
  services/
    auth.service.ts     # WebAuthn/Passkey logic
    ncore.service.ts    # nCore API integration
    omdb.service.ts     # OMDB API + PostgreSQL caching
  repositories/
    cache.repository.ts # OMDB cache database operations
    user.repository.ts  # User/credential/session database operations
  utils/
    coerce.ts           # Type coercion helpers
    concurrent.ts       # Concurrent promise mapper
    release-parser.ts   # Release name parsing
```

## Docker

- `docker-compose.yml` runs four services: `db` (PostgreSQL), `backend` (Express), `frontend` (Angular SSR), `pgadmin` (pgAdmin 4 database UI).
- Configuration via `.env` file at project root.
- `Dockerfile` uses multi-stage builds with separate targets for backend and frontend.
- For development, start only `db` and `pgadmin`: `docker compose up db pgadmin -d`.

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
