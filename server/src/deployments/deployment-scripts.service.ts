import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { Template, Project } from '@prisma/client';
import {
  VPSHUB_TRAEFIK_CONTAINER_NAME,
  VPSHUB_TRAEFIK_HTTP_PORT,
} from '../common/proxy.constants';

@Injectable()
export class DeploymentScriptsService {
  getDockerComposeProjectName(
    projectName: string,
    // deploymentId: string,
  ): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  getDockerContainerName(projectName: string): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitized}-app`;
  }

  getDockerAppDir(projectName: string): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `/opt/vpshub/apps/${sanitized}`;
  }

  private normalizeDomains(
    primaryDomain: string,
    domains?: string[],
  ): string[] {
    const candidates = [primaryDomain, ...(domains || [])]
      .map((domain) => (typeof domain === 'string' ? domain.trim() : ''))
      .filter(Boolean)
      .map((domain) => domain.toLowerCase());

    return Array.from(new Set(candidates));
  }

  private buildTraefikHostRule(domains: string[]): string {
    return domains.map((domain) => `Host(\`${domain}\`)`).join(' || ');
  }

  private generateNginxHttpOnlyBlock(
    primaryDomain: string,
    domains: string[],
  ): string {
    const allDomains = this.normalizeDomains(primaryDomain, domains).join(' ');
    return `
server {
    listen 80;
    listen [::]:80;
    server_name ${allDomains};

    # Essential for Let's Encrypt HTTP-01 challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Proxy everything else to Traefik
    location / {
        proxy_pass http://127.0.0.1:8282;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }
}
`.trim();
  }

  private generateNginxServerBlock(
    primaryDomain: string,
    domains: string[],
  ): string {
    const allDomains = this.normalizeDomains(primaryDomain, domains).join(' ');
    return `
server {
    listen 80;
    listen [::]:80;
    server_name ${allDomains};

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://\\$host\\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${allDomains};

    ssl_certificate /etc/letsencrypt/live/${primaryDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${primaryDomain}/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:8282;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`.trim();
  }

  private getApplyNginxConfigScript(
    projectName: string,
    primaryDomain: string,
    domains: string[],
    nginxConfig: string,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const configFile = `/etc/nginx/sites-available/vpshub-${sanitized}.conf`;
    const linkFile = `/etc/nginx/sites-enabled/vpshub-${sanitized}.conf`;
    const allDomainsList = this.normalizeDomains(primaryDomain, domains);
    const certbotDomains = allDomainsList.map((d) => `-d ${d}`).join(' ');
    const httpOnlyConfig = this.generateNginxHttpOnlyBlock(
      primaryDomain,
      domains,
    );

    return `
CERT_PATH="/etc/letsencrypt/live/${primaryDomain}/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then
  log "SSL certificate missing for ${primaryDomain}. Starting automated provisioning..."
  
  log "Stage 1: Applying temporary HTTP-only configuration..."
  sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  sudo mkdir -p /var/www/html
  sudo tee ${configFile} > /dev/null <<EOF
${httpOnlyConfig}
EOF
  sudo ln -sf ${configFile} ${linkFile}
  sudo nginx -t && sudo systemctl reload nginx || { log "ERROR: Temporary HTTP Nginx config failed"; exit 1; }

  log "Stage 2: Requesting certificate from Let's Encrypt..."
  sudo certbot certonly --nginx ${certbotDomains} --non-interactive --agree-tos -m admin@vpshub.link --quiet || { log "ERROR: Certbot failed to obtain certificate"; exit 1; }
  
  if [ ! -f "$CERT_PATH" ]; then
    log "ERROR: Certificate still missing after Certbot run."
    exit 1
  fi
  log "SUCCESS: Certificate obtained for ${primaryDomain}."
fi

log "Stage 3: Applying final HTTPS configuration..."
sudo tee ${configFile} > /dev/null <<EOF
${nginxConfig}
EOF
sudo ln -sf ${configFile} ${linkFile}
if sudo nginx -t; then
  sudo systemctl reload nginx
  log "SUCCESS: Nginx configuration reloaded with SSL."
else
  log "ERROR: Final Nginx configuration test failed. Check logs."
  exit 1
fi
`.trim();
  }

  private generateStaticAppNginxConfig(): string {
    return `
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
`.trim();
  }

  private buildDockerRunTraefikLabels(
    routerName: string,
    primaryDomain: string,
    servicePort: string | number,
    domains?: string[],
  ): string {
    const normalizedDomains = this.normalizeDomains(primaryDomain, domains);
    const hostRule = this.buildTraefikHostRule(normalizedDomains);
    const labels = [
      'traefik.enable=true',
      `traefik.http.routers.${routerName}.rule=${hostRule}`,
      `traefik.http.routers.${routerName}.entrypoints=web`,
      `traefik.http.routers.${routerName}.service=${routerName}`,
      `traefik.http.services.${routerName}.loadbalancer.server.port=${servicePort}`,
    ];
    return labels.map((label) => ` --label '${label}'`).join('');
  }

  private buildComposeTraefikLabels(
    routerName: string,
    primaryDomain: string,
    servicePort: string | number,
    domains?: string[],
  ): string {
    const normalizedDomains = this.normalizeDomains(primaryDomain, domains);
    const hostRule = this.buildTraefikHostRule(normalizedDomains);
    const labels = [
      `traefik.enable=true`,
      `traefik.http.routers.${routerName}.rule=${hostRule}`,
      `traefik.http.routers.${routerName}.entrypoints=web`,
      `traefik.http.routers.${routerName}.service=${routerName}`,
      `traefik.http.services.${routerName}.loadbalancer.server.port=${servicePort}`,
    ];

    return labels
      .map(
        (label) =>
          `      - "${label
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/`/g, '\\`')}"`,
      )
      .join('\n');
  }

  private getEnsureProxyInfrastructureScript(): string {
    return `
ensure_vpshub_proxy_infrastructure() {
  TRAEFIK_HTTP_PORT=${VPSHUB_TRAEFIK_HTTP_PORT}
  TRAEFIK_CONTAINER_NAME="${VPSHUB_TRAEFIK_CONTAINER_NAME}"
  log "Ensuring shared proxy infrastructure (Traefik on loopback port $TRAEFIK_HTTP_PORT)..."

  sudo docker network create vpshub-proxy 2>/dev/null || true
  sudo mkdir -p /etc/vpshub/traefik/dynamic

  TRAEFIK_RECREATE=false
  if sudo docker ps -a --format '{{.Names}}' | grep -qx "$TRAEFIK_CONTAINER_NAME"; then
    TRAEFIK_PORTS=$(sudo docker port "$TRAEFIK_CONTAINER_NAME" 2>/dev/null || true)
    if ! echo "$TRAEFIK_PORTS" | grep -q "^80/tcp -> 127.0.0.1:$TRAEFIK_HTTP_PORT$"; then
      TRAEFIK_RECREATE=true
    fi

    if [ "$TRAEFIK_RECREATE" = "true" ]; then
      log "Recreating Traefik on dedicated loopback port..."
      sudo docker rm -f "$TRAEFIK_CONTAINER_NAME" >/dev/null 2>&1 || true
      sleep 2
    else
      sudo docker start "$TRAEFIK_CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi

  if sudo ss -ltn '( sport = :'$TRAEFIK_HTTP_PORT' )' 2>/dev/null | grep -q LISTEN && \\
     ! sudo docker ps -a --format '{{.Names}}' | grep -qx "$TRAEFIK_CONTAINER_NAME"; then
    log "Port $TRAEFIK_HTTP_PORT is already in use:"
    sudo ss -ltnp '( sport = :'$TRAEFIK_HTTP_PORT' )' 2>/dev/null || true
    exit 1
  fi

  # Ensure Nginx is installed
  if ! command -v nginx &> /dev/null; then
    log "Installing Nginx..."
    if command -v apt-get &> /dev/null; then
      sudo apt-get update -y -qq >/dev/null 2>&1
      sudo apt-get install -y -qq nginx >/dev/null 2>&1
    elif command -v yum &> /dev/null; then
      sudo yum install -y -q nginx >/dev/null 2>&1
    fi
  fi

  if ! sudo docker ps -a --format '{{.Names}}' | grep -qx "$TRAEFIK_CONTAINER_NAME"; then
    log "Starting Traefik on loopback port $TRAEFIK_HTTP_PORT..."
    sudo docker run -d \\
      --name "$TRAEFIK_CONTAINER_NAME" \\
      --restart always \\
      --network vpshub-proxy \\
      -p 127.0.0.1:$TRAEFIK_HTTP_PORT:80 \\
      -v /var/run/docker.sock:/var/run/docker.sock:ro \\
      -v /etc/vpshub/traefik/dynamic:/etc/traefik/dynamic \\
      -e DOCKER_API_VERSION=1.40 \\
      traefik:v2.10 \\
      --providers.docker=true \\
      --providers.docker.exposedbydefault=false \\
      --providers.file.directory=/etc/traefik/dynamic \\
      --providers.file.watch=true \\
      --entrypoints.web.address=:80 \\
      --entrypoints.web.forwardedHeaders.trustedIPs=127.0.0.1 >/dev/null || { log "Failed to start Traefik"; exit 1; }
  else
    sudo docker start "$TRAEFIK_CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  if [ "$(sudo docker inspect -f '{{.State.Running}}' "$TRAEFIK_CONTAINER_NAME" 2>/dev/null || echo false)" != "true" ]; then
    log "Traefik is not running after startup."
    sudo docker logs --tail 100 "$TRAEFIK_CONTAINER_NAME" 2>&1 || true
    exit 1
  fi
}
`;
  }

  private buildServiceDomainResolver(
    projectName: string,
    deploymentId: string,
    baseDomain: string,
    serviceDomains?: Record<string, string> | null,
  ): string {
    const escapeShellValue = (value: string) =>
      value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');

    const entries = Object.entries(serviceDomains || {})
      .map(
        ([service, domain]) =>
          [service.trim(), String(domain || '').trim()] as const,
      )
      .filter(([service, domain]) => service && domain);

    const fallback = baseDomain?.trim()
      ? `echo "$1.${escapeShellValue(baseDomain.trim())}"`
      : `echo "$1-${this.getDockerComposeProjectName(projectName)}.local"`;

    const cases = entries
      .map(
        ([service, domain]) =>
          `    "${escapeShellValue(service)}") echo "${escapeShellValue(domain)}" ;;`,
      )
      .join('\n');

    return `
resolve_service_domain() {
  case "$1" in
${cases ? `${cases}\n` : ''}    *) ${fallback} ;;
  esac
}
`;
  }

  generateDockerDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    domain: string,
    domains: string[],
    isCustomDomain: boolean,
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const repositoryUrl = dto?.repositoryUrl || project?.repositoryUrl;
    const imageName = repositoryUrl
      ? `vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-img-${deploymentId.slice(0, 5)}`
      : dto?.dockerImage ||
        project?.dockerImage ||
        (template as Template)?.image ||
        'nginx:alpine';

    const containerName = this.getDockerContainerName(projectName);
    const port =
      dto?.exposedPort ||
      (project as Project)?.exposedPort ||
      (template as Template)?.defaultPort ||
      80;

    const rootDir = this.sanitizeRootDir(
      dto?.rootDir || (project as Project)?.rootDir,
    );
    const dockerfilePath =
      dto?.buildCmd || (project as Project)?.buildCmd || 'Dockerfile';

    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const projectNetwork = `vpshub-proj-${sanitized}`;

    // Construct environment variable flags for docker run
    let envFlags = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFlags += ` -e ${key}="${value.replace(/"/g, '\\"')}"`;
      });
    }

    let traefikLabels = '';

    if (domain) {
      const routerName = `${sanitized}-${deploymentId.slice(0, 5)}`;
      const servicePort = port || 80;
      traefikLabels += this.buildDockerRunTraefikLabels(
        routerName,
        domain,
        servicePort,
        domains,
      );
    }
    let dockerBuildStep = `
echo "[1/5] Pulling Docker image ${imageName}..."
sudo docker pull ${imageName} || { echo "Failed to pull image"; exit 1; }
`;

    if (repositoryUrl) {
      const appDir = this.getDockerAppDir(projectName);
      dockerBuildStep = `
log "[0/5] Cloning repository and building Docker image..."
sudo rm -rf ${appDir} 2>/dev/null || true
sudo mkdir -p ${appDir}
log "Cloning ${repositoryUrl} (shallow)..."
sudo git clone --depth 1 ${repositoryUrl} ${appDir} || { log "Git clone failed"; exit 1; }
cd ${appDir}
log "Checking for root directory..."
if [ -n "${rootDir}" ]; then
  log "Switching to root directory: ${rootDir}"
  cd "${rootDir}" || { log "Root directory ${rootDir} not found"; exit 1; }
else
  log "Using current directory as root."
fi

log "Checking for docker-compose files..."
if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
  log "SUCCESS: Detected docker-compose file."
  
  # Create .env file for docker-compose
  log "Generating .env file for Docker Compose..."
  echo "# Generated by VPSHub" > .env
  ${
    dto?.env
      ? Object.entries(dto.env)
          .map(
            ([k, v]) =>
              `echo "${k}=${String(v || '').replace(/"/g, '\\"')}" >> .env`,
          )
          .join('\n  ')
      : ''
  }
  
  # Propagate .env to subdirectories if referenced in compose
  log "Scanning for additional required .env files..."
  COMPOSE_FILE=$( [ -f "docker-compose.yml" ] && echo "docker-compose.yml" || echo "docker-compose.yaml" )
  # Extract any .env paths mentioned
  ENV_PATHS=$(grep -E "\\.env" "$COMPOSE_FILE" | sed -E 's/.*[:[:space:]"'"'"']([^:[:space:]"'"'"']+\\.env).*/\\1/' | sort -u)
  for EP in $ENV_PATHS; do
    if [[ "$EP" == */* ]]; then
       EP_DIR=$(dirname "$EP")
       log "  Ensuring directory exists: $EP_DIR for $EP"
       mkdir -p "$EP_DIR"
       if [ ! -f "$EP" ]; then
         log "  Propagating .env to $EP"
         cp .env "$EP" 2>/dev/null || touch "$EP"
       fi
    fi
  done

  log "Ensuring core networks exist..."
  sudo docker network create vpshub-proxy 2>/dev/null || true
  # Create project network with label if missing, to satisfy Compose external check
  if ! sudo docker network inspect "${projectNetwork}" >/dev/null 2>&1; then
    sudo docker network create "${projectNetwork}"
  fi

  # Use 'docker compose' (V2) if available, otherwise 'docker-compose' (V1)
  COMPOSE_CMD="docker-compose"
  if sudo docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  fi
  COMPOSE_PROJECT_NAME="${this.getDockerComposeProjectName(projectName)}"
  export COMPOSE_PROJECT_NAME
  log "Using Docker Compose project name: $COMPOSE_PROJECT_NAME"

  log "Executing $COMPOSE_CMD up -d --build --remove-orphans..."
  sudo $COMPOSE_CMD up -d --build --remove-orphans || { log "Docker Compose up failed"; exit 1; }

  CONFIG_OUTPUT=$(sudo $COMPOSE_CMD config 2>/dev/null)

  # Automatic Subdomain Assignment using docker-compose.override.yml
  log "Generating docker-compose.override.yml for automatic routing..."
  
  # Get actual service names safely using docker compose config, stripping \r
  SERVICES=$(sudo $COMPOSE_CMD config --services 2>/dev/null | tr -d '\r')
  
  if [ -z "$SERVICES" ]; then
    log "WARNING: No services detected via config. Trying manual fallback..."
    COMPOSE_FILE=$( [ -f "docker-compose.yml" ] && echo "docker-compose.yml" || echo "docker-compose.yaml" )
    SERVICES=$(grep -E '^[[:space:]]{2}[a-zA-Z0-9_-]+:' "$COMPOSE_FILE" | sed 's/^[[:space:]]*//;s/://' | grep -v "networks" | grep -v "volumes" | grep -v "version")
  fi

  cat <<EOF > docker-compose.override.yml
services:
EOF
  APP_SERVICES=""
  DB_SERVICES=""
  
  # First pass: Identify all DB services for depends_on
  for SERVICE in $SERVICES; do
    if echo "$SERVICE" | grep -Ei "db|postgres|redis|mysql|mongo|mariadb|cache" >/dev/null; then
      DB_SERVICES="$DB_SERVICES $SERVICE"
    fi
  done

  for SERVICE in $SERVICES; do
    SAFE_SERVICE=$(echo "$SERVICE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_.-]/-/g')
    SERVICE_CONTAINER_NAME="$COMPOSE_PROJECT_NAME-$SAFE_SERVICE"
    
    # Try to find target port for this service
    TARGET_PORT=$(printf '%s\n' "$CONFIG_OUTPUT" | awk -v svc="$SERVICE" '
      /^services:$/ { in_services=1; next }
      in_services && /^[^[:space:]][^:]*:$/ { in_services=0; in_target=0; in_ports=0 }
      in_services && /^  [^[:space:]][^:]*:$/ {
        current=$1
        sub(/:$/, "", current)
        in_target=(current==svc)
        in_ports=0
        next
      }
      in_target && /^    ports:$/ { in_ports=1; next }
      in_target && in_ports && /^      - target: / {
        print $3
        exit
      }
      in_target && /^    [^[:space:]][^:]*:$/ { in_ports=0 }
    ')

    # Base override for every service
    cat <<EOT >> docker-compose.override.yml
  $SERVICE:
    container_name: $SERVICE_CONTAINER_NAME
    ports: !reset []
EOT

    # If it's an app service, add proxy networking and Traefik labels
    if echo "$SERVICE" | grep -Eiv "db|postgres|redis|mysql|mongo|mariadb|cache" >/dev/null; then
       log "  Routing found for service: $SERVICE"
       SUBDOMAIN=$(resolve_service_domain "$SERVICE")
       APP_SERVICES="$APP_SERVICES $SERVICE"
       
       cat <<EOT >> docker-compose.override.yml
    networks:
      - vpshub-proxy
      - ${projectNetwork}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}-$SERVICE.rule=Host(\\\`$SUBDOMAIN\\\`)"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}-$SERVICE.entrypoints=web"
EOT

       # ✅ ALWAYS DEFINE PORT (fallback to 80)
       SERVICE_PORT=\${TARGET_PORT:-80}

       cat <<EOT >> docker-compose.override.yml
      - "traefik.http.services.${sanitized}-\${deploymentId:0:5}-$SERVICE.loadbalancer.server.port=\\$SERVICE_PORT"
EOT
       
       # App depends on all DBs
       if [ -n "$DB_SERVICES" ]; then
         cat <<EOT >> docker-compose.override.yml
    depends_on:
EOT
         for DB in $DB_SERVICES; do
            cat <<EOT >> docker-compose.override.yml
      $DB:
        condition: service_healthy
EOT
         done
       fi
    else
       # If it's a DB service, add healthchecks
       log "  Database detection: $SERVICE"
       LOWER_SVC=$(echo "$SERVICE" | tr '[:upper:]' '[:lower:]')
       
       cat <<EOT >> docker-compose.override.yml
    networks:
      - ${projectNetwork}
EOT

       # Check by service name or image name
       if echo "$LOWER_SVC" | grep -q 'postgres|pg'; then
         cat <<EOT >> docker-compose.override.yml
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \\$\${POSTGRES_USER:-postgres} -d \\$\${POSTGRES_DB:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 10
EOT
       elif echo "$LOWER_SVC" | grep -q 'redis'; then
         cat <<EOT >> docker-compose.override.yml
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
EOT
       elif echo "$LOWER_SVC" | grep -q 'mysql|mariadb'; then
         cat <<EOT >> docker-compose.override.yml
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10
EOT
       elif echo "$LOWER_SVC" | grep -q 'mongo'; then
         cat <<EOT >> docker-compose.override.yml
    healthcheck:
      test: ["CMD-SHELL", "echo 'db.runCommand({ping:1})' | mongosh --quiet || echo 'db.runCommand({ping:1})' | mongo --quiet"]
      interval: 10s
      timeout: 5s
      retries: 10
EOT
       fi
    fi
  done

  cat <<EOT >> docker-compose.override.yml
networks:
  vpshub-proxy:
    external: true
  ${projectNetwork}:
    external: true
EOT

  log "Executing $COMPOSE_CMD up -d --build --remove-orphans..."
  sudo $COMPOSE_CMD up -d --build --remove-orphans || { log "Docker Compose up failed"; exit 1; }

  log "Verifying services health..."
  # Wait up to 60 seconds for health
  for i in {1..12}; do
    ALL_HEALTHY=true
    # Check all containers in the project
    CONTAINER_IDS=$(sudo docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.ID}}')
    for CID in $CONTAINER_IDS; do
      H_STATUS=$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID")
      if [[ "$H_STATUS" != "healthy" && "$H_STATUS" != "running" ]]; then
        log "  Waiting for container $CID ($H_STATUS)..."
        ALL_HEALTHY=false
        break
      fi
    done
    
    if [ "$ALL_HEALTHY" = "true" ]; then
      log "All services are running/healthy."
      break
    fi
    sleep 5
  done

  log "Final check of application services..."
  APP_SERVICE_COUNT=0
  for APP_SERVICE in $APP_SERVICES; do
    APP_SERVICE_COUNT=$((APP_SERVICE_COUNT + 1))
    SERVICE_CONTAINER_NAME="$COMPOSE_PROJECT_NAME-$(echo "$APP_SERVICE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_.-]/-/g')"
    STATUS=$(sudo docker ps --filter "name=$SERVICE_CONTAINER_NAME" --format '{{.Status}}' | head -n 1)
    if [ -z "$STATUS" ] || ! echo "$STATUS" | grep -q '^Up'; then
      log "ERROR: Service $APP_SERVICE is not running correctly: $STATUS"
      sudo $COMPOSE_CMD ps || true
      sudo docker logs --tail 50 "$SERVICE_CONTAINER_NAME" || true
      exit 1
    fi
  done

  if [ "$APP_SERVICE_COUNT" -eq 0 ]; then
    RUNNING_COUNT=$(sudo docker ps --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.ID}}' | wc -l)
    if [ "$RUNNING_COUNT" -eq 0 ]; then
      log "ERROR: No running containers found for compose project $COMPOSE_PROJECT_NAME."
      sudo $COMPOSE_CMD ps || true
      exit 1
    fi
  fi
  
  USED_COMPOSE=true
else
  log "No docker-compose file found at root (or specified rootDir). Falling back to single-container Docker build."
  log "Building Docker image ${imageName} from ${dockerfilePath}..."
  sudo docker build --pull -f ${dockerfilePath} -t ${imageName} . || { log "ERROR: Docker build failed"; exit 1; }
  log "SUCCESS: Docker image ${imageName} built."
fi
`;
    }

    return `
${this.buildServiceDomainResolver(projectName, deploymentId, domain, project?.serviceDomains as any)}

# Helper for logging
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [DOCKER-DEPLOY] $1"
}

log "--- Starting Docker Deployment Process ---"
log "Project: ${projectName}"
log "Deployment ID: ${deploymentId}"

${this.getEnsureProxyInfrastructureScript().trim()}
log "Ensuring shared Nginx and Traefik proxy infrastructure..."
ensure_vpshub_proxy_infrastructure

${dockerBuildStep.trim()}

if [ "\${USED_COMPOSE:-false}" = "true" ]; then
  log "--- Docker Compose Deployment Completed ---"
else
  log "[2/5] Preparing to start single container ${containerName}..."
  log "Stopping and removing any existing container with same name..."
  sudo docker rm -f ${containerName} 2>/dev/null || true
  
  log "Ensuring Docker networks exist..."
  sudo docker network create vpshub-proxy 2>/dev/null || true
  sudo docker network create ${projectNetwork} 2>/dev/null || true

  log "Pulling image ${imageName} (if not built locally)..."
  sudo docker pull ${imageName} 2>/dev/null || true

  log "Running docker run for ${containerName}..."
  log "Command: sudo docker run -d --name ${containerName} --network vpshub-proxy --restart always ${imageName}"
  CONTAINER_ID=$(sudo docker run -d \
    --name ${containerName} \
    --restart always \
    --network vpshub-proxy \
    ${envFlags} \
    ${traefikLabels} \
    ${imageName}) || { log "ERROR: Failed to start container. Check image existence or label syntax."; exit 1; }
    
  log "SUCCESS: Container started with ID: \\$CONTAINER_ID"
    
  log "Connecting container to project internal network ${projectNetwork}..."
  sudo docker network connect ${projectNetwork} ${containerName} || true

  log "Verifying container is running..."
  sleep 3
  if [ "$(sudo docker inspect -f '{{.State.Running}}' ${containerName} 2>/dev/null || echo false)" != "true" ]; then
    log "ERROR: Container ${containerName} is not running after start."
    sudo docker logs --tail 100 ${containerName} 2>&1 || true
    exit 1
  fi
fi

  log "--- Docker Deployment Successful ---"
  log "Domains: ${domains.join(', ')} (Routed by host Nginx to Traefik)"
  
  ${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}
  
  echo "VPSHUB_DEPLOYMENT_SUCCESS"
`;
  }

  generateStaticDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    repositoryUrl: string,
    domain: string,
    domains: string[],
    isCustomDomain: boolean,
    appDir: string,
    dto?: CreateDeploymentDto,
  ): string {
    const outputDir = (template as Template)?.outputDir || '.';
    const installCmd =
      dto?.installCmd || (template as Template)?.installCmd || '';
    const buildCmd = dto?.buildCmd || (template as Template)?.buildCmd || '';

    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const composeProjectName = this.getDockerComposeProjectName(projectName);
    const containerName = `${sanitized}-static`;
    const traefikLabelBlock = this.buildComposeTraefikLabels(
      `${sanitized}-\${deploymentId:0:5}`,
      domain,
      80,
      domains,
    );

    return `
# Helper for logging
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [STATIC-DEPLOY] $1"
}

deploymentId="${deploymentId}"
projectName="${projectName}"

${this.getEnsureProxyInfrastructureScript().trim()}

log "[1/5] Cloning repository..."
sudo rm -rf ${appDir} 2>/dev/null || true
sudo mkdir -p ${appDir}
sudo git clone --depth 1 ${repositoryUrl} ${appDir} || { log "Git clone failed"; exit 1; }

cd ${appDir}
${installCmd ? `log "Installing dependencies..."; sudo ${installCmd} || { log "Install failed"; exit 1; }` : ''}
${buildCmd ? `log "Building project..."; sudo ${buildCmd} || { log "Build failed"; exit 1; }` : ''}

log "[2/5] Ensuring shared proxy infrastructure..."
ensure_vpshub_proxy_infrastructure

log "Validating static output directory..."
if [ ! -d "./${outputDir}" ]; then
  log "Output directory ${outputDir} was not found."
  exit 1
fi
if [ ! -f "./${outputDir}/index.html" ]; then
  log "index.html was not found in ${outputDir}."
  exit 1
fi

log "[3/5] Generating Nginx config for static serving..."
sudo tee default.conf > /dev/null <<EOF
${this.generateStaticAppNginxConfig()}
EOF

log "[4/5] Generating docker-compose.yml for static serving..."
cat <<EOF > docker-compose.yml
services:
  web:
    image: nginx:alpine
    container_name: ${containerName}
    restart: always
    volumes:
      - ./${outputDir}:/usr/share/nginx/html:ro
      - ./default.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - vpshub-proxy
    labels:
${traefikLabelBlock}

networks:
  vpshub-proxy:
    external: true
EOF

log "[5/5] Starting static serving container..."
if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose up failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose up failed"; exit 1; }
fi

log "Static deployment successful!"
log "Domains: ${domains.join(', ')} (Routed by host Nginx to Traefik to static Nginx)"

${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}

echo "VPSHUB_DEPLOYMENT_SUCCESS"
`;
  }

  generateNodeDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    repositoryUrl: string,
    domain: string,
    domains: string[],
    isCustomDomain: boolean,
    appDir: string,
    sshUser: string,
    dto?: CreateDeploymentDto,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const composeProjectName = this.getDockerComposeProjectName(projectName);
    const containerName = `${sanitized}-node`;

    const templatePort = (template as Template)?.defaultPort || 3000;
    const basePort = templatePort >= 1024 ? templatePort : 3000;
    const port = basePort + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    const traefikLabelBlock = this.buildComposeTraefikLabels(
      `${sanitized}-\${deploymentId:0:5}`,
      domain,
      port,
      domains,
    );

    const rootDir = this.sanitizeRootDir(dto?.rootDir);

    const installCmd = (
      dto?.installCmd ||
      (template as Template)?.installCmd ||
      'npm ci --prefer-offline --no-audit'
    ).replace(/"/g, '\\"');

    const buildCmd = (
      dto?.buildCmd ||
      (template as Template)?.buildCmd ||
      'npm run build'
    ).replace(/"/g, '\\"');

    const startCmd = (
      dto?.startCmd ||
      (template as Template)?.startCmd ||
      'npm start'
    ).replace(/"/g, '\\"');

    let envFileContent = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFileContent += `${key}=${String(value || '').replace(/"/g, '\\"')}\\n`;
      });
    }

    return `
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [NODE-DEPLOY] $1"
}

deploymentId="${deploymentId}"

${this.getEnsureProxyInfrastructureScript().trim()}

log "[1/6] Cloning repository..."
sudo rm -rf ${appDir} 2>/dev/null || true
sudo mkdir -p ${appDir}
sudo git clone --depth 1 ${repositoryUrl} ${appDir} || { log "Git clone failed"; exit 1; }

cd ${appDir}
${rootDir ? `cd ${rootDir}` : ''}

log "[2/6] Creating .env file..."
printf "${envFileContent}" > .env

log "[3/6] Creating .dockerignore..."
cat <<EOF > .dockerignore
node_modules
.git
.gitignore
Dockerfile
docker-compose.yml
npm-debug.log
.next/cache
EOF

log "[4/6] Generating optimized Dockerfile..."
cat <<EOF > Dockerfile
# ---- deps (cached) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN ${installCmd}

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ${buildCmd}

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
COPY --from=builder /app ./
EXPOSE ${port}
CMD ${startCmd.startsWith('npm') ? `["sh","-c","${startCmd}"]` : startCmd}
EOF

log "[5/6] Generating docker-compose.yml..."
cat <<EOF > docker-compose.yml
services:
  app:
    build: .
    container_name: ${containerName}
    restart: always
    env_file: .env
    networks:
      - vpshub-proxy
    labels:
${traefikLabelBlock}

networks:
  vpshub-proxy:
    external: true
EOF

log "[6/6] Building & starting (with cache)..."
ensure_vpshub_proxy_infrastructure

if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --build --remove-orphans || { log "Deploy failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --build --remove-orphans || { log "Deploy failed"; exit 1; }
fi

log "🚀 Deployment complete!"
log "⚡ Optimized with Docker layer caching"
log "🌍 Domains: ${domains.join(', ')}"

${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}

echo "VPSHUB_DEPLOYMENT_SUCCESS"
`;
  }

  generateDockerReconfigureScript(
    projectName: string,
    deploymentId: string,
    domain: string,
    domains: string[],
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const containerName = this.getDockerContainerName(projectName);
    const imageName =
      dto?.repositoryUrl || project?.repositoryUrl
        ? `vpshub-${sanitized}-img-${deploymentId.slice(0, 5)}`
        : dto?.dockerImage || project?.dockerImage || 'nginx:alpine';
    const port = dto?.exposedPort || (project as Project)?.exposedPort || 80;
    const projectNetwork = `vpshub-proj-${sanitized}`;
    const rootDir = this.sanitizeRootDir(
      dto?.rootDir || (project as Project)?.rootDir,
    );
    const appDir = this.getDockerAppDir(projectName);

    let envFlags = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFlags += ` -e ${key}="${value.replace(/"/g, '\\"')}"`;
      });
    }

    let traefikLabels = '';
    if (domain) {
      traefikLabels += this.buildDockerRunTraefikLabels(
        `${sanitized}-${deploymentId.slice(0, 5)}`,
        domain,
        port || 80,
        domains,
      );
    }

    return `
${this.buildServiceDomainResolver(projectName, deploymentId, domain, (dto?.serviceDomains || (project as Project)?.serviceDomains) as any)}

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [DOCKER-DEPLOY] $1"
}

log "--- Reconfiguring Docker Deployment ---"
log "Project: ${projectName}"
log "Deployment ID: ${deploymentId}"

${this.getEnsureProxyInfrastructureScript().trim()}
log "Ensuring shared Nginx and Traefik proxy infrastructure..."
ensure_vpshub_proxy_infrastructure

APP_DIR="${appDir}"
ROOT_DIR="${rootDir}"

if [ -n "$ROOT_DIR" ]; then
  WORK_DIR="$APP_DIR/$ROOT_DIR"
else
  WORK_DIR="$APP_DIR"
fi

if [ ! -d "$WORK_DIR" ]; then
  log "ERROR: Deployment working directory not found: $WORK_DIR"
  exit 1
fi

cd "$WORK_DIR"

if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
  log "Detected docker-compose deployment. Regenerating runtime configuration..."

  log "Generating .env file for Docker Compose..."
  echo "# Generated by VPSHub" > .env
  ${
    dto?.env
      ? Object.entries(dto.env)
          .map(([k, v]) => `echo "${k}=${v.replace(/"/g, '\\"')}" >> .env`)
          .join('\n  ')
      : ''
  }

  log "Scanning for additional required .env files..."
  COMPOSE_FILE=$( [ -f "docker-compose.yml" ] && echo "docker-compose.yml" || echo "docker-compose.yaml" )
  ENV_PATHS=$(grep -E "\\.env" "$COMPOSE_FILE" | sed -E 's/.*[:[:space:]"'"'"']([^:[:space:]"'"'"']+\\.env).*/\\1/' | sort -u)
  for EP in $ENV_PATHS; do
    if [[ "$EP" == */* ]]; then
       EP_DIR=$(dirname "$EP")
       log "  Ensuring directory exists: $EP_DIR for $EP"
       mkdir -p "$EP_DIR"
       cp .env "$EP" 2>/dev/null || true
    fi
  done

  sudo docker network create vpshub-proxy 2>/dev/null || true

  COMPOSE_CMD="docker-compose"
  if sudo docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  fi
  COMPOSE_PROJECT_NAME="${this.getDockerComposeProjectName(projectName)}"
  export COMPOSE_PROJECT_NAME
  CONFIG_OUTPUT=$(sudo $COMPOSE_CMD config 2>/dev/null)
  SERVICES=$(sudo $COMPOSE_CMD config --services 2>/dev/null)

  cat <<EOF > docker-compose.override.yml
services:
EOF
  APP_SERVICES=""

  for SERVICE in $SERVICES; do
    SAFE_SERVICE=$(echo "$SERVICE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_.-]/-/g')
    SERVICE_CONTAINER_NAME="$COMPOSE_PROJECT_NAME-$SAFE_SERVICE"
    TARGET_PORT=$(printf '%s\n' "$CONFIG_OUTPUT" | awk -v svc="$SERVICE" '
      /^services:$/ { in_services=1; next }
      in_services && /^[^[:space:]][^:]*:$/ { in_services=0; in_target=0; in_ports=0 }
      in_services && /^  [^[:space:]][^:]*:$/ {
        current=$1
        sub(/:$/, "", current)
        in_target=(current==svc)
        in_ports=0
        next
      }
      in_target && /^    ports:$/ { in_ports=1; next }
      in_target && in_ports && /^      - target: / {
        print $3
        exit
      }
      in_target && /^    [^[:space:]][^:]*:$/ { in_ports=0 }
    ')

    if echo "$SERVICE" | grep -Eiv "db|postgres|redis|mysql|mongo|mail|cache" >/dev/null; then
      APP_SERVICES="$APP_SERVICES $SERVICE"
      SUBDOMAIN=$(resolve_service_domain "$SERVICE")
      cat <<EOT >> docker-compose.override.yml
  $SERVICE:
    container_name: $SERVICE_CONTAINER_NAME
    ports: !reset []
    networks:
      - vpshub-proxy
       cat <<EOT >> docker-compose.override.yml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}-$SERVICE.rule=Host(\\\`$SUBDOMAIN\\\`)"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}-$SERVICE.entrypoints=web"
      - "traefik.http.services.${sanitized}-\${deploymentId:0:5}-$SERVICE.loadbalancer.server.port=${'${TARGET_PORT:-80}'}"
EOT
    else
      cat <<EOT >> docker-compose.override.yml
  $SERVICE:
    container_name: $SERVICE_CONTAINER_NAME
    ports: !reset []
EOT
    fi
  done

  cat <<EOT >> docker-compose.override.yml
networks:
  vpshub-proxy:
    external: true
EOT

  log "Applying updated Docker Compose configuration..."
  sudo $COMPOSE_CMD up -d --remove-orphans || { log "Docker Compose update failed"; exit 1; }

  sleep 5
  for APP_SERVICE in $APP_SERVICES; do
    SAFE_APP_SERVICE=$(echo "$APP_SERVICE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_.-]/-/g')
    APP_CONTAINER_NAME="$COMPOSE_PROJECT_NAME-$SAFE_APP_SERVICE"
    STATUS=$(sudo docker ps --filter "name=^${'${APP_CONTAINER_NAME}'}$" --format '{{.Status}}' | head -n 1)
    if [ -z "$STATUS" ] || ! echo "$STATUS" | grep -qE '^Up'; then
      log "WARNING: Service $APP_SERVICE status: ${'${STATUS:-not found}'}. Continuing anyway."
    fi
  done
else
  log "Detected single-container deployment. Recreating container with updated configuration..."
  sudo docker rm -f ${containerName} 2>/dev/null || true
  sudo docker network create vpshub-proxy 2>/dev/null || true
  sudo docker network create ${projectNetwork} 2>/dev/null || true
  CONTAINER_ID=$(sudo docker run -d \
    --name ${containerName} \
    --restart always \
    --network vpshub-proxy \
    ${envFlags} \
    ${traefikLabels} \
    ${imageName}) || { log "ERROR: Failed to recreate container"; exit 1; }
  sudo docker network connect ${projectNetwork} ${containerName} 2>/dev/null || true
  sleep 3
  if [ "$(sudo docker inspect -f '{{.State.Running}}' ${containerName} 2>/dev/null || echo false)" != "true" ]; then
    log "ERROR: Container ${containerName} is not running after reconfiguration."
    sudo docker logs --tail 100 ${containerName} 2>&1 || true
    exit 1
  fi
fi

log "Docker deployment configuration applied successfully."

${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}

echo "VPSHUB_DEPLOYMENT_SUCCESS"
`;
  }

  generateNodeReconfigureScript(
    projectName: string,
    deploymentId: string,
    domain: string,
    domains: string[],
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const containerName = `${sanitized}-node`;
    const composeProjectName = this.getDockerComposeProjectName(projectName);
    const appDir = this.getDockerAppDir(projectName);
    const rootDir = this.sanitizeRootDir(dto?.rootDir || project?.rootDir);

    const templatePort = (project as any)?.template?.defaultPort || 3000;
    const basePort = templatePort >= 1024 ? templatePort : 3000;
    const port = basePort + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    const traefikLabelBlock = this.buildComposeTraefikLabels(
      `${sanitized}-\${deploymentId:0:5}`,
      domain,
      port,
      domains,
    );

    let envFileContent = '';
    const mergedEnv = { ...(project?.env as any), ...(dto?.env as any) };
    Object.entries(mergedEnv).forEach(([key, value]) => {
      envFileContent += `${key}=${String(value || '').replace(/"/g, '\\"')}\\n`;
    });

    return `
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [NODE-RECONFIGURE] $1"
}

log "--- Reconfiguring Node.js Deployment ---"
cd ${appDir}
${rootDir ? `cd ${rootDir}` : ''}

log "Updating .env file..."
printf "${envFileContent}" > .env

log "Updating docker-compose.yml with new labels/domain..."
# We need to preserve the service definition but update labels
# For Node, we just regenerate the docker-compose.yml since it's simple
cat <<EOF > docker-compose.yml
services:
  app:
    build: .
    container_name: ${containerName}
    restart: always
    env_file: .env
    networks:
      - vpshub-proxy
    labels:
${traefikLabelBlock}

networks:
  vpshub-proxy:
    external: true
EOF

log "Restarting container..."
if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose update failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose update failed"; exit 1; }
fi

${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}

echo "VPSHUB_DEPLOYMENT_SUCCESS"
`;
  }

  generateStaticReconfigureScript(
    projectName: string,
    deploymentId: string,
    domain: string,
    domains: string[],
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const containerName = `${sanitized}-static`;
    const composeProjectName = this.getDockerComposeProjectName(projectName);
    const appDir = this.getDockerAppDir(projectName);
    const outputDir = (project as any)?.template?.outputDir || '.';

    const traefikLabelBlock = this.buildComposeTraefikLabels(
      `${sanitized}-\${deploymentId:0:5}`,
      domain,
      80,
      domains,
    );

    return `
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [STATIC-RECONFIGURE] $1"
}

log "--- Reconfiguring Static Deployment ---"
cd ${appDir}

log "Updating docker-compose.yml with new labels/domain..."
cat <<EOF > docker-compose.yml
services:
  web:
    image: nginx:alpine
    container_name: ${containerName}
    restart: always
    volumes:
      - ./${outputDir}:/usr/share/nginx/html:ro
      - ./default.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - vpshub-proxy
    labels:
${traefikLabelBlock}

networks:
  vpshub-proxy:
    external: true
EOF

log "Restarting container..."
if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose update failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose update failed"; exit 1; }
fi

${domain ? this.getApplyNginxConfigScript(projectName, domain, domains, this.generateNginxServerBlock(domain, domains)) : ''}

echo "VPSHUB_DEPLOYMENT_SUCCESS"
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
echo "[${stepNum}/${stepNum}] SSL must be configured manually in the edge Nginx. Skipping internal provisioning."
`;
  }

  private sanitizeRootDir(rootDir?: string | null): string {
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
    let dockerCleanup = '';
    let nginxCleanup = '';
    let dirCleanup = '';

    deploymentIds.forEach((id) => {
      const pm2Name = `vpshub-${sanitized}-${id.slice(0, 5)}`;
      const containerName = `vpshub-${sanitized}-${id.slice(0, 5)}`;
      const imageName = `vpshub-${sanitized}-img-${id.slice(0, 5)}`;
      const projectNetwork = `vpshub-proj-${sanitized}`;

      pm2Cleanup += `pm2 delete "${pm2Name}" 2>/dev/null || true\n`;
      dockerCleanup += `sudo docker rm -f "${containerName}" 2>/dev/null || true\n`;
      dockerCleanup += `sudo docker rmi -f "${imageName}" 2>/dev/null || true\n`;
      dockerCleanup += `sudo docker network rm "${projectNetwork}" 2>/dev/null || true\n`;

      nginxCleanup += `sudo rm -f /etc/nginx/sites-available/vpshub-${sanitized}-${id}\n`;
      nginxCleanup += `sudo rm -f /etc/nginx/sites-enabled/vpshub-${sanitized}-${id}\n`;
      nginxCleanup += `sudo rm -f /etc/vpshub/traefik/dynamic/vpshub-${sanitized}-${id}.yml\n`;
      dirCleanup += `sudo rm -rf "${appDirPrefix}${id.slice(0, 8)}"\n`;
      dirCleanup += `sudo rm -rf "/opt/vpshub-apps/${sanitized}-${id.slice(0, 8)}"\n`;
    });

    return `
echo "Starting cleanup for project ${projectName}..."

echo "[1/3] Stopping PM2 processes and Docker containers..."
${pm2Cleanup}
pm2 save || true
${dockerCleanup}

echo "[2/3] Removing Nginx configurations..."
${nginxCleanup}
sudo nginx -t && sudo systemctl reload nginx || true

echo "[3/3] Deleting project directories..."
${dirCleanup}

echo "Cleanup completed successfully!"
`;
  }
}
