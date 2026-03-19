# VPSHub

VPSHub is a self-hosted control panel for connecting remote VPS servers, deploying apps over SSH, and managing previews, logs, and runtime services from a single UI.

The project currently ships with:

- A `client/` app built with React, TypeScript, Vite, Tailwind, and TanStack Query
- A `server/` app built with NestJS, Prisma, PostgreSQL, Swagger, and WebSocket deployment logs
- Shared `packages/` directories reserved for reusable SDK and UI code

## What VPSHub does

- Connect Linux VPS instances over SSH and bootstrap them automatically
- Install and configure a global Traefik reverse proxy on connected servers
- Deploy static sites, Node.js apps with PM2, and Docker or Docker Compose workloads
- Assign preview domains automatically with `nip.io` when no custom domain is supplied
- Provision HTTPS routing through Traefik and Let's Encrypt
- Stream deployment logs back to the dashboard in real time
- Browse repositories through GitHub OAuth during deployment flows
- Support local auth plus Google OAuth sign-in
- Expose server stats, Docker controls, PM2 controls, templates, billing, settings, and file actions in the UI

## Repository layout

```text
vpshub/
|- client/                 React frontend
|- server/                 NestJS API and Prisma schema
|- packages/               Shared package workspaces
|- docker-compose.yml      Local full-stack container setup
|- .env.example            Example environment variables
|- deployment_docs.md      Node/static deployment notes
|- deployment_guide.md     Traefik + Docker Compose production guide
|- DOCKER.md               Docker-specific project notes
`- CONTRIBUTING.md         Contribution guide
```

## Core architecture

### Frontend

- Vite + React 19 application in `client/`
- Main views include servers, dashboard, templates, projects, deployments, logs, billing, and settings
- Uses an Axios client configured with `VITE_API_URL`
- Reads the JWT from the `access_token` cookie and attaches it as a bearer token

### Backend

- NestJS API in `server/`
- Prisma models for users, servers, projects, deployments, templates, and activities
- Swagger UI exposed at `http://localhost:3000/api`
- Modules currently include auth, dashboard, servers, projects, deployments, billing, settings, logs, templates, and files

### Deployment model

When a server is connected, VPSHub bootstraps Docker, Docker Compose, and Traefik on the VPS. Deployments are then executed remotely over SSH:

- Static deployments clone a repository, build it if needed, serve it with Nginx, and route traffic through Traefik
- Node deployments clone a repository, install dependencies, run the app under PM2, and proxy traffic through Nginx and Traefik
- Docker deployments either run a single container or detect `docker-compose.yml` and bring the stack up with automatic Traefik labels

If no custom domain is supplied, VPSHub assigns a default preview domain based on the server IP, for example `my-app.203.0.113.10.nip.io`.

## Local development

### Prerequisites

- Node.js 18 or newer
- `pnpm`
- PostgreSQL
- Docker Desktop or Docker Engine if you want to run the full stack with Compose

### Environment variables

The repository includes a root `.env.example` with the main values used for local Docker-based setup.

Important variables:

- `DATABASE_URL`
- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `VITE_API_URL`

Recommended local defaults:

- Backend API: `http://localhost:3000`
- Frontend app: `http://localhost:5173`
- Swagger: `http://localhost:3000/api`

Set `client` `VITE_API_URL` explicitly to `http://localhost:3000`. The frontend source still contains a fallback to `http://localhost:3800`, so relying on the fallback will point at the wrong port in a standard local setup.

### Option 1: Run with Docker Compose

1. Copy `.env.example` to `.env.local`.
2. Review the database and OAuth values.
3. Start the stack:

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

### Option 2: Run frontend and backend separately

#### Backend

1. Create `server/.env` or otherwise export the required environment variables.
2. Install dependencies:

```powershell
cd server
pnpm install
```

3. Generate the Prisma client and run migrations:

```powershell
pnpm run prisma:generate
pnpm exec prisma migrate dev
```

4. Seed the database if needed:

```powershell
pnpm run seed
```

5. Start the API:

```powershell
pnpm run start:dev
```

#### Frontend

1. Install dependencies:

```powershell
cd client
pnpm install
```

2. Set `VITE_API_URL=http://localhost:3000`.
3. Start the Vite dev server:

```powershell
pnpm run dev
```

## Authentication

VPSHub currently supports:

- Email/password authentication
- Google OAuth via `/auth/google`
- GitHub OAuth connection for repository access during deployments

GitHub OAuth is used to:

- Request an authorization URL from `/auth/github/url`
- Exchange the returned code through `/auth/github/exchange`
- Persist the GitHub access token on the authenticated user
- List repositories from `/auth/github/repos`

## API and data model

The backend uses Prisma with PostgreSQL. Main models:

- `User`
- `Server`
- `Project`
- `Deployment`
- `Template`
- `Activity`

Useful backend commands:

```powershell
cd server
pnpm run start:dev
pnpm run build
pnpm run test
pnpm run prisma:generate
pnpm run prisma:migrate
```

Useful frontend commands:

```powershell
cd client
pnpm run dev
pnpm run build
pnpm run lint
pnpm run preview
```

## Additional docs

- [deployment_docs.md](./deployment_docs.md)
- [deployment_guide.md](./deployment_guide.md)
- [DOCKER.md](./DOCKER.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## Current status

The root README and `server/README.md` started from framework templates. This root README now reflects the current VPSHub codebase and deployment workflow, including Traefik-based routing, GitHub integration, Google auth, and the split `client/` plus `server/` repository structure.
