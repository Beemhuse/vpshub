import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { Deployment, Project, Server, Template } from '@prisma/client';
@Injectable()
export class DeploymentsService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  async create(userId: string, dto: CreateDeploymentDto): Promise<Deployment> {
    const server: Server | null = await this.prisma.server.findUnique({
      where: { id: dto.serverId },
    });

    if (!server || server.userId !== userId) {
      throw new NotFoundException('Server not found');
    }

    if (server.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Server is not connected.');
    }

    // Verify project existence or create new one
    let project: Project;
    if (dto.projectId) {
      const existingProject = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!existingProject || existingProject.userId !== userId) {
        throw new NotFoundException('Project not found');
      }
      project = existingProject;
    } else {
      // Create a new project on the fly for this deployment
      project = await this.prisma.project.create({
        data: {
          name: dto.name || 'Untitled Project',
          user: { connect: { id: userId } },
          server: { connect: { id: dto.serverId } },
        },
      });
    }

    // If repositoryUrl supplied for the deployment and project doesn't have it, persist it to project
    if (dto.repositoryUrl && !project.repositoryUrl) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { repositoryUrl: dto.repositoryUrl },
      });
      const updatedProject = await this.prisma.project.findUnique({
        where: { id: project.id },
      });
      if (!updatedProject) throw new Error('Project creation failed');
      project = updatedProject;
    }

    let template: Template | null = null;
    if (dto.templateId) {
      template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });
    }

    if (!template) {
      // Logic for backward compatibility or default template selection
      // Fallback to a default template based on project type if none provided
      const templateId =
        project.type === 'docker' ? 'docker-image' : 'static-html';
      template = await this.prisma.template.findUnique({
        where: { id: templateId },
      });
      if (!template) throw new NotFoundException('Default template not found');
    }

    if (!template) {
      throw new Error('Template resolution failed');
    }

    // Validate requirements based on template type
    if (template.type === 'DOCKER') {
      if (!dto.dockerImage && !project.dockerImage) {
        throw new BadRequestException(
          'Docker image is required for this template',
        );
      }
    } else {
      if (!dto.repositoryUrl && !project.repositoryUrl) {
        throw new BadRequestException(
          'Repository URL is required for this template',
        );
      }
    }

    // Compute assigned domain (either custom provided or platform-generated)
    const assignedDomain = dto.domain || `${server.ip}.nip.io`;

    // Ensure project stores its domain when creating a new project
    if (!dto.projectId) {
      // project was just created above; update with domain
      await this.prisma.project.update({
        where: { id: project.id },
        data: { domain: assignedDomain },
      });
      // refresh project object
      const updatedProject = await this.prisma.project.findUnique({
        where: { id: project.id },
      });
      if (!updatedProject) throw new Error('Project lookup failed');
      project = updatedProject;
    } else if (!project.domain) {
      // If an existing project has no domain, set it
      await this.prisma.project.update({
        where: { id: project.id },
        data: { domain: assignedDomain },
      });
      const updatedProject = await this.prisma.project.findUnique({
        where: { id: project.id },
      });
      if (!updatedProject) throw new Error('Project lookup failed');
      project = updatedProject;
    }

    // Persist deployment with assigned domain immediately so callers receive it
    const deployment = await this.prisma.deployment.create({
      data: {
        serverId: dto.serverId,
        projectId: project.id,
        templateId: template.id,
        repositoryUrl: dto.repositoryUrl || project.repositoryUrl,
        status: 'in-progress',
        logs: 'Initializing deployment...\n',
        domain: assignedDomain,
      },
    });

    // If user didn't provide a custom domain, make the platform domain unique
    // by including the project name and the deployment id to avoid nginx conflicts
    if (!dto.domain) {
      const sanitizedProjectName = (project?.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      // compact timestamp: YYYYMMDDHHMM
      const now = new Date();
      const ts = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;
      const uniqueDomain = `${sanitizedProjectName}-${ts}.${server.ip}.nip.io`;

      // Update deployment and project with the unique domain
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { domain: uniqueDomain },
      });

      await this.prisma.project.update({
        where: { id: project.id },
        data: { domain: uniqueDomain },
      });

      // Ensure the async runner uses the unique domain
      dto.domain = uniqueDomain;
      const updatedProject = await this.prisma.project.findUnique({
        where: { id: project.id },
      });

      if (!updatedProject)
        throw new Error('Project lookup failed after domain update');
      project = updatedProject;

      // Surface the generated domain immediately in deployment logs so the UI can show it
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          logs: (deployment.logs || '') + `Assigned domain: ${uniqueDomain}\n`,
        },
      });
    } else {
      // Ensure the async runner uses the assigned (custom) domain and log it
      dto.domain = assignedDomain;
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          logs:
            (deployment.logs || '') + `Assigned domain: ${assignedDomain}\n`,
        },
      });
    }

    await this.prisma.activity.create({
      data: {
        type: 'deployment_start',
        message: `Deployment started for project "${project.name}" on ${server.name} using template "${template.name}"`,
        userId,
        serverId: server.id,
      },
    });

    // Start async deployment process
    this.runDeployment(
      deployment.id,
      server,
      template,
      dto,
      project,
      userId,
    ).catch((e) => console.error('Async deployment runner failed to start', e));

    return deployment;
  }

  private async runDeployment(
    deploymentId: string,
    server: Server,
    template: Template,
    dto: CreateDeploymentDto,
    project?: Project,
    userId?: string,
  ): Promise<void> {
    let logs = 'Initializing deployment sequence...\n';
    const serverIp = server.ip as string ;
    const updateLogs = async (chunk: string) => {
      logs += chunk + '\n';
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { logs },
      });
    };

    try {
      const projectName = project?.name || template?.name || 'Unknown Project';
      await updateLogs(`Project: ${projectName}`);

      let deployScript = '';

      // Prepare repository URL with optional GitHub OAuth token injection
      const rawRepoUrl = dto.repositoryUrl || project?.repositoryUrl || '';
      let repoUrlForClone = rawRepoUrl;
      if (rawRepoUrl && userId) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
          });
          const token = user?.githubAccessToken;
          if (
            token &&
            rawRepoUrl.startsWith('https://') &&
            rawRepoUrl.includes('github.com')
          ) {
            // Inject token into HTTPS URL for authenticated cloning
            repoUrlForClone = rawRepoUrl.replace(
              'https://',
              `https://${token}@`,
            );
          }
        } catch (e) {
          // ignore token injection failures and fall back to raw URL
        }
      }

      const sanitizedProjectName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const domain = dto.domain || `${server.ip}.nip.io`;
      const isCustomDomain = !!dto.domain;
      const appDir = `/var/www/vpshub-apps/${sanitizedProjectName}-${deploymentId.slice(0, 8)}`;

      if (template?.type === 'DOCKER' || (!template && project?.dockerImage)) {
        deployScript = this.generateDockerDeployScript(
          projectName,
          deploymentId,
          template,
          domain,
          isCustomDomain,
          dto,
          project,
        );
      } else if (template?.type === 'STATIC') {
        deployScript = this.generateStaticDeployScript(
          projectName,
          deploymentId,
          template,
          repoUrlForClone,
          domain,
          isCustomDomain,
          appDir,
        );
      } else if (template?.type === 'NODE') {
        deployScript = this.generateNodeDeployScript(
          projectName,
          deploymentId,
          template,
          repoUrlForClone,
          domain,
          isCustomDomain,
          appDir,
          serverIp,
        );
      }

      if (deployScript) {
        const output = await this.serversService.executeSshCommand(
          server,
          deployScript,
        );
        await updateLogs(output);

        if (output.includes('Deployment successful!')) {
          await this.prisma.deployment.update({
            where: { id: deploymentId },
            data: { status: 'completed' },
          });
          await updateLogs('Status: COMPLETED');
        } else {
          throw new Error('Deployment script failed to complete successfully.');
        }
      } else {
        throw new Error('No deployment script generated. Check configuration.');
      }
    } catch (error: any) {
      await updateLogs(`\n!!! DEPLOYMENT FAILED !!!\nError: ${error.message}`);
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'failed' },
      });
    }
  }

  private generateDockerDeployScript(
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
    return `
echo "[1/4] Pulling Docker image ${imageName}..."
sudo docker pull ${imageName} || { echo "Failed to pull image"; exit 1; }

echo "[2/4] Starting container ${containerName}..."
sudo docker rm -f ${containerName} 2>/dev/null || true
CONTAINER_ID=$(sudo docker run -d --name ${containerName} --restart always -p 127.0.0.1:8080:${port} ${imageName}) || { echo "Failed to start container"; exit 1; }

echo "[3/4] Configuring Nginx reverse proxy for ${domain}..."
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

${this.generateSslScript(domain, isCustomDomain)}

echo "Deployment successful!"
`;
  }

  private generateStaticDeployScript(
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
echo "[1/4] Cloning repository..."
sudo mkdir -p ${appDir}
sudo rm -rf ${appDir}/* 2>/dev/null || true
  sudo git clone ${repositoryUrl} ${appDir} || { echo "Git clone failed"; exit 1; }

cd ${appDir}
${installCmd ? `echo "Installing dependencies..."; sudo ${installCmd} || { echo "Install failed"; exit 1; }` : ''}
${buildCmd ? `echo "Building project..."; sudo ${buildCmd} || { echo "Build failed"; exit 1; }` : ''}

echo "[2/4] Configuring Nginx for static site at ${domain}..."
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

${this.generateSslScript(domain, isCustomDomain)}

echo "Deployment successful!"
`;
  }

  private generateNodeDeployScript(
    projectName: string,
    deploymentId: string,
    template: Template | null,
    repositoryUrl: string,
    domain: string,
    isCustomDomain: boolean,
    appDir: string,
    serverIp: string,
  ): string {
    const sanitized = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const pm2Name = `vpshub-${sanitized}-${deploymentId.slice(0, 6)}`;

    const port = 3000 + (parseInt(deploymentId.slice(0, 4), 16) % 1000);

    return `
set -e

echo "[1/6] Cloning repository..."
sudo mkdir -p ${appDir}
sudo rm -rf ${appDir}/* 2>/dev/null || true
sudo git clone ${repositoryUrl} ${appDir} || { echo "Git clone failed"; exit 1; }

cd ${appDir}

echo "[2/6] Installing dependencies..."
sudo npm install --legacy-peer-deps || { echo "Install failed"; exit 1; }

echo "[3/6] Building application..."
if [ -f "package.json" ] && grep -q "\"build\":" package.json; then
  sudo npm run build || { echo "Build failed"; exit 1; }
else
  echo "No build script found. Skipping build."
fi

echo "[4/6] Starting application with PM2 on port ${port}..."
sudo pm2 delete ${pm2Name} 2>/dev/null || true

if [ -f "node_modules/.bin/next" ]; then
  sudo pm2 start node_modules/.bin/next --name ${pm2Name} -- start -p ${port}
else
  sudo PORT=${port} pm2 start npm --name ${pm2Name} -- start
fi

sudo pm2 save

sleep 5

if ! sudo ss -tuln | grep -q ":${port}"; then
  echo "Application failed to bind to port ${port}"
  sudo pm2 logs ${pm2Name} --lines 20
  exit 1
fi

echo "[5/6] Cleaning old nginx configs..."
sudo grep -rl "server_name ${serverIp}.nip.io" /etc/nginx/sites-available 2>/dev/null | xargs -r sudo rm -f || true
sudo grep -rl "server_name ${serverIp}.nip.io" /etc/nginx/sites-enabled 2>/dev/null | xargs -r sudo rm -f || true

echo "[6/6] Configuring Nginx reverse proxy for ${domain}..."

sudo cat <<EOF > /etc/nginx/sites-available/vpshub-${sanitized}-${deploymentId}
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
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

${this.generateSslScript(domain, isCustomDomain, 6)}

echo "Deployment successful!"
`;
  }

  private generateSslScript(
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

  async findAll(userId: string) {
    return this.prisma.deployment.findMany({
      where: {
        server: { userId },
      },
      include: { server: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!deployment || deployment.server.userId !== userId) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  async remove(userId: string, id: string) {
    const deployment = await this.findOne(userId, id);
    const server = await this.prisma.server.findUnique({
      where: { id: deployment.serverId },
    });

    if (!server) throw new NotFoundException('Associated server not found');

    let template: Template | null = null;
    if (deployment.templateId) {
      template = await this.prisma.template.findUnique({
        where: { id: deployment.templateId },
      });
    }

    // Cleanup script
    let cleanupScript = `
echo "Starting cleanup for deployment ${id}..."
# 1. Remove Nginx configuration
  # Remove all nginx configs for this project (match by sanitized project name)
  SANITIZED_NAME="${id}" # placeholder will be replaced below
  sudo ls /etc/nginx/sites-available 2>/dev/null | grep "vpshub-" | grep -i "${id.slice(0, 8)}" >/dev/null 2>&1 || true
  sudo rm -f /etc/nginx/sites-available/vpshub-${id} 2>/dev/null || true
  sudo rm -f /etc/nginx/sites-enabled/vpshub-${id} 2>/dev/null || true
  sudo nginx -t && sudo systemctl reload nginx || true

# 2. Specific cleanup based on template
`;

    if (template?.type === 'DOCKER') {
      const containerName = `vpshub-*${id.slice(0, 5)}*`; // Pattern match
      cleanupScript += `
echo "Stopping and removing Docker containers..."
sudo docker ps -a --filter "name=vpshub-" | grep "${id.slice(0, 5)}" | awk '{print $1}' | xargs -r sudo docker rm -f || true
`;
    } else if (template?.type === 'NODE') {
      const pm2Name = `vpshub-${id.slice(0, 8)}`;
      cleanupScript += `
echo "Stopping and deleting PM2 process..."
sudo pm2 delete ${pm2Name} 2>/dev/null || true
sudo pm2 save
`;
    }

    cleanupScript += `
# 3. Remove application files
echo "Deleting application files..."
sudo rm -rf /var/www/vpshub-apps/*-${id.slice(0, 8)}
echo "Cleanup completed."
`;

    // Execute cleanup via SSH
    try {
      // Attempt to determine project name for broader cleanup
      const project = deployment.projectId
        ? await this.prisma.project.findUnique({
            where: { id: deployment.projectId },
          })
        : null;
      const sanitized =
        project?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
        id.slice(0, 8);

      // Build a broader cleanup script that removes any nginx site files matching the sanitized project name
      const broaderCleanup = `
echo "Starting cleanup for project ${sanitized}..."
sudo ls /etc/nginx/sites-available 2>/dev/null | grep "vpshub-${sanitized}-" | xargs -r -I{} sudo rm -f /etc/nginx/sites-available/{} || true
sudo ls /etc/nginx/sites-enabled 2>/dev/null | grep "vpshub-${sanitized}-" | xargs -r -I{} sudo rm -f /etc/nginx/sites-enabled/{} || true
# Remove certbot certificates that reference domains inside these configs
for cfg in $(ls /etc/nginx/sites-available | grep "vpshub-${sanitized}-" 2>/dev/null || true); do
  server_name=$(sudo grep -h "server_name" /etc/nginx/sites-available/$cfg 2>/dev/null | awk '{print $2}' | head -n1)
  if [ -n "$server_name" ]; then
    sudo certbot delete --cert-name "$server_name" --non-interactive || true
  fi
done
sudo nginx -t && sudo systemctl reload nginx || true
`;

      await this.serversService.executeSshCommand(server, broaderCleanup);
    } catch (error) {
      console.error(`Cleanup failed for deployment ${id}:`, error);
      // We continue with DB deletion even if SSH cleanup fails to prevent staleness
    }

    return this.prisma.deployment.delete({
      where: { id },
    });
  }
}
