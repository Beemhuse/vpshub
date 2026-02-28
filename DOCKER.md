# Docker Setup Guide for VPSHub

This guide explains how to build and run VPSHub using Docker and Docker Compose.

## Prerequisites

- Docker (>= 20.10)
- Docker Compose (>= 2.0)

## Project Structure

```
.
├── docker-compose.yml          # Orchestrates all services
├── .env.example               # Example environment variables
├── client/
│   ├── Dockerfile             # Client build configuration
│   └── nginx.conf             # Nginx server configuration
└── server/
    └── Dockerfile             # Server build configuration
```

## Services

### PostgreSQL Database
- **Container**: vpshub-postgres
- **Default Port**: 5432
- **Default Credentials**:
  - User: `vpshub`
  - Password: `vpshub_password`
  - Database: `vpshub`

### NestJS Backend Server
- **Container**: vpshub-server
- **Port**: 3000
- **Features**:
  - Automatic database migrations on startup
  - Auto-restarts on failure
  - Health checks enabled

### React Frontend Client
- **Container**: vpshub-client
- **Port**: 5173 (externally), 80 (internally)
- **Server**: Nginx with gzip compression and SPA routing
- **Features**:
  - Asset caching with versioning
  - Health checks enabled

## Quick Start

### 1. Prepare Environment Variables

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit `.env` and update the following for production:
- `DB_PASSWORD`: Set a strong database password
- `JWT_SECRET`: Set a secure JWT secret
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth credentials
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials

### 2. Build Docker Images

Build all services:

```bash
docker-compose build
```

Or build specific services:

```bash
docker-compose build client
docker-compose build server
docker-compose build postgres
```

### 3. Start Services

Start all services:

```bash
docker-compose up -d
```

Or start in foreground (useful for debugging):

```bash
docker-compose up
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api (Swagger)

### 5. View Logs

View all logs:

```bash
docker-compose logs -f
```

View specific service logs:

```bash
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f postgres
```

## Common Commands

### Stop Services

```bash
docker-compose stop
```

### Stop and Remove Containers

```bash
docker-compose down
```

### Stop and Remove Everything (including database)

```bash
docker-compose down -v
```

### Rebuild and Restart

```bash
docker-compose up --build -d
```

### Database Migrations

Migrations run automatically on server startup. Manual migration commands:

```bash
# Run pending migrations
docker-compose exec server npx prisma migrate deploy

# Create a new migration (in dev)
docker-compose exec server npx prisma migrate dev --name migration_name

# View Prisma schema
docker-compose exec server npx prisma studio
```

### Database Seed

```bash
docker-compose exec server npm run seed
```

### Database Access

Connect to PostgreSQL directly:

```bash
docker-compose exec postgres psql -U vpshub -d vpshub
```

## Environment Variables

### Database

- `DB_USER`: PostgreSQL username (default: `vpshub`)
- `DB_PASSWORD`: PostgreSQL password (default: `vpshub_password`)
- `DB_NAME`: Database name (default: `vpshub`)
- `DATABASE_URL`: Full connection string (auto-generated from above)

### Server

- `PORT`: Server port (default: `3000`)
- `NODE_ENV`: Node environment (`development`, `production`)
- `FRONTEND_URL`: Frontend URL for CORS (default: `http://localhost:5173`)
- `JWT_SECRET`: JWT signing secret (change in production!)

### OAuth

- `GITHUB_CLIENT_ID`: GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App Client Secret
- `GITHUB_CALLBACK_URL`: GitHub OAuth callback URL
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret
- `GOOGLE_CALLBACK_URL`: Google OAuth callback URL

### Frontend

- `VITE_API_URL`: Backend API URL (default: `http://localhost:3000`)

## Development Workflow

### Local Development (without Docker)

For faster development cycles, you can run services locally:

```bash
# Terminal 1: Database only
docker-compose up postgres

# Terminal 2: Backend
cd server
npm install
npm run start:dev

# Terminal 3: Frontend
cd client
npm install
npm run dev
```

### Production Deployment

For production deployment:

1. Update `.env` with production values
2. Use strong secrets and credentials
3. Set `NODE_ENV=production`
4. Consider using a reverse proxy (nginx) in front
5. Enable HTTPS/TLS
6. Set up proper backup for PostgreSQL volume
7. Monitor logs and health checks

Example production docker-compose usage:

```bash
# Build with BuildKit for better caching
DOCKER_BUILDKIT=1 docker-compose build

# Start in detached mode
docker-compose up -d

# Check health
docker-compose ps
```

## Troubleshooting

### Port Already in Use

If ports are already in use, either:
1. Stop the conflicting service
2. Change ports in docker-compose.yml

### Database Connection Issues

Check if postgres service is healthy:

```bash
docker-compose ps
docker-compose logs postgres
```

### Server Migration Failures

Check server logs for migration errors:

```bash
docker-compose logs server
docker-compose exec server npx prisma migrate status
```

### Frontend Not Loading

Check nginx configuration and frontend logs:

```bash
docker-compose logs client
docker-compose exec client wget -O - http://localhost/index.html
```

### Rebuild After Code Changes

Rebuild and restart affected services:

```bash
docker-compose up --build -d server
docker-compose up --build -d client
```

## Networking

Services communicate through the `vpshub-network` bridge network:
- `server` service is accessible at `http://server:3000` from other containers
- `postgres` service is accessible at `postgres:5432` from other containers
- Frontend client is accessible at `http://client` from other containers

## File Volumes

- `postgres_data`: PostgreSQL data directory
  - Location: Named volume managed by Docker
  - Persists database between container restarts
  - To clear: `docker volume rm vpshub_postgres_data`
