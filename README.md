# movie-releases

Angular 21 standalone application with Angular Material (M3), SSR, and PWA/service worker support.

## Setup

```bash
npm ci
```

Copy `.env.example` to `.env` and set credentials.
Use `NCORE_COOKIE` with the full cookie header value from your browser.

Optional:
- `NCORE_BASE_URL` (defaults to `https://ncore.pro`)

## Run

```bash
npm run start
```

Open `http://localhost:4200`, type a query in the search field, and submit.
The app calls `/api/ncore/search`, shows parsed results, and prints full returned JSON formatted in the page.

## Build

```bash
npm run build
```

## Lint

```bash
npm run lint
```

## Validate

```bash
npm run validate
```

`validate` runs:
- `npm run lint`
- `npm run build`

## Collect

No dedicated `collect` script is defined in this repository. If you add one later, document its inputs/outputs here.

## Deploy

Current deploy target is static build output from `dist/movie-releases/browser` (and SSR server output under `dist/movie-releases/server`).

Typical flow:
1. Run `npm run validate`.
2. Build with `npm run build`.
3. Publish artifacts from `dist/` using your chosen CI/CD pipeline (for example GitHub Actions to GitHub Pages or another host).

## Git Hooks

Pre-commit hook uses Husky + lint-staged and lints staged `*.ts` and `*.html` files.
