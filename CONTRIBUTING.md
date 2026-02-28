# Contributing to VPSHub

Thanks for your interest in contributing! This document explains how to set up the project locally, run tests, file issues, and submit pull requests.

## Code of conduct
Be respectful and collaborative. Any abusive or discriminatory behavior is not welcome.

## Getting the code
1. Fork the repo and clone your fork locally.
2. Install dependencies:

```powershell
pnpm install
```

## Branching & workflow
- Create a feature branch from `main` (or `dev` if you maintain one):
  - `feature/your-feature-name`
  - `fix/bug-description`
- Keep changes focused and small. One PR per feature/bugfix.

## Commit messages
Use conventional commits style for clarity:
- `feat(scope): short description` — new feature
- `fix(scope): short description` — bug fix
- `chore: tooling changes`

Example:
```
feat(deploy): persist assigned preview domain when creating deployment
```

## Pull requests
- Target the `main` branch (or follow the repo's branch rule).
- Provide a short description of the change and why it’s needed.
- Link related issues.
- Add tests where appropriate and ensure the build is passing.

## Tests
- Backend: run `pnpm run test` inside `server/`.
- Frontend: run `pnpm run dev` and perform manual checks; add automated tests if you add important behavior.

## Local development tips
- Backend:
  - Use `pnpm run start:dev` inside `server/` for hot-reload
  - After model changes run `npx prisma migrate dev --name <desc>` and `npx prisma generate`
- Frontend:
  - Use `pnpm run dev` in the repo root to run Vite

## Schema and migrations
- Keep Prisma migrations small and descriptive.
- When you change `schema.prisma`, commit the generated migration files in `server/prisma/migrations` so CI/devs can apply the same migration.

## Deployment scripts & server changes
- The deployment flow lives in `server/src/deployments/deployments.service.ts`. If you modify deploy scripts, test them carefully against a disposable VPS.
- Cleanup scripts live in the `remove` flow of the same service.

## Security & secrets
- Never commit secrets (DB passwords, private keys). Use `.env` files and `.env.example` to document required variables.

## Reviewing
- Reviewers should verify functionality locally when practical, run the relevant test suites, and review logs for potential security or operational issues.

## Getting help
- Open an issue describing the bug or feature request with steps to reproduce and relevant logs or screenshots.

Thanks for helping improve VPSHub!
