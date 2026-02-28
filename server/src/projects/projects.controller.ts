import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/project.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Req() req, @Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(req.user.id, createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects' })
  findAll(@Req() req, @Param('serverId') serverId?: string) {
    return this.projectsService.findAll(req.user.id, serverId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.projectsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project settings' })
  update(@Req() req, @Param('id') id: string, @Body() updateDto: any) {
    return this.projectsService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  remove(@Req() req, @Param('id') id: string) {
    return this.projectsService.remove(req.user.id, id);
  }
}
