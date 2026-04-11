import { Injectable, NotFoundException } from '@nestjs/common';
import { ServersService } from '../servers/servers.service';
import { DeploymentScriptsService } from '../deployments/deployment-scripts.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
    private deploymentScripts: DeploymentScriptsService,
    private deploymentsService: DeploymentsService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: string, serverId?: string) {
    return this.prisma.project.findMany({
      where: {
        userId,
        ...(serverId ? { serverId } : {}),
      },
      include: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { deployments: { orderBy: { createdAt: 'desc' } } },
    });

    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(userId: string, id: string, dto: any) {
    const project = await this.findOne(userId, id);
    const latestDeployment = project.deployments?.[0];
    const shouldApplyDockerConfig =
      project.type === 'docker' &&
      !!latestDeployment &&
      [
        'domain',
        'env',
        'rootDir',
        'buildCmd',
        'repositoryUrl',
        'exposedPort',
        'dockerImage',
        'serviceDomains',
      ].some((key) => Object.prototype.hasOwnProperty.call(dto, key));

    if (shouldApplyDockerConfig) {
      await this.deploymentsService.reconfigureDockerDeployment(
        userId,
        latestDeployment.id,
        {
          ...project,
          ...dto,
          env: dto.env ?? project.env ?? undefined,
        },
      );
    }

    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { deployments: true, server: true },
    });

    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    // Identify all unique servers where this project has deployments
    const serverIds = new Set<string>();
    if (project.serverId) serverIds.add(project.serverId);
    project.deployments.forEach((d) => serverIds.add(d.serverId));

    const deploymentIds = project.deployments.map((d) => d.id);

    // Perform cleanup on each server asynchronously
    for (const serverId of serverIds) {
      try {
        const server = await this.prisma.server.findUnique({
          where: { id: serverId },
        });
        if (server && server.connectionStatus === 'CONNECTED') {
          const cleanupScript = this.deploymentScripts.generateCleanupScript(
            project.name,
            deploymentIds,
          );
          // Run cleanup on VPS (fire and forget for now, or we can wait)
          this.serversService
            .executeSshScript(server, cleanupScript)
            .catch((err) =>
              console.error(
                `Cleanup failed on server ${server.ip}: ${err.message}`,
              ),
            );
        }
      } catch (err) {
        console.error(
          `Error during cleanup for server ${serverId}: ${err.message}`,
        );
      }
    }

    // Now delete from DB
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
