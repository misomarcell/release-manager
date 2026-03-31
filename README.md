# movie-releases

Monorepo workspace for an Angular SSR app on Firebase App Hosting with Firebase Functions API.

## Structure

- `web/` Angular app (SSR + Material + PWA)
- `functions/` Firebase HTTP functions (`ncoreSearch`)
- `shared/` shared TypeScript models

## Install

```bash
npm ci
```

## Run Locally

1. Start functions emulator:
```bash
firebase emulators:start --only functions
```

2. In another terminal start web app:
```bash
npm run start --workspace web
```

The web app calls the local functions emulator at `http://127.0.0.1:5001/<project-id>/us-central1/ncoreSearch` when running on localhost.

## Env / Secrets

- Local emulator values: create `functions/.env` from `functions/.env.example`
- Production: set Firebase Function secrets/env values for:
  - `NCORE_COOKIE`
  - optional `NCORE_BASE_URL`

## Validation

```bash
npm run lint
npm run build
npm run knip
npm run validate
```

## Deploy

```bash
npm run deploy
```

Deploy uses:
- Firebase Functions from `functions/`
- App Hosting backend source from `web/`

## CI/CD

GitHub Actions workflow: `.github/workflows/deploy.yml`
- triggers on pushes to `main`
- runs `npm ci`, `npm run validate`, then Firebase deploy
- requires repository secret: `FIREBASE_TOKEN`
