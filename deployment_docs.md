# Deployment Process Documentation

This document explains how VPSHub handles deployments for **Static** and **Node.js** projects.

---

## 🌎 Static Deployment Process

Static deployments are designed for modern frontend frameworks (React, Vue, Vite, etc.) or simple HTML sites.

### 1. Repository Setup

- The repository is cloned into `/var/www/vpshub-apps/[project-name]-[deployment-id]`.
- All previous files in that specific deployment directory are cleared before a new clone.

### 2. Build Pipeline

- **Install**: If an install command (e.g., `npm install`) is provided, it runs first.
- **Build**: If a build command (e.g., `npm run build`) is provided, it generates the production assets.
- **Output Directory**: Nginx is configured to serve files from the specified output directory (default is the root of the project).

### 3. Web Server (Nginx)

- A new Nginx configuration is created in `/etc/nginx/sites-available`.
- It includes a `try_files $uri $uri/ /index.html` rule to support Single Page Applications (SPA) routing.
- The configuration is symlinked to `sites-enabled` and Nginx is reloaded.

---

## 🚀 Node.js Deployment Process

Node.js deployments use PM2 for process management and Nginx as a reverse proxy.

### 1. Runtime Environment

The system automatically ensures the following are installed:

- **Node.js**: Versions are managed via NodeSource (defaults to LTS v20).
- **PM2**: Installed globally to keep the application running.
- **Package Managers**: Automatically detects and uses `pnpm`, `yarn`, or `npm` based on lockfiles.

### 2. Dependency & Build

- **Environment Variables**: A `.env` file is generated from the variables provided in the dashboard.
- **Intelligent Install**:
  - If [pnpm-lock.yaml](file:///c:/Users/ADMIN/Documents/projects/personal/vpshub/client/pnpm-lock.yaml) exists, it uses `pnpm install`.
  - If `yarn.lock` exists, it uses `yarn install`.
  - Falls back to `npm install` or `npm ci`.
- **Build**: Runs the build command if detected in [package.json](file:///c:/Users/ADMIN/Documents/projects/personal/vpshub/client/package.json) or provided via DTO.

### 3. Process Management (PM2)

- The app is started using PM2 with the name `vpshub-[project-name]-[id]`.
- **Port Mapping**: The system assigns a unique port for the deployment to avoid conflicts.
- **Persistence**: Runs `pm2 save` and configures `pm2 startup` to ensure the app restarts after a server reboot.

### 4. Reverse Proxy (Nginx)

- Nginx acts as a reverse proxy, forwarding traffic from port 80 (or 443) to the internal PM2 port.
- Headers are preserved (`X-Real-IP`, `X-Forwarded-For`, etc.) to ensure the Node.js app can identify client IPs.

---

## 🔒 SSL & Domains

For both types of deployments:

- **Nip.io**: Default subdomains use `project.ip.nip.io`.
- **Custom Domains**: If a custom domain is attached, VPSHub automatically provisions an SSL certificate using **Certbot** (Let's Encrypt).
- **Automatic Renewal**: Certbot is configured to handle certificate renewals automatically on the VPS.

---

## 🧹 Project Cleanup

When a project or deployment is deleted:

1.  **PM2**: The specific process is stopped and removed.
2.  **Files**: The `/var/www/vpshub-apps/` directory for that deployment is deleted.
3.  **Nginx**: The configuration files are removed and Nginx is reloaded.
