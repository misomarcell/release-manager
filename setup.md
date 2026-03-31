# Angular + Material Boilerplate Setup

This file is a reusable recipe to create a project with the same setup/style as this repo.

## 1) Reusable Prompt For AI Agent

Copy this prompt into a coding agent when you want a fresh project scaffold:

```md
Create a new Angular app using the latest stable Angular (no next/rc builds), standalone components, SCSS, and Angular Material (M3), with PWA/service-worker support, ESLint flat config, Husky + lint-staged, and a strict local validation workflow.

Requirements:

- Stack:
  - Latest stable Angular + Angular CLI
  - Angular Material + CDK
  - Angular Service Worker (PWA)
  - Signals-friendly architecture
  - SCSS styling
  - ESLint flat config using `@eslint/js`, `typescript-eslint`, and `angular-eslint`
  - `husky` + `lint-staged` pre-commit lint on staged `*.ts` and `*.html`
  - Git repository setup with proper .gitignore
- Scripts in `package.json`:
  - `start`, `build`, `watch`, `test`, `lint`, `lint:staged`, `validate`, `prepare`
  - `validate` must run `npm run lint && npm run build`
- Conventions:
  - Angular standalone, skip test file generation for new schematics
  - Material 3 token-first styling (`--mat-sys-*`)
  - Keep UI mobile-first and virtual-scroll-friendly
- AI agent governance:
  - Create `AGENTS.md` with architecture, workflow, and validation rules
  - AGENTS maintenance rules must explicitly require:
    1. `npm run lint`
    2. `npm run build`
  - Mention pre-commit hook behavior (`husky` + `lint-staged`)

Deliverables:

1. All config/files created and wired.
2. `AGENTS.md` included.
3. `README.md` with setup/run/collect/deploy notes.
4. Run `npm run lint` and `npm run build` and report results.
```

## 2) Manual Setup Commands

Run in PowerShell (or your shell equivalent):

```bash
npx @angular/cli@latest new <app-name> --standalone --routing --style=scss --package-manager=npm --ssr=true --skip-tests
cd <app-name>

npx ng add @angular/material
npx ng add @angular/pwa --project <app-name>
npx ng add angular-eslint --skip-confirmation

npm install -D @types/node dotenv husky lint-staged prettier
```

Then ensure `package.json` scripts look like this:

```json
{
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "lint": "ng lint",
    "lint:staged": "lint-staged",
    "validate": "npm run lint && npm run build",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,html}": "eslint --max-warnings=0"
  }
}
```

Set up Husky pre-commit:

```bash
npm run prepare
```

Create `.husky/pre-commit`:

```sh
#!/usr/bin/env sh
npm run lint:staged
```

## 3) Required Config Pattern

### `eslint.config.js`

```js
// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
```

### `tsconfig.scripts.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "noEmit": true
  },
  "include": ["scripts/**/*.ts", "src/shared/**/*.ts", "src/app/models/**/*.ts"]
}
```

## Agent Maintenance Rules

- Keep this file synchronized with architecture/tooling changes.
- After changes, run both quality gates locally:
  1. `npm run lint`
  2. `npm run build`
- Pre-commit hook (`husky` + `lint-staged`) lints staged `*.ts` and `*.html`.

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Framework  | Latest stable Angular (standalone components)      |
| UI         | Angular Material (M3)                              |
| Styling    | SCSS + `--mat-sys-*` tokens                        |
| State      | Angular Signals                                    |
| PWA        | Angular Service Worker (`@angular/service-worker`) |
| Linting    | ESLint flat config + `angular-eslint`              |
| Deployment | GitHub Actions -> GitHub Pages                     |

## Project Structure

```text
<project>/
|- scripts/
|- src/
|  |- app/
|  `- shared/
|- angular.json
|- ngsw-config.json
|- eslint.config.js
|- tsconfig.scripts.json
|- package.json
`- README.md
```

## Build & Validate

```bash
npm ci
npx ng serve
npm run lint
npm run build
npm run validate
```

## Styling Conventions

- Prefer Material 3 system tokens (`--mat-sys-*`), avoid hardcoded colors.
- Keep controls lightweight and performant.
- Preserve mobile-first layout and virtual-scroll performance where applicable.
- Keep SCSS styling indenting to the minimum.

## 5) Definition Of Done For This Boilerplate

- `npm run lint` passes.
- `npm run build` passes.
- `AGENTS.md` and `README.md` are aligned with the actual architecture.
- Pre-commit linting works on staged TS/HTML files.
