import { Injectable, NotFoundException } from '@nestjs/common';
import { ServersService } from '../servers/servers.service';
import { DeploymentScriptsService } from '../deployments/deployment-scripts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
    private deploymentScripts: DeploymentScriptsService,
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
      include: { deployments: true },
    });

    if (!project || project.userId !== userId) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(userId: string, id: string, dto: any) {
    await this.findOne(userId, id);
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
