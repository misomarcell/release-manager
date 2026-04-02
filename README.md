# MovieReleases

A self-hosted web app for browsing and searching Hungarian nCore torrents, enriched with movie metadata from TMDB.

## Features

- **nCore integration**: Search torrents by category or keyword, sorted by seeders
- **TMDB enrichment**: Movie posters, ratings, genres, plots via TMDB API
- **PostgreSQL caching**: TMDB data cached for 1 week to reduce API calls
- **Passkey authentication**: WebAuthn/FIDO2 login — no passwords
- **Dark theme**: Angular Material 3 dark mode
- **Pagination**: 15 results per page
- **Docker**: One-command deployment with `docker compose up`

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | Angular 21, Material 3, SSR       |
| Backend  | Express 5, TypeScript, Node.js 22 |
| Database | PostgreSQL 17                     |
| Auth     | WebAuthn (SimpleWebAuthn)         |
| Deploy   | Docker Compose                    |

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your nCore credentials and TMDB access token

# 2. Start everything
docker compose up -d

# 3. Open http://localhost:4000
```

## Updating (after git pull)

```bash
docker compose build --no-cache backend frontend && docker compose up -d
```

## Development Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL and pgAdmin (database UI)
docker compose up db pgadmin -d

# Start backend (port 3000)
npm run start:backend

# Start frontend (port 4200, proxies /api to backend)
npm start
```

### pgAdmin (Database UI)

pgAdmin is included for managing PostgreSQL during development.

- **URL:** http://localhost:5050
- **Email:** `admin@local.dev`
- **Password:** `admin`

To connect to the database, register a new server in pgAdmin:

| Field                | Value      |
| -------------------- | ---------- |
| Host                 | `db`       |
| Port                 | `5432`     |
| Maintenance database | `movieapp` |
| Username             | `movieapp` |
| Password             | `movieapp` |

## Environment Variables

| Variable            | Description                  | Default                                         |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| `NCORE_BASE_URL`    | nCore base URL               | `https://ncore.pro`                             |
| `NCORE_USERNAME`    | nCore cookie username        | —                                               |
| `NCORE_COOKIE_PASS` | nCore cookie password        | —                                               |
| `TMDB_ACCESS_TOKEN` | TMDB API read access token   | —                                               |
| `DATABASE_URL`      | PostgreSQL connection string | `postgres://movieapp:movieapp@db:5432/movieapp` |
| `SESSION_SECRET`    | Session signing secret       | `change-me-to-a-random-string`                  |
| `RP_ID`             | WebAuthn Relying Party ID    | `localhost`                                     |
| `RP_ORIGIN`         | WebAuthn origin URL          | `http://localhost:4000`                         |

## Authentication

1. Register a passkey at the login page
2. Activate your account — either via pgAdmin or the command line:
   ```bash
   docker compose exec db psql -U movieapp -c "UPDATE users SET valid = true WHERE username = 'you';"
   ```
3. Log in with your passkey

## Project Structure

```
├── backend/          # Express API server
│   └── src/
│       ├── routes/   # API endpoints
│       ├── services/ # Business logic
│       ├── repositories/  # Database access
│       ├── middleware/     # Auth middleware
│       ├── utils/    # Helpers
│       └── db/       # PostgreSQL connection
├── web/              # Angular frontend (SSR)
│   └── src/app/
│       ├── components/    # Login, Search, MovieCard
│       ├── services/      # API & Auth services
│       └── guards/        # Route guards
├── shared/           # Shared TypeScript models
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Validation

```bash
npm run validate   # Runs lint + build + knip
```

## CI/CD

GitHub Actions runs validation on every push to `main` and on pull requests. Deploy to your server by pulling and running `docker compose up -d --build`.
