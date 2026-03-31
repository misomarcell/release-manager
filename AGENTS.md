# AGENTS

## Architecture

- Monorepo workspace with three folders:
  - `web/`: Angular SSR + Material app (App Hosting backend source)
  - `functions/`: Firebase HTTP API functions
  - `shared/`: shared TypeScript models used by both app and functions
- App Hosting serves only Angular SSR from `web/src/server.ts`.
- nCore API logic lives only in `functions/src/index.ts` (`ncoreSearch` HTTP function).

## Workflow

- Keep app code in `web/src` and function code in `functions/src`.
- Shared models should be authored in `shared/src` and imported where needed.
- Keep components standalone and mobile-first.
- Prefer Signals-friendly patterns and avoid unnecessary RxJS state plumbing.
- Keep code comments to the minimum.
- Character coding should be UTF-8 in all files, supporting Hungarian characters.
- No need for explicit readonly keyword in Angular components, leave private fields as simply private.

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
