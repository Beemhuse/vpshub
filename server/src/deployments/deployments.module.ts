import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { ServersModule } from '../servers/servers.module';

@Module({
  imports: [ServersModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
})
export class DeploymentsModule {}
