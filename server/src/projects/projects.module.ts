import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ServersModule } from '../servers/servers.module';
import { DeploymentsModule } from '../deployments/deployments.module';

@Module({
  imports: [PrismaModule, ServersModule, DeploymentsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
