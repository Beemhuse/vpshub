import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { Deployment, Project, Server, Template } from '@prisma/client';
import { DeploymentScriptsService } from './deployment-scripts.service';
import {
  DeploymentQueueService,
  DeploymentTask,
} from './deployment-queue.service';
import { DeploymentLogsGateway } from './deployment-logs.gateway';

@Injectable()
export class DeploymentsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
    private deploymentScripts: DeploymentScriptsService,
    private deploymentQueue: DeploymentQueueService,
    private logsGateway: DeploymentLogsGateway,
  ) {}

  private readonly logger = new Logger('DockerDeployment');

  onModuleInit() {
    this.deploymentQueue.setWorker(async (task) => {
      await this.processDeploymentTask(task);
    });
  }

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

    // Determine name early to ensure consistency
    const extractedName = this.extractProjectNameFromRepo(dto.repositoryUrl) || dto.name || 'Untitled Project';

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

      // If project has a generic name and we have a better one from repo, update it
      if ((project.name === 'Untitled Project' || project.name.includes('docker-compose')) && extractedName !== 'Untitled Project') {
        await this.prisma.project.update({
          where: { id: project.id },
          data: { name: extractedName }
        });
        project.name = extractedName;
      }
    } else {
      // Determine project type from template
      let projectType = 'static';
      if (dto.templateId) {
        const selectedTemplate = await this.prisma.template.findUnique({
          where: { id: dto.templateId },
        });
        if (selectedTemplate?.type === 'DOCKER') projectType = 'docker';
        else if (selectedTemplate?.type === 'NODE') projectType = 'node';
      }

      // Create a new project on the fly for this deployment
      project = await this.prisma.project.create({
        data: {
          name: extractedName,
          user: { connect: { id: userId } },
          server: { connect: { id: dto.serverId } },
          type: projectType,
          env: dto.env,
          serviceDomains: dto.serviceDomains,
          rootDir: dto.rootDir,
          buildCmd: dto.buildCmd,
          installCmd: dto.installCmd,
          startCmd: dto.startCmd,
          exposedPort: dto.exposedPort ? Number(dto.exposedPort) : null,
          repositoryUrl: dto.repositoryUrl,
        } as any,
      });
    }

    // Update project config if provided in deployment
    const updateData: any = {};
    if (dto.env && JSON.stringify(dto.env) !== JSON.stringify((project as any).env))
      updateData.env = dto.env;
    if (dto.rootDir) updateData.rootDir = dto.rootDir;
    if (dto.buildCmd) updateData.buildCmd = dto.buildCmd;
    if (dto.installCmd) updateData.installCmd = dto.installCmd;
    if (dto.startCmd) updateData.startCmd = dto.startCmd;
    if (dto.exposedPort) updateData.exposedPort = Number(dto.exposedPort);
    if (dto.serviceDomains) updateData.serviceDomains = dto.serviceDomains;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: updateData,
      });
      Object.assign(project, updateData);
    }

    // Ensure repositoryUrl is persisted if provided
    if (dto.repositoryUrl && !project.repositoryUrl) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { repositoryUrl: dto.repositoryUrl },
      });
      project.repositoryUrl = dto.repositoryUrl;
    }

    let template: Template | null = null;
    if (dto.templateId) {
      template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });
      if (template?.type === 'DOCKER' && project.type !== 'docker') {
        await this.prisma.project.update({
          where: { id: project.id },
          data: { type: 'docker' },
        });
        project.type = 'docker';
      }
    }

    if (!template) {
      const templateId = project.type === 'docker' ? 'docker-image' : 'static-html';
      template = await this.prisma.template.findUnique({
        where: { id: templateId },
      });
      if (!template) throw new NotFoundException('Default template not found');
    }

    // Compute assigned domain
    const baseDomain = (server as any).domain || `${server.ip}.nip.io`;
    const domainPrefix = (extractedName || project.name).toLowerCase().replace(/[^a-z0-9]/g, '-');
    const assignedDomain = dto.domain || `${domainPrefix}.${baseDomain}`;

    // Ensure project stores its domain
    if (!project.domain) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { domain: assignedDomain },
      });
      project.domain = assignedDomain;
    }

    // Persist deployment
    const deployment = await this.prisma.deployment.create({
      data: {
        serverId: dto.serverId,
        projectId: project.id,
        templateId: template?.id,
        repositoryUrl: dto.repositoryUrl || project.repositoryUrl,
        status: 'pending',
        logs: 'Deployment queued...\n',
        domain: assignedDomain,
        serviceDomains: (dto.serviceDomains as any) || (project as any).serviceDomains || {},
        env: (dto.env as any) || (project as any).env || {},
        rootDir: dto.rootDir || (project as any).rootDir,
        buildCmd: dto.buildCmd || (project as any).buildCmd,
        installCmd: dto.installCmd || (project as any).installCmd,
        startCmd: dto.startCmd || (project as any).startCmd,
        exposedPort: dto.exposedPort || (project as any).exposedPort,
      } as any,
    });

    await this.deploymentQueue.add({
      id: deployment.id,
      deploymentId: deployment.id,
      serverId: server.id,
      userId,
    });

    return deployment;
  }

  private async processDeploymentTask(task: DeploymentTask): Promise<void> {
    const deployment: any = await this.prisma.deployment.findUnique({
      where: { id: task.deploymentId },
      include: { server: true, project: true },
    });

    if (!deployment) return;

    let logs = deployment.logs || '';
    const updateLogs = async (chunk: string) => {
      logs += chunk;
      this.logsGateway.emitLog(deployment.id, chunk);
      try {
        const exists = await this.prisma.deployment.findUnique({
          where: { id: deployment.id },
          select: { id: true },
        });
        if (exists) {
          await this.prisma.deployment.update({
            where: { id: deployment.id },
            data: { logs },
          });
        }
      } catch (error) {
        if (error.code !== 'P2025') console.error('Failed to update deployment logs:', error);
      }
    };

    try {
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'in-progress' },
      });

      await updateLogs(`\n--- Starting Deployment Processing ---\n`);

      const server = deployment.server;
      const project = deployment.project;
      const templateId = deployment.templateId;

      const template = templateId
        ? await this.prisma.template.findUnique({
            where: { id: templateId },
          })
        : null;

      const projectName = project?.name || 'Unknown Project';

      // Prepare repository URL with token correctly
      let repoUrlForClone = deployment.repositoryUrl || '';
      if (repoUrlForClone && task.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: task.userId },
        });
        const token = user?.githubAccessToken;
        if (token && repoUrlForClone.startsWith('https://github.com')) {
          repoUrlForClone = repoUrlForClone.replace('https://', `https://${token}@`);
        }
      }

      const realProjectName = this.extractProjectNameFromRepo(deployment.repositoryUrl || project?.repositoryUrl) || projectName;
      const sanitizedProjectName = realProjectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const domain = deployment.domain || `${server.ip}.nip.io`;
      const appDir = `/opt/vpshub/apps/${sanitizedProjectName}`;

      const dto: any = {
        env: deployment.env as any,
        domain: deployment.domain,
        serviceDomains: (deployment.serviceDomains as any) || (project as any)?.serviceDomains || {},
        repositoryUrl: deployment.repositoryUrl,
        rootDir: deployment.rootDir,
        buildCmd: deployment.buildCmd,
        installCmd: deployment.installCmd,
        startCmd: deployment.startCmd,
        exposedPort: deployment.exposedPort,
      };

      let deployScript = '';
      if (template?.type === 'DOCKER' || (!template && project?.type === 'docker')) {
        deployScript = this.deploymentScripts.generateDockerDeployScript(
          projectName,
          deployment.id,
          template as any,
          domain,
          !!deployment.domain,
          dto,
          project as any,
        );
      } else if (template?.type === 'STATIC') {
        deployScript = this.deploymentScripts.generateStaticDeployScript(
          projectName,
          deployment.id,
          template as any,
          repoUrlForClone,
          domain,
          !!deployment.domain,
          appDir,
          dto,
        );
      } else if (template?.type === 'NODE') {
        deployScript = this.deploymentScripts.generateNodeDeployScript(
          projectName,
          deployment.id,
          template as any,
          repoUrlForClone,
          domain,
          !!deployment.domain,
          appDir,
          server.sshUser || 'root',
          dto,
        );
      }

      if (!deployScript) throw new Error('Could not generate deployment script.');

      await updateLogs(`Executing deployment script on ${server.name}...\n`);

      const output = await this.serversService.executeSshScript(
        server,
        deployScript,
        async (chunk) => {
          await updateLogs(chunk);
          chunk.split('\n').filter(l => l.trim()).forEach(line => this.logger.log(`  [SSH] ${line.trim()}`));
        },
      );

      if (output.includes('--- Docker Deployment Successful ---') || output.includes('Deployment successful!')) {
        await this.prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'completed' },
        });
        await updateLogs('\nDeployment status: COMPLETED\n');
      } else {
        throw new Error('Deployment script execution ended without success confirmation.');
      }
    } catch (error: any) {
      this.logger.error(`❌ DEPLOYMENT FAILED [${task.deploymentId}]: ${error.message}`);
      await updateLogs(`\n!!! DEPLOYMENT ERROR: ${error.message} !!!\n`);
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async findAll(userId: string, serverId?: string) {
    return this.prisma.deployment.findMany({
      where: {
        server: { userId },
        ...(serverId ? { serverId } : {}),
      },
      include: { server: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { server: true, project: true },
    });
    if (!deployment || deployment.server.userId !== userId) throw new NotFoundException('Deployment not found');
    return deployment;
  }

  async getDockerServices(userId: string, id: string) {
    const deployment = await this.getDockerDeploymentContext(userId, id);
    const projectName = deployment.project?.name || 'unknown-project';
    const realProjectName = this.extractProjectNameFromRepo(deployment.repositoryUrl || deployment.project?.repositoryUrl) || projectName;
    const composeProjectName = this.deploymentScripts.getDockerComposeProjectName(realProjectName, deployment.id);

    const command = `
COMPOSE_PROJECT_NAME="${composeProjectName}"
# Modern VPSHub labels
COMPOSE_LINES=$(sudo docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Label "com.docker.compose.service"}}')

if [ -z "$COMPOSE_LINES" ]; then
  # Fallback for variant naming
  COMPOSE_LINES=$(sudo docker ps -a --filter "name=$COMPOSE_PROJECT_NAME" --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Label "com.docker.compose.service"}}')
fi

if [ -z "$COMPOSE_LINES" ]; then
  # Extreme fallback: look for containers containing the project name
  CLEAN_NAME=$(echo "$COMPOSE_PROJECT_NAME" | sed 's/-//g')
  COMPOSE_LINES=$(sudo docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.Label "com.docker.compose.service"}}' | grep -iE "$COMPOSE_PROJECT_NAME|$CLEAN_NAME" | grep -v "traefik")
fi

if [ -n "$COMPOSE_LINES" ]; then
  printf "%s\\n" "$COMPOSE_LINES"
fi
`;

    const output = await this.serversService.executeSshCommand(deployment.server, command);
    if (!output.trim()) return [];

    return output.trim().split('\n').map((line) => {
      const [id, name, image, status, ports, service] = line.split('|');
      let serviceName = service;
      if (!serviceName || serviceName === "" || serviceName === name) {
        serviceName = name.replace(composeProjectName, '').replace(/^[-_]+/, '').replace(/[-_]+[0-9]+$/, '');
        if (!serviceName) serviceName = 'app';
      }
      
      const connectionUrl = this.inferConnectionUrl(serviceName, image, (deployment.env as any) || {});
      const resolvedServiceDomains = ((deployment as any).serviceDomains || {}) as Record<string, string>;

      return {
        id,
        name,
        image,
        status,
        ports,
        service: serviceName,
        connectionUrl,
        isRunning: status?.toLowerCase().includes('up'),
        domain: resolvedServiceDomains[serviceName] || (deployment.domain ? `${serviceName}.${deployment.domain}` : undefined),
      };
    }).filter(e => e.id && e.name).sort((a, b) => a.service.localeCompare(b.service));
  }

  async getDockerServiceLogs(userId: string, id: string, service: string, tail: number = 200) {
    const deployment = await this.getDockerDeploymentContext(userId, id);
    const services = await this.getDockerServices(userId, id);
    const target = services.find(e => e.service === service || e.name === service);
    if (!target) throw new NotFoundException('Docker service not found');

    const safeTail = Math.min(Math.max(Math.trunc(tail), 20), 1000);
    const logs = await this.serversService.executeSshCommand(deployment.server, `sudo docker logs --tail ${safeTail} ${target.name} 2>&1 || true`);

    return { service: target.service, containerName: target.name, logs };
  }

  async reconfigureDockerDeployment(userId: string, id: string, updateDto: any) {
    const deployment = await this.getDockerDeploymentContext(userId, id);
    const projectName = deployment.project?.name || 'unknown-project';
    const baseDomain = (deployment.server as any).domain || `${deployment.server.ip}.nip.io`;
    const fallbackDomain = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${baseDomain}`;
    const nextDomain = typeof updateDto?.domain === 'string' && updateDto.domain.trim() ? updateDto.domain.trim() : deployment.domain || deployment.project?.domain || fallbackDomain;

    const nextDto: CreateDeploymentDto = {
      serverId: deployment.serverId,
      projectId: deployment.projectId || undefined,
      domain: nextDomain,
      repositoryUrl: updateDto?.repositoryUrl || deployment.repositoryUrl || deployment.project?.repositoryUrl || undefined,
      dockerImage: updateDto?.dockerImage || deployment.project?.dockerImage || undefined,
      buildCmd: updateDto?.buildCmd || deployment.buildCmd || deployment.project?.buildCmd || undefined,
      rootDir: updateDto?.rootDir || deployment.rootDir || deployment.project?.rootDir || undefined,
      exposedPort: updateDto?.exposedPort || deployment.exposedPort || deployment.project?.exposedPort || undefined,
      env: updateDto?.env || (deployment.env as any) || (deployment.project?.env as any),
      serviceDomains: updateDto?.serviceDomains || (deployment as any).serviceDomains || (deployment.project as any)?.serviceDomains,
    };

    const script = this.deploymentScripts.generateDockerReconfigureScript(projectName, deployment.id, nextDomain, nextDto, deployment.project as any);
    const output = await this.serversService.executeSshScript(deployment.server, script);

    const appendedLogs = `${deployment.logs}\n--- Docker Reconfiguration Applied ---\n${output}\n`.trimStart();
    const updated = await this.prisma.deployment.update({
      where: { id: deployment.id },
      data: {
        domain: nextDomain,
        serviceDomains: nextDto.serviceDomains || {},
        env: nextDto.env || {},
        rootDir: nextDto.rootDir,
        buildCmd: nextDto.buildCmd,
        exposedPort: nextDto.exposedPort,
        logs: appendedLogs,
      } as any,
      include: { server: true, project: true },
    });

    return { success: true, deployment: updated };
  }

  async remove(userId: string, id: string) {
    const deployment = await this.findOne(userId, id);
    const server = await this.prisma.server.findUnique({ where: { id: deployment.serverId } });
    if (!server) throw new NotFoundException('Associated server not found');

    const projectName = (deployment.project as any)?.name || 'unknown-project';
    const cleanupScript = this.deploymentScripts.generateCleanupScript(projectName, [id]);
    try {
      await this.serversService.executeSshScript(server, cleanupScript);
    } catch (e) {
      this.logger.error(`Cleanup failed for ${id}: ${e.message}`);
    }

    await this.prisma.deployment.delete({ where: { id } });
    return { success: true };
  }

  private async getDockerDeploymentContext(userId: string, id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { server: true, project: true },
    });
    if (!deployment || deployment.server.userId !== userId) throw new NotFoundException('Deployment not found');
    if (deployment.server.connectionStatus !== 'CONNECTED') throw new BadRequestException('Server is not connected yet');
    return deployment;
  }

  async restartDockerService(userId: string, id: string, serviceName: string) {
    const deployment = await this.getDockerDeploymentContext(userId, id);
    const composeProjectName = this.deploymentScripts.getDockerComposeProjectName(deployment.project?.name || 'unknown', deployment.id);
    const output = await this.serversService.executeSshCommand(deployment.server, `sudo docker compose -p "${composeProjectName}" restart "${serviceName}" || sudo docker-compose -p "${composeProjectName}" restart "${serviceName}"`);
    return { success: true, output };
  }

  private inferConnectionUrl(serviceName: string, image: string, env: any): string | undefined {
    const s = serviceName.toLowerCase();
    const img = image.toLowerCase();
    if (s.includes('postgres') || s.includes('pg') || img.includes('postgres')) {
        return `postgresql://${env.POSTGRES_USER || 'admin'}:${env.POSTGRES_PASSWORD || 'password'}@${serviceName}:5432/${env.POSTGRES_DB || 'postgres'}`;
    }
    if (s.includes('redis') || img.includes('redis')) {
        return `redis://${env.REDIS_PASSWORD ? `:${env.REDIS_PASSWORD}@` : ''}${serviceName}:6379`;
    }
    if (s.includes('mysql') || s.includes('mariadb') || img.includes('mysql') || img.includes('mariadb')) {
        return `mysql://${env.MYSQL_USER || 'root'}:${env.MYSQL_PASSWORD || env.MYSQL_ROOT_PASSWORD || 'password'}@${serviceName}:3306/${env.MYSQL_DATABASE || 'db'}`;
    }
    if (s.includes('mongo') || img.includes('mongo')) {
        const auth = env.MONGO_INITDB_ROOT_USERNAME && env.MONGO_INITDB_ROOT_PASSWORD ? `${env.MONGO_INITDB_ROOT_USERNAME}:${env.MONGO_INITDB_ROOT_PASSWORD}@` : '';
        return `mongodb://${auth}${serviceName}:20717`;
    }
    return undefined;
  }

  private extractProjectNameFromRepo(url?: string | null): string | null {
    if (!url) return null;
    try {
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      return lastPart ? lastPart.replace(/\.git$/, '') : null;
    } catch (e) { return null; }
  }

  async getAllServerContainers(serverId: string): Promise<any[]> {
    const server = await this.prisma.server.findUnique({ where: { id: serverId } });
    if (!server) return [];
    try {
      const output = await this.serversService.executeSshCommand(server, `sudo docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.Labels}}"`);
      if (!output) return [];
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [id, name, status, image, ports, labels] = line.split('|');
        return { id, name, status, image, ports, labels };
      });
    } catch (e) { return []; }
  }
}
