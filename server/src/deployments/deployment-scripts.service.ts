import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { Template, Project } from '@prisma/client';
import {
  VPSHUB_TRAEFIK_CONTAINER_NAME,
  VPSHUB_TRAEFIK_HTTP_PORT,
  VPSHUB_TRAEFIK_HTTPS_PORT,
} from '../common/proxy.constants';

@Injectable()
export class DeploymentScriptsService {
  getDockerComposeProjectName(
    projectName: string,
    deploymentId: string,
  ): string {
    return projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  getDockerContainerName(projectName: string, deploymentId: string): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitized}-app`;
  }

  getDockerAppDir(projectName: string, deploymentId: string): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `/opt/vpshub/apps/${sanitized}`;
  }

  private getEnsureProxyInfrastructureScript(): string {
    return `
ensure_vpshub_proxy_infrastructure() {
  TRAEFIK_HTTP_PORT=${VPSHUB_TRAEFIK_HTTP_PORT}
  TRAEFIK_HTTPS_PORT=${VPSHUB_TRAEFIK_HTTPS_PORT}
  TRAEFIK_CONTAINER_NAME="${VPSHUB_TRAEFIK_CONTAINER_NAME}"

  # Check if Traefik is already correct
  if sudo docker ps --format '{{.Names}}' | grep -qx "$TRAEFIK_CONTAINER_NAME" && \
     [ "$(sudo docker inspect -f '{{.State.Running}}' "$TRAEFIK_CONTAINER_NAME" 2>/dev/null)" = "true" ]; then
    return 0
  fi

  log "Ensuring shared proxy infrastructure (Traefik)..."

  sudo docker network create vpshub-proxy 2>/dev/null || true
  sudo mkdir -p /etc/vpshub/traefik/acme
  sudo mkdir -p /etc/vpshub/traefik/dynamic
  sudo touch /etc/vpshub/traefik/acme/acme.json
  sudo chmod 600 /etc/vpshub/traefik/acme/acme.json

  if ! sudo docker ps -a --format '{{.Names}}' | grep -qx "$TRAEFIK_CONTAINER_NAME"; then
    log "Starting Traefik on loopback ports $TRAEFIK_HTTP_PORT/$TRAEFIK_HTTPS_PORT..."
    sudo docker run -d \\
      --name "$TRAEFIK_CONTAINER_NAME" \\
      --restart always \\
      --network vpshub-proxy \\
      -p 127.0.0.1:$TRAEFIK_HTTP_PORT:80 \\
      -p 127.0.0.1:$TRAEFIK_HTTPS_PORT:443 \\
      -v /var/run/docker.sock:/var/run/docker.sock:ro \\
      -v /etc/vpshub/traefik/acme/acme.json:/letsencrypt/acme.json \\
      -v /etc/vpshub/traefik/dynamic:/etc/traefik/dynamic \\
      -e DOCKER_API_VERSION=1.40 \\
      traefik:v2.10 \\
      --providers.docker=true \\
      --providers.docker.exposedbydefault=false \\
      --providers.file.directory=/etc/traefik/dynamic \\
      --providers.file.watch=true \\
      --entrypoints.web.address=:80 \\
      --entrypoints.websecure.address=:443 \\
      --certificatesresolvers.letsencrypt.acme.httpchallenge=true \\
      --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web \\
      --certificatesresolvers.letsencrypt.acme.email=admin@vpshub.link \\
      --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json >/dev/null || { log "Failed to start Traefik"; exit 1; }
  else
    sudo docker start "$TRAEFIK_CONTAINER_NAME" >/dev/null 2>&1 || true
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
      : `echo "$1-${this.getDockerComposeProjectName(projectName, deploymentId)}.local"`;

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
    isCustomDomain: boolean,
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const repositoryUrl = dto?.repositoryUrl || project?.repositoryUrl;
    const imageName = repositoryUrl
      ? `vpshub-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-img-${deploymentId.slice(0, 5)}`
      : dto?.dockerImage ||
        project?.dockerImage ||
        (template as any)?.image ||
        'nginx:alpine';

    const containerName = this.getDockerContainerName(
      projectName,
      deploymentId,
    );
    const port =
      dto?.exposedPort ||
      (project as any)?.exposedPort ||
      (template as any)?.defaultPort ||
      80;
    const hostPort = 8000 + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    const rootDir = this.sanitizeRootDir(
      dto?.rootDir || (project as any)?.rootDir,
    );
    const dockerfilePath =
      dto?.buildCmd || (project as any)?.buildCmd || 'Dockerfile';

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

      traefikLabels += ` --label 'traefik.enable=true'`;
      traefikLabels += ` --label 'traefik.http.routers.${routerName}.rule=Host(\`${domain}\`)'`;

      // ✅ ALWAYS HTTP (Nginx handles HTTPS)
      traefikLabels += ` --label 'traefik.http.routers.${routerName}.entrypoints=web'`;


      const servicePort = port || 80;
      traefikLabels += ` --label 'traefik.http.services.${routerName}.loadbalancer.server.port=${servicePort}'`;
    }
    let dockerBuildStep = `
echo "[1/5] Pulling Docker image ${imageName}..."
sudo docker pull ${imageName} || { echo "Failed to pull image"; exit 1; }
`;

    if (repositoryUrl) {
      const appDir = this.getDockerAppDir(projectName, deploymentId);
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
  COMPOSE_PROJECT_NAME="${this.getDockerComposeProjectName(projectName, deploymentId)}"
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
      - "traefik.http.services.${sanitized}-\${deploymentId:0:5}-$SERVICE.loadbalancer.server.port=\$SERVICE_PORT"
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
    
  log "SUCCESS: Container started with ID: \$CONTAINER_ID"
    
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
log "Custom domain: ${domain} (Proxied through Traefik)"
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
    dto?: CreateDeploymentDto,
  ): string {
    const outputDir = (template as any)?.outputDir || '.';
    const installCmd = dto?.installCmd || (template as any)?.installCmd || '';
    const buildCmd = dto?.buildCmd || (template as any)?.buildCmd || '';

    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const composeProjectName = this.getDockerComposeProjectName(
      projectName,
      deploymentId,
    );
    const containerName = `${sanitized}-static`;

    return `
# Helper for logging
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [STATIC-DEPLOY] $1"
}

deploymentId="${deploymentId}"
projectName="${projectName}"

${this.getEnsureProxyInfrastructureScript().trim()}

log "[1/4] Cloning repository..."
sudo rm -rf ${appDir} 2>/dev/null || true
sudo mkdir -p ${appDir}
sudo git clone --depth 1 ${repositoryUrl} ${appDir} || { log "Git clone failed"; exit 1; }

cd ${appDir}
${installCmd ? `log "Installing dependencies..."; sudo ${installCmd} || { log "Install failed"; exit 1; }` : ''}
${buildCmd ? `log "Building project..."; sudo ${buildCmd} || { log "Build failed"; exit 1; }` : ''}

log "[2/4] Ensuring shared proxy infrastructure..."
ensure_vpshub_proxy_infrastructure

log "[3/4] Generating docker-compose.yml for static serving..."
cat <<EOF > docker-compose.yml
version: '3.8'
services:
  web:
    image: nginx:alpine
    container_name: ${containerName}
    restart: always
    volumes:
      - ./${outputDir}:/usr/share/nginx/html:ro
    networks:
      - vpshub-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}.rule=Host(\\\`${domain}\\\`)"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}.entrypoints=web"
      - "traefik.http.services.${sanitized}-\${deploymentId:0:5}.loadbalancer.server.port=80"

networks:
  vpshub-proxy:
    external: true
EOF

log "[4/4] Starting static serving container..."
if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose up failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --remove-orphans || { log "Docker Compose up failed"; exit 1; }
fi

log "Static deployment successful!"
log "Custom domain: ${domain} (Proxied by Traefik to Nginx Container)"
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
    const composeProjectName = this.getDockerComposeProjectName(
      projectName,
      deploymentId,
    );
    const containerName = `${sanitized}-node`;

    const templatePort = (template as any)?.defaultPort || 3000;
    const basePort = templatePort >= 1024 ? templatePort : 3000;
    const port = basePort + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    const rootDir = this.sanitizeRootDir(dto?.rootDir);

    const installCmd = (
      dto?.installCmd ||
      (template as any)?.installCmd ||
      'npm install'
    ).replace(/"/g, '\\"');
    const buildCmd = (
      dto?.buildCmd ||
      (template as any)?.buildCmd ||
      ''
    ).replace(/"/g, '\\"');
    const startCmd = (
      dto?.startCmd ||
      (template as any)?.startCmd ||
      'npm start'
    ).replace(/"/g, '\\"');

    // Handle environment variables
    let envFileContent = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFileContent += `${key}=${String(value || '').replace(/"/g, '\\"')}\\n`;
      });
    }

    return `
# Helper for logging
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] [NODE-DEPLOY] $1"
}

deploymentId="${deploymentId}"
projectName="${projectName}"

${this.getEnsureProxyInfrastructureScript().trim()}

log "[1/5] Cloning repository..."
sudo rm -rf ${appDir} 2>/dev/null || true
sudo mkdir -p ${appDir}
sudo git clone --depth 1 ${repositoryUrl} ${appDir} || { log "Git clone failed"; exit 1; }

cd ${appDir}
${rootDir ? `cd ${rootDir}` : ''}

log "[2/5] Creating .env file..."
printf "${envFileContent}" > .env

log "[3/5] Generating Dockerfile for Node.js serving..."
cat <<EOF > Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN ${installCmd}
${buildCmd ? `RUN ${buildCmd}` : ''}
EXPOSE ${port}
ENV PORT=${port}
ENV NODE_ENV=production
CMD ${startCmd.startsWith('npm') ? startCmd : `["sh", "-c", "${startCmd}"]`}
EOF

log "[4/5] Generating docker-compose.yml..."
cat <<EOF > docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    container_name: ${containerName}
    restart: always
    env_file: .env
    networks:
      - vpshub-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}.rule=Host(\\\`${domain}\\\`)"
      - "traefik.http.routers.${sanitized}-\${deploymentId:0:5}.entrypoints=web"
      - "traefik.http.services.${sanitized}-\${deploymentId:0:5}.loadbalancer.server.port=${port}"

networks:
  vpshub-proxy:
    external: true
EOF

log "[5/5] Building and starting Node.js container..."
ensure_vpshub_proxy_infrastructure

if sudo docker compose version >/dev/null 2>&1; then
  sudo docker compose -p "${composeProjectName}" up -d --build --remove-orphans || { log "Docker Compose up failed"; exit 1; }
else
  sudo docker-compose -p "${composeProjectName}" up -d --build --remove-orphans || { log "Docker Compose up failed"; exit 1; }
fi

log "Node.js deployment successful!"
log "Custom domain: ${domain} (Proxied by Traefik to Node Container)"
`;
  }

  generateDockerReconfigureScript(
    projectName: string,
    deploymentId: string,
    domain: string,
    dto?: CreateDeploymentDto,
    project?: Project | null,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const containerName = this.getDockerContainerName(
      projectName,
      deploymentId,
    );
    const imageName =
      dto?.repositoryUrl || project?.repositoryUrl
        ? `vpshub-${sanitized}-img-${deploymentId.slice(0, 5)}`
        : dto?.dockerImage || project?.dockerImage || 'nginx:alpine';
    const port = dto?.exposedPort || (project as any)?.exposedPort || 80;
    const projectNetwork = `vpshub-proj-${sanitized}`;
    const rootDir = this.sanitizeRootDir(
      dto?.rootDir || (project as any)?.rootDir,
    );
    const appDir = this.getDockerAppDir(projectName, deploymentId);

    let envFlags = '';
    if (dto?.env) {
      Object.entries(dto.env).forEach(([key, value]) => {
        envFlags += ` -e ${key}="${value.replace(/"/g, '\\"')}"`;
      });
    }

    let traefikLabels = '';
    if (domain) {
      traefikLabels += ` --label 'traefik.enable=true'`;
      traefikLabels += ` --label 'traefik.http.routers.${sanitized}-${deploymentId.slice(0, 5)}.rule=Host(\`${domain}\`)'`;
      const isPublicDomain =
        domain &&
        /^[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/.test(domain) &&
        !/\\.local$|\\.test$/.test(domain);
      if (isPublicDomain) {
        traefikLabels += ` --label 'traefik.http.routers.${sanitized}-${deploymentId.slice(0, 5)}.entrypoints=websecure'`;
        traefikLabels += ` --label 'traefik.http.routers.${sanitized}-${deploymentId.slice(0, 5)}.tls.certresolver=letsencrypt'`;
      } else {
        traefikLabels += ` --label 'traefik.http.routers.${sanitized}-${deploymentId.slice(0, 5)}.entrypoints=web'`;
      }
      if (port) {
        traefikLabels += ` --label 'traefik.http.services.${sanitized}-${deploymentId.slice(0, 5)}.loadbalancer.server.port=${port}'`;
      }
    }

    return `
${this.buildServiceDomainResolver(projectName, deploymentId, domain, (dto?.serviceDomains || (project as any)?.serviceDomains) as any)}

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
  COMPOSE_PROJECT_NAME="${this.getDockerComposeProjectName(projectName, deploymentId)}"
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
