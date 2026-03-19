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
      // Determine project type from template if available
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
          name: dto.name || 'Untitled Project',
          user: { connect: { id: userId } },
          server: { connect: { id: dto.serverId } },
          type: projectType,
          env: dto.env,
          rootDir: dto.rootDir,
          buildCmd: dto.buildCmd,
          installCmd: dto.installCmd,
          startCmd: dto.startCmd,
          exposedPort: dto.exposedPort ? Number(dto.exposedPort) : null,
        } as any,
      });
    }

    // Update project config if provided in deployment
    const updateData: any = {};
    if (
      dto.env &&
      JSON.stringify(dto.env) !== JSON.stringify((project as any).env)
    )
      updateData.env = dto.env;
    if (dto.rootDir) updateData.rootDir = dto.rootDir;
    if (dto.buildCmd) updateData.buildCmd = dto.buildCmd;
    if (dto.installCmd) updateData.installCmd = dto.installCmd;
    if (dto.startCmd) updateData.startCmd = dto.startCmd;
    if (dto.exposedPort) updateData.exposedPort = Number(dto.exposedPort);

    if (Object.keys(updateData).length > 0) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: updateData,
      });
      Object.assign(project, updateData);
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
      // If template is DOCKER, ensure project type reflects this
      if (template?.type === 'DOCKER' && project.type !== 'docker') {
        console.log('Updating project type to docker');
        await this.prisma.project.update({
          where: { id: project.id },
          data: { type: 'docker' },
        });
        project.type = 'docker';
      }
    }

    if (!template) {
      const templateId =
        project.type === 'docker' ? 'docker-image' : 'static-html';
      template = await this.prisma.template.findUnique({
        where: { id: templateId },
      });
      if (!template) throw new NotFoundException('Default template not found');
    }

    // Compute assigned domain
    const baseDomain = (server as any).domain || `${server.ip}.nip.io`;
    const assignedDomain =
      dto.domain ||
      `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${baseDomain}`;

    // Ensure project stores its domain
    if (!project.domain) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { domain: assignedDomain },
      });
      project.domain = assignedDomain;
    }

    // Persist deployment with assigned domain immediately
    const deployment = await this.prisma.deployment.create({
      data: {
        serverId: dto.serverId,
        projectId: project.id,
        templateId: template?.id,
        repositoryUrl: dto.repositoryUrl || (project as any).repositoryUrl,
        status: 'pending',
        logs: 'Deployment queued...\n',
        domain: assignedDomain,
        env: (dto.env as any) || (project as any).env || {},
        rootDir: dto.rootDir || (project as any).rootDir,
        buildCmd: dto.buildCmd || (project as any).buildCmd,
        installCmd: dto.installCmd || (project as any).installCmd,
        startCmd: dto.startCmd || (project as any).startCmd,
        exposedPort: dto.exposedPort || (project as any).exposedPort,
      } as any,
    });

    // Add to queue for processing
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
        // Check if deployment still exists before updating
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
        // If it's a P2025 (Record to update not found), we can safely ignore it as it means the deployment was deleted
        if (error.code !== 'P2025') {
          console.error('Failed to update deployment logs:', error);
        }
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

      const isDockerDeploy =
        template?.type === 'DOCKER' ||
        (!template && project?.type === 'docker');

      const projectName = project?.name || template?.name || 'Unknown Project';

      if (isDockerDeploy) {
        this.logger.log(`╔══════════════════════════════════════════════════╗`);
        this.logger.log(`║   🐳 DOCKER DEPLOYMENT STARTED                   ║`);
        this.logger.log(`╚══════════════════════════════════════════════════╝`);
        this.logger.log(`  Project    : ${projectName}`);
        this.logger.log(`  Deploy ID  : ${deployment.id}`);
        this.logger.log(`  Template   : ${template?.name || 'Inferred (docker)'}`);
        this.logger.log(`  Repo       : ${deployment.repositoryUrl || 'N/A (image-based)'}`);
        this.logger.log(`  Domain     : ${deployment.domain || 'Auto-assigned'}`);
        this.logger.log(`  Server     : ${server.name} (${server.ip})`);
        this.logger.log(`──────────────────────────────────────────────────`);
      }

      // Prepare repository URL with token if needed
      let repoUrlForClone = deployment.repositoryUrl || '';
      if (repoUrlForClone && task.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: task.userId },
        });
        const token = user?.githubAccessToken;
        if (token && repoUrlForClone.startsWith('https://github.com')) {
          repoUrlForClone = repoUrlForClone.replace(
            'https://',
            `https://${token}@`,
          );
        }
      }

      const sanitizedProjectName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const domain = deployment.domain || `${server.ip}.nip.io`;
      const appDir = `/var/www/vpshub-apps/${sanitizedProjectName}-${deployment.id.slice(0, 8)}`;

      // Generate script
      let deployScript = '';
      const dto: any = {
        env: deployment.env as any,
        domain: deployment.domain,
        repositoryUrl: deployment.repositoryUrl,
        rootDir: deployment.rootDir,
        buildCmd: deployment.buildCmd,
        installCmd: deployment.installCmd,
        startCmd: deployment.startCmd,
        exposedPort: deployment.exposedPort,
      };

      if (
        template?.type === 'DOCKER' ||
        (!template && project?.type === 'docker')
      ) {
        this.logger.log(`[STEP 1/3] Generating Docker deployment script...`);
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

      if (!deployScript) {
        throw new Error('Could not generate deployment script.');
      }

      await updateLogs(`Executing deployment script on ${server.name}...\n`);

      const isDocker =
        template?.type === 'DOCKER' ||
        (!template && project?.type === 'docker');

      if (isDocker) {
        this.logger.log(`[STEP 2/3] Uploading and executing script on server via SSH...`);
      }

      const output = await this.serversService.executeSshScript(
        server,
        deployScript,
        async (chunk) => {
          await updateLogs(chunk);
          // Mirror Docker deployment SSH output to NestJS console in real-time
          if (isDocker) {
            chunk
              .split('\n')
              .filter((l) => l.trim())
              .forEach((line) => this.logger.log(`  [SSH] ${line.trim()}`));
          }
        },
      );

      if (isDocker) {
        this.logger.log(`[STEP 3/3] Verifying deployment success...`);
      }

      if (output.includes('--- Docker Deployment Successful ---') || output.includes('Deployment successful!')) {
        await this.prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'completed' },
        });
        await updateLogs('\nDeployment status: COMPLETED\n');
        if (isDocker) {
          this.logger.log(`╔══════════════════════════════════════════════════╗`);
          this.logger.log(`║   ✅ DOCKER DEPLOYMENT COMPLETED SUCCESSFULLY    ║`);
          this.logger.log(`╚══════════════════════════════════════════════════╝`);
          this.logger.log(`  Deploy ID : ${deployment.id}`);
          this.logger.log(`  Domain    : ${deployment.domain}`);
        }
      } else {
        throw new Error(
          'Deployment script execution ended without success confirmation.',
        );
      }
    } catch (error: any) {
      this.logger.error(`❌ DEPLOYMENT FAILED [${task.deploymentId}]: ${error.message}`);
      await updateLogs(`\n!!! DEPLOYMENT ERROR: ${error.message} !!!\n`);
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: 'failed' },
      });
      throw error; // Re-throw for retry logic in queue
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

    // Cleanup logic (simplified for brevity)
    await this.prisma.deployment.delete({ where: { id } });
    return { success: true };
  }
}
