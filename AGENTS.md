# AGENTS

## Architecture

- Angular 21 standalone application with routing, SSR, and PWA service worker support.
- Angular Material 3 is configured in `src/styles.scss` and should use `--mat-sys-*` token-based styling.
- SCSS is the global styling language.
- ESLint uses flat config via `@eslint/js`, `typescript-eslint`, and `angular-eslint`.

## Workflow

- Keep components standalone and mobile-first.
- Prefer Signals-friendly patterns and avoid unnecessary RxJS state plumbing.
- Keep list and layout implementations virtual-scroll-friendly for performance-sensitive views.
- New code should follow existing lint and formatting conventions.
- Keep code comments to the minimum.
- Character coding should be UTF-8 in all files, supporting Hungarian cahracters, like óüöúőűáéí
- No need for explicit readonly keyword in Angular components, leave private fields as simply private

## Validation Rules

- Mandatory local quality gates after code changes:
  1. `npm run lint`
  2. `npm run build`
- `npm run validate` runs both checks in sequence and should pass before pushing.

## Pre-commit Hook

- Husky + lint-staged is configured for pre-commit checks.
- On commit, staged `*.ts` and `*.html` files run through `eslint --max-warnings=0` via `npm run lint:staged`.

## Maintenance

- Keep this file synchronized with actual project architecture and tooling.
- If scripts, linting, or build workflow changes, update this file in the same change set.
