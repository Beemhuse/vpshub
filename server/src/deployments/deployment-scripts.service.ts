import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { Template, Project } from '@prisma/client';

@Injectable()
export class DeploymentScriptsService {
  generateDockerDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    domain: string,
    isCustomDomain: boolean,
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const imageName =
      dto?.dockerImage ||
      project?.dockerImage ||
      (template as any)?.image ||
      'nginx:alpine';
    const containerName = `vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${deploymentId.slice(0, 5)}`;
    const port = (template as any)?.defaultPort || 80;

    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Construct environment variable flags for docker run
    let envFlags = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFlags += ` -e ${key}="${value.replace(/"/g, '\\"')}"`;
      });
    }

    return `
echo "[1/5] Pulling Docker image ${imageName}..."
sudo docker pull ${imageName} || { echo "Failed to pull image"; exit 1; }

echo "[2/5] Starting container ${containerName}..."
sudo docker rm -f ${containerName} 2>/dev/null || true
CONTAINER_ID=$(sudo docker run -d --name ${containerName} --restart always -p 127.0.0.1:8080:${port}${envFlags} ${imageName}) || { echo "Failed to start container"; exit 1; }

echo "[3/5] Ensuring Nginx is installed..."
if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx not found. Installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq nginx
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nginx
  else
    echo "Unsupported package manager. Install Nginx manually."
    exit 1
  fi
fi
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable nginx >/dev/null 2>&1 || true
  sudo systemctl start nginx >/dev/null 2>&1 || true
fi

echo "[4/5] Configuring Nginx reverse proxy for ${domain}..."
sudo mkdir -p /etc/nginx/sites-available
 # remove stale nginx configs for same project (keep current)
sudo ls /etc/nginx/sites-available 2>/dev/null | grep "vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}" | grep -v "vpshub-${deploymentId}" | xargs -r sudo rm -f || true
sudo ls /etc/nginx/sites-enabled 2>/dev/null | grep "vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}" | grep -v "vpshub-${deploymentId}" | xargs -r sudo rm -f || true
sudo cat <<EOF > /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId}
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId} /etc/nginx/sites-enabled/
# Ensure server_names_hash_bucket_size is large enough to avoid "could not build server_names_hash" errors
sudo mkdir -p /etc/nginx/conf.d
echo 'server_names_hash_bucket_size 128;' | sudo tee /etc/nginx/conf.d/vpshub_server_names.conf >/dev/null || true
sudo nginx -t && sudo systemctl reload nginx || { echo "Nginx config failed"; exit 1; }

${this.generateSslScript(domain, isCustomDomain, 5)}

echo "Deployment successful!"
`;
  }

  generateStaticDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    repositoryUrl: string,
    domain: string,
    isCustomDomain: boolean,
    appDir: string,
  ): string {
    const outputDir = (template as any)?.outputDir || '.';
    const installCmd = (template as any)?.installCmd || '';
    const buildCmd = (template as any)?.buildCmd || '';

    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `
echo "[1/5] Cloning repository..."
sudo mkdir -p ${appDir}
sudo rm -rf ${appDir}/* 2>/dev/null || true
  sudo git clone ${repositoryUrl} ${appDir} || { echo "Git clone failed"; exit 1; }

cd ${appDir}
${installCmd ? `echo "Installing dependencies..."; sudo ${installCmd} || { echo "Install failed"; exit 1; }` : ''}
${buildCmd ? `echo "Building project..."; sudo ${buildCmd} || { echo "Build failed"; exit 1; }` : ''}

echo "[2/5] Ensuring Nginx is installed..."
if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx not found. Installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq nginx
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nginx
  else
    echo "Unsupported package manager. Install Nginx manually."
    exit 1
  fi
fi
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable nginx >/dev/null 2>&1 || true
  sudo systemctl start nginx >/dev/null 2>&1 || true
fi

echo "[3/5] Configuring Nginx for static site at ${domain}..."
 # remove stale nginx configs for same project (keep current)
sudo ls /etc/nginx/sites-available 2>/dev/null | grep "vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}" | grep -v "vpshub-${deploymentId}" | xargs -r sudo rm -f || true
sudo ls /etc/nginx/sites-enabled 2>/dev/null | grep "vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}" | grep -v "vpshub-${deploymentId}" | xargs -r sudo rm -f || true
sudo cat <<EOF > /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId}
server {
    listen 80;
    server_name ${domain};
    root ${appDir}/${outputDir};
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId} /etc/nginx/sites-enabled/
# Ensure server_names_hash_bucket_size is large enough to avoid "could not build server_names_hash" errors
sudo mkdir -p /etc/nginx/conf.d
echo 'server_names_hash_bucket_size 128;' | sudo tee /etc/nginx/conf.d/vpshub_server_names.conf >/dev/null || true
sudo nginx -t && sudo systemctl reload nginx || { echo "Nginx config failed"; exit 1; }

${this.generateSslScript(domain, isCustomDomain, 5)}

echo "Deployment successful!"
`;
  }

  generateNodeDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    repositoryUrl: string,
    domain: string,
    isCustomDomain: boolean,
    appDir: string,
    sshUser: string,
    dto?: CreateDeploymentDto,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const pm2Name = `vpshub-${sanitized}-${deploymentId.slice(0, 5)}`;

    const templatePort = (template as any)?.defaultPort || 3000;
    const basePort = templatePort >= 1024 ? templatePort : 3000;
    const port = basePort + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    const rootDir = this.sanitizeRootDir(dto?.rootDir);

    const installCmd = (
      dto?.installCmd ||
      (template as any)?.installCmd ||
      ''
    ).replace(/"/g, '\\"');
    const buildCmd = (
      dto?.buildCmd ||
      (template as any)?.buildCmd ||
      ''
    ).replace(/"/g, '\\"');
    const startCmd = (
      dto?.startCmd ||
      (template as any)?.startCmd ||
      ''
    ).replace(/"/g, '\\"');

    // Handle environment variables
    let envFileContent = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFileContent += `${key}=${value}\\n`;
      });
    }

    return `
set -euo pipefail

APP_USER="${sshUser}"
APP_DIR="${appDir}"
ROOT_DIR="${rootDir}"
PM2_NAME="${pm2Name}"
PORT=${port}
BASE_DIR="/var/www/vpshub-apps"

if [ -n "$ROOT_DIR" ]; then
  WORK_DIR="$APP_DIR/$ROOT_DIR"
else
  WORK_DIR="$APP_DIR"
fi

if [ -z "$APP_USER" ]; then
  APP_USER="$(id -un)"
fi

if [ "$(id -un)" = "$APP_USER" ]; then
  run_as_user() {
    bash -lc "$1"
  }
else
  run_as_user() {
    sudo -u "$APP_USER" -H bash -lc "$1"
  }
fi

echo "[0/8] Preparing runtime..."
if ! command -v git >/dev/null 2>&1; then
  echo "Git not found. Installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq git
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y git
  else
    echo "Unsupported package manager. Install git manually."
    exit 1
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Installing LTS..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y curl ca-certificates
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
  else
    echo "Unsupported package manager. Install Node.js manually."
    exit 1
  fi
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found. Installing..."
  sudo npm install -g pm2 || { echo "PM2 install failed"; exit 1; }
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx not found. Installing..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq nginx
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y nginx
  else
    echo "Unsupported package manager. Install Nginx manually."
    exit 1
  fi
fi
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl enable nginx >/dev/null 2>&1 || true
  sudo systemctl start nginx >/dev/null 2>&1 || true
fi

sudo mkdir -p "$BASE_DIR"
sudo chown -R "$APP_USER":"$APP_USER" "$BASE_DIR"

echo "[1/8] Cloning repository..."
if [ -z "$APP_DIR" ] || [ "$APP_DIR" = "/" ]; then
  echo "Invalid application directory: $APP_DIR"
  exit 1
fi
run_as_user "rm -rf '$APP_DIR'"
run_as_user "mkdir -p '$APP_DIR'"
run_as_user "git clone --depth 1 '${repositoryUrl}' '$APP_DIR' || { echo 'Git clone failed'; exit 1; }"

if [ ! -d "$WORK_DIR" ]; then
  echo "Root directory not found: $WORK_DIR"
  exit 1
fi

if [ ! -f "$WORK_DIR/package.json" ]; then
  echo "package.json not found in $WORK_DIR"
  exit 1
fi

echo "[2/8] Creating .env file..."
if [ -n "${envFileContent}" ]; then
  run_as_user "printf \\"${envFileContent}\\" > '$WORK_DIR/.env'"
else
  run_as_user "touch '$WORK_DIR/.env'"
fi

echo "[3/8] Installing dependencies..."
if [ -n "${installCmd}" ]; then
  run_as_user "cd '$WORK_DIR' && ${installCmd}"
else
  if [ -f "$WORK_DIR/pnpm-lock.yaml" ]; then
    if ! command -v pnpm >/dev/null 2>&1; then
      if command -v corepack >/dev/null 2>&1; then
        sudo corepack enable
      else
        sudo npm install -g pnpm
      fi
    fi
    run_as_user "cd '$WORK_DIR' && pnpm install --frozen-lockfile"
  elif [ -f "$WORK_DIR/yarn.lock" ]; then
    if ! command -v yarn >/dev/null 2>&1; then
      if command -v corepack >/dev/null 2>&1; then
        sudo corepack enable
      else
        sudo npm install -g yarn
      fi
    fi
    run_as_user "cd '$WORK_DIR' && yarn install --frozen-lockfile"
  elif [ -f "$WORK_DIR/package-lock.json" ]; then
    run_as_user "cd '$WORK_DIR' && npm ci"
  else
    run_as_user "cd '$WORK_DIR' && npm install"
  fi
fi

echo "[4/8] Building application..."
if [ -n "${buildCmd}" ]; then
  run_as_user "cd '$WORK_DIR' && ${buildCmd}"
else
  if [ -f "$WORK_DIR/package.json" ] && grep -q "\\"build\\":" "$WORK_DIR/package.json"; then
    run_as_user "cd '$WORK_DIR' && npm run build"
  else
    echo "No build script found. Skipping build."
  fi
fi

if [ -f "$WORK_DIR/package-lock.json" ]; then
  run_as_user "cd '$WORK_DIR' && npm prune --omit=dev" || true
fi

echo "[5/8] Starting application with PM2 on port $PORT..."
run_as_user "pm2 delete '$PM2_NAME' 2>/dev/null || true"

if [ -n "${startCmd}" ]; then
  run_as_user "cd '$WORK_DIR' && PORT=$PORT NODE_ENV=production pm2 start bash --name '$PM2_NAME' -- -lc \\"${startCmd}\\""
else
  if [ -f "$WORK_DIR/node_modules/.bin/next" ]; then
    run_as_user "cd '$WORK_DIR' && pm2 start node_modules/.bin/next --name '$PM2_NAME' -- start -p $PORT"
  else
    run_as_user "cd '$WORK_DIR' && PORT=$PORT NODE_ENV=production pm2 start npm --name '$PM2_NAME' -- start"
  fi
fi

run_as_user "pm2 save"
if command -v systemctl >/dev/null 2>&1; then
  sudo pm2 startup systemd -u "$APP_USER" --hp "$(eval echo ~$APP_USER)" >/dev/null 2>&1 || true
fi

sleep 5

if ! sudo ss -tuln | grep -q ":$PORT"; then
  echo "Application failed to bind to port $PORT"
  run_as_user "pm2 logs '$PM2_NAME' --lines 20"
  exit 1
fi

echo "[6/8] Cleaning old nginx configs..."
sudo ls /etc/nginx/sites-available 2>/dev/null | grep "vpshub-${sanitized}-" | grep -v "vpshub-${sanitized}-${deploymentId}" | xargs -r sudo rm -f || true
sudo ls /etc/nginx/sites-enabled 2>/dev/null | grep "vpshub-${sanitized}-" | grep -v "vpshub-${sanitized}-${deploymentId}" | xargs -r sudo rm -f || true

echo "[7/8] Configuring Nginx reverse proxy for ${domain}..."

sudo cat <<EOF > /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId}
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId} /etc/nginx/sites-enabled/

sudo mkdir -p /etc/nginx/conf.d
echo 'server_names_hash_bucket_size 128;' | sudo tee /etc/nginx/conf.d/vpshub_server_names.conf >/dev/null || true

sudo nginx -t || { echo "Nginx config test failed"; exit 1; }
sudo systemctl reload nginx

${this.generateSslScript(domain, isCustomDomain, 8)}

echo "Deployment successful!"
`;
  }

  generateSslScript(
    domain: string,
    isCustomDomain: boolean,
    stepNum: number = 4,
  ): string {
    if (!isCustomDomain) {
      return `echo "[${stepNum}/${stepNum}] Skipping SSL for platform domain..."`;
    }
    return `
echo "[${stepNum}/${stepNum}] Provisioning SSL via Certbot..."
sudo certbot --nginx -d ${domain} --non-interactive --agree-tos -m admin@vpshub.link || echo "Certbot failed, falling back to HTTP"
`;
  }

  private sanitizeRootDir(rootDir?: string): string {
    if (!rootDir) return '';
    const trimmed = rootDir.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/') || trimmed.startsWith('~')) {
      throw new BadRequestException('Root directory must be a relative path');
    }
    if (trimmed.includes('..')) {
      throw new BadRequestException('Root directory cannot contain ".."');
    }
    if (!/^[a-zA-Z0-9._/-]+$/.test(trimmed)) {
      throw new BadRequestException(
        'Root directory contains invalid characters',
      );
    }
    return trimmed.replace(/\/+$/, '');
  }

  generateCleanupScript(projectName: string, deploymentIds: string[]): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const appDirPrefix = `/var/www/vpshub-apps/${sanitized}-`;

    let pm2Cleanup = '';
    let nginxCleanup = '';
    let dirCleanup = '';

    deploymentIds.forEach((id) => {
      const pm2Name = `vpshub-${sanitized}-${id.slice(0, 5)}`;
      pm2Cleanup += `pm2 delete "${pm2Name}" 2>/dev/null || true\n`;
      nginxCleanup += `sudo rm -f /etc/nginx/sites-available/vpshub-${sanitized}-${id}\n`;
      nginxCleanup += `sudo rm -f /etc/nginx/sites-enabled/vpshub-${sanitized}-${id}\n`;
      dirCleanup += `sudo rm -rf "${appDirPrefix}${id.slice(0, 8)}"\n`;
    });

    return `
echo "Starting cleanup for project ${projectName}..."

echo "[1/3] Stopping PM2 processes..."
${pm2Cleanup}
pm2 save || true

echo "[2/3] Removing Nginx configurations..."
${nginxCleanup}
sudo nginx -t && sudo systemctl reload nginx || true

echo "[3/3] Deleting project directories..."
${dirCleanup}

echo "Cleanup completed successfully!"
`;
  }
}
