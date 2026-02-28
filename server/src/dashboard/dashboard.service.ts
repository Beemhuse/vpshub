import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const [serverCount, projectCount, activeDeployments] = await Promise.all([
      this.prisma.server.count({ where: { userId } }),
      this.prisma.project.count({ where: { userId } }),
      this.prisma.deployment.count({
        where: {
          server: { userId },
          status: 'in-progress',
        },
      }),
    ]);

    // Mocking some stats for now as requested for frontend connection
    return {
      totalServers: serverCount,
      activeProjects: projectCount,
      runningDeployments: activeDeployments,
      totalUsage: 75, // percentage
      uptime: '99.9%',
    };
  }

  async getActivities(userId: string) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { server: true },
    });
  }
}
