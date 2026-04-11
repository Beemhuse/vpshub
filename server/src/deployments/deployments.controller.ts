import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/deployment.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Deployments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate a new deployment' })
  create(@Req() req, @Body() createDeploymentDto: CreateDeploymentDto) {
    return this.deploymentsService.create(req.user.id, createDeploymentDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all deployments' })
  findAll(@Req() req, @Query('serverId') serverId?: string) {
    return this.deploymentsService.findAll(req.user.id, serverId);
  }

  @Get(':id/docker-services')
  @ApiOperation({ summary: 'List Docker services for a deployment' })
  getDockerServices(@Req() req, @Param('id') id: string) {
    return this.deploymentsService.getDockerServices(req.user.id, id);
  }

  @Post(':id/docker-services/:service/restart')
  @ApiOperation({ summary: 'Restart a Docker service in a deployment' })
  restartDockerService(
    @Req() req,
    @Param('id') id: string,
    @Param('service') service: string,
  ) {
    return this.deploymentsService.restartDockerService(
      req.user.id,
      id,
      service,
    );
  }

  @Get(':id/docker-services/:service/logs')
  @ApiOperation({ summary: 'Get logs for a Docker service in a deployment' })
  getDockerServiceLogs(
    @Req() req,
    @Param('id') id: string,
    @Param('service') service: string,
    @Query('tail') tail?: string,
  ) {
    return this.deploymentsService.getDockerServiceLogs(
      req.user.id,
      id,
      service,
      tail ? Number(tail) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deployment details and logs' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.deploymentsService.findOne(req.user.id, id);
  }

  @Patch(':id/docker-config')
  @ApiOperation({ summary: 'Reconfigure a running Docker deployment' })
  updateDockerConfig(@Req() req, @Param('id') id: string, @Body() updateDto: any) {
    return this.deploymentsService.reconfigureDockerDeployment(
      req.user.id,
      id,
      updateDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a deployment and cleanup server' })
  remove(@Req() req, @Param('id') id: string) {
    return this.deploymentsService.remove(req.user.id, id);
  }
}
