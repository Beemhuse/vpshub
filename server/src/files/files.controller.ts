import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FilesService } from './files.service';
import { FileActionDto, LsFilesDto } from './dto/file.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('ls')
  @ApiOperation({ summary: 'List files in a directory' })
  ls(@Req() req, @Body() dto: LsFilesDto) {
    return this.filesService.ls(req.user.id, dto);
  }

  @Post('action')
  @ApiOperation({ summary: 'Perform a file action (read, delete, move, etc.)' })
  performAction(@Req() req, @Body() dto: FileActionDto) {
    return this.filesService.performAction(req.user.id, dto);
  }
}
