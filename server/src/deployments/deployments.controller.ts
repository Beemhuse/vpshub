import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
  findAll(@Req() req) {
    return this.deploymentsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deployment details and logs' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.deploymentsService.findOne(req.user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a deployment and cleanup server' })
  remove(@Req() req, @Param('id') id: string) {
    return this.deploymentsService.remove(req.user.id, id);
  }
}
