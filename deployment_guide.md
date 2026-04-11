# Production-Ready Docker Deployment Guide (Traefik + SSL)

This guide explains how to deploy multi-service applications on your VPS using VPSHub with Traefik, Let's Encrypt, and Docker Compose.

## 1. Global VPS Infrastructure
Upon bootstrapping a server via VPSHub, the following components are automatically installed:
- **Nginx**: Acts as the public edge proxy on ports `80/443`.
- **Traefik**: Handles dynamic app routing behind Nginx on loopback ports `8080/8443`.
- **Docker Proxy Network**: A global bridge network named `vpshub-proxy`.
- **Automatic SSL**: Certificates are generated via Let's Encrypt and stored in `/etc/vpshub/traefik/acme/acme.json`.

---

## 2. Recommended Project Structure
For a production-ready application, use the following structure in your Git repository:

```text
my-awesome-project/
├── .env.example
├── docker-compose.yml
├── frontend/
│   ├── Dockerfile
│   └── ...
└── backend/
    ├── Dockerfile
    └── ...
```

---

## 3. Example [docker-compose.yml](file:///c:/Users/ADMIN/Documents/projects/personal/vpshub/docker-compose.yml)
This example includes a frontend, a backend, and a persistent PostgreSQL database, all isolated and routed via Traefik.

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: ./frontend/Dockerfile
    networks:
      - vpshub-proxy
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myproj-frontend.rule=Host(`app.example.com`)"
      - "traefik.http.routers.myproj-frontend.entrypoints=websecure"
      - "traefik.http.routers.myproj-frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.myproj-frontend.loadbalancer.server.port=80"
    restart: always

  backend:
    build:
      context: .
      dockerfile: ./backend/Dockerfile
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
    networks:
      - vpshub-proxy
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myproj-backend.rule=Host(`api.example.com`)"
      - "traefik.http.routers.myproj-backend.entrypoints=websecure"
      - "traefik.http.routers.myproj-backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.myproj-backend.loadbalancer.server.port=3000"
    restart: always

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    restart: always

networks:
  vpshub-proxy:
    external: true
  internal:
    driver: bridge

volumes:
  postgres_data:
```

---

## 4. Deployment Steps

1. **DNS Configuration**:
   - Create an `A Record` for your domains (e.g., `app.example.com` and `api.example.com`) pointing to your VPS IP address.

2. **VPSHub Setup**:
   - Go to **Servers** > **Connect Server**.
   - Provide your SSH credentials.
   - VPSHub will automatically bootstrap Traefik and the required networks.

3. **Project Deployment**:
   - Create a new **Docker Application** in VPSHub.
   - Select your Git repository.
   - (Optional) Specify the **Root Directory** if your compose file isn't in the root.
   - Add any sensitive **Environment Variables** in the VPSHub UI.

4. **Rollout**:
   - Click **Deploy**. VPSHub will:
     - Clone your repo.
     - Inject environment variables.
     - Run `docker compose up -d --build`.
     - Traefik will detect the new labels and provision SSL automatically.

---

## 5. Production Best Practices
- **Persistence**: Always use `volumes` for databases to prevent data loss on container restarts.
- **Resource Limits**: Define `deploy.resources` in your compose file to prevent one app from consuming the entire VPS.
- **Health Checks**: Add `healthcheck` sections to your services to allow Traefik to avoid routing traffic to unhealthy containers.
- **Logging**: Use a log rotation strategy (e.g., `json-file` with `max-size`) to prevent disk exhaustion.
