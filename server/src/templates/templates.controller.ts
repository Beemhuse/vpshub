import { Controller, Get, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List available server templates' })
  findAll() {
    return this.templatesService.findAll();
  }
}
