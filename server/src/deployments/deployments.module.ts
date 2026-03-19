import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { ServersModule } from '../servers/servers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DeploymentLogsGateway } from './deployment-logs.gateway';
import { DeploymentScriptsService } from './deployment-scripts.service';
import { AuthModule } from '../auth/auth.module';
import { DeploymentQueueService } from './deployment-queue.service';

@Module({
  imports: [PrismaModule, ServersModule, AuthModule],
  controllers: [DeploymentsController],
  providers: [
    DeploymentsService,
    DeploymentLogsGateway,
    DeploymentScriptsService,
    DeploymentQueueService,
  ],
  exports: [
    DeploymentsService,
    DeploymentScriptsService,
    DeploymentQueueService,
  ],
})
export class DeploymentsModule {}
