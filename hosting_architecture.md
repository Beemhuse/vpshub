# VPSHub Hosting Architecture

This document explains the modernized hosting architecture used by VPSHub for deploying and managing services. The system leverages a dual-proxy strategy using **Nginx** and **Traefik** to provide a robust, automated, and observable environment.

## 1. Request Flow Overview

When a user visits a site hosted on VPSHub (e.g., `https://my-app.1.2.3.4.nip.io`), the request passes through multiple layers on the server:

```mermaid
graph TD
    User([User Browser]) --> Port80[Port 80/443: Local Nginx]
    Port80 -- Proxy Pass (HTTP) --> Traefik[Traefik Router: Port 8282]
    Traefik -- HTTP Router --> Container[Application Container]
    Traefik <--> DockerSoc[Docker Socket]
```

### Layer 1: Nginx (Managed Edge)
Nginx acts as the primary "Edge Proxy" on the host machine.
- **Automated Configuration**: VPSHub automatically generates server blocks for your domains in `/etc/nginx/sites-available`.
- **SSL Termination**: Nginx handles all SSL/TLS termination using certificates (typically from Let's Encrypt).
- **Manual Control**: You can still add custom configurations or use Nginx for non-VPSHub sites on the same machine.

### Layer 2: Traefik (Internal Container Router)
Traefik is the "Brain" of the internal network, running entirely inside Docker.
- **Port Mapping**: It binds to loopback port `127.0.0.1:8282` (HTTP). It **does not** handle SSL publicly.
- **Header Trust**: Traefik trusts forwarded headers (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) from the local Nginx.
- **Label-Only Discovery**: Traefik watches the Docker socket and discovers services solely through Docker labels.

### Layer 3: Application Containers
Your applications run in isolated Docker containers, often as part of a `docker-compose` project. They are connected to a shared `vpshub-proxy` network, allowing Traefik to reach them without exposing their internal ports to the public internet.

---

## 2. Deployment Automation

VPSHub automates the configuration of these layers whenever you deploy a project.

### Step 1: Naming & Context
The system extracts the project name from the GitHub repository (e.g., `user/tradovate.git` -> `tradovate`). This name is used as the **Base Identity** for domains and container names.

### Step 2: Configuration Generation
For Docker-based projects, VPSHub generates a `docker-compose.override.yml` that includes Traefik labels:
```yaml
services:
  web:
    networks:
      - vpshub-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.my-app.rule=Host(`my-app.vps-ip.nip.io`)"
      - "traefik.http.services.my-app.loadbalancer.server.port=80"
```

### Step 3: Zero-Config Discovery
As soon as `docker compose up` completes, Traefik detects the new labels and starts routing traffic to the container. There is no need to restart Nginx or Traefik manually.

---

## 3. Key Benefits

- **Isolation**: Each project has its own Docker network and isolated environment.
- **Observability**: Services are automatically mapped to ports, and their health is monitored.
- **Simplicity**: Nginx and Traefik are configured automatically for new deployments.
- **SSL by Default**: SSL termination is handled by Nginx at the edge.

## 4. Port Configuration (Latest Update)
To avoid conflicts with external services (like Antler Sentinel), Traefik has been moved to a unique internal port mapping:
- **Public Ports**: 80 (HTTP), 443 (HTTPS)
- **Internal Traefik Loopback**: `8282`
- **Application Ports**: Dynamically handled by Traefik load balancer labels.
