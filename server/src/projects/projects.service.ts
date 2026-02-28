import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

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
    await this.findOne(userId, id);
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
