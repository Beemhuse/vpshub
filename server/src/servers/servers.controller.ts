import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import {
  CreateServerDto,
  UpdateServerDto,
  ServerActionDto,
  ConnectServerDto,
  RegisterAgentDto,
  ServerStatsDto,
  TerminalCommandDto,
} from './dto/server.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Servers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new server' })
  @ApiResponse({ status: 201, description: 'Server created successfully' })
  create(@Req() req, @Body() createServerDto: CreateServerDto) {
    return this.serversService.create(req.user.id, createServerDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all servers' })
  findAll(@Req() req) {
    return this.serversService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get server details' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.serversService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update server information' })
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateServerDto: UpdateServerDto,
  ) {
    return this.serversService.update(req.user.id, id, updateServerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a server' })
  remove(@Req() req, @Param('id') id: string) {
    return this.serversService.remove(req.user.id, id);
  }

  @Post(':id/actions')
  @ApiOperation({
    summary: 'Perform an action on a server (start, stop, etc.)',
  })
  performAction(
    @Req() req,
    @Param('id') id: string,
    @Body() actionDto: ServerActionDto,
  ) {
    return this.serversService.performAction(req.user.id, id, actionDto.action);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect an existing VPS' })
  connect(@Req() req, @Body() connectDto: ConnectServerDto) {
    return this.serversService.connect(req.user.id, connectDto);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Fetch real-time server statistics and ports via SSH',
  })
  @ApiResponse({ status: 200, type: ServerStatsDto })
  getServerStats(@Req() req: any, @Param('id') id: string) {
    return this.serversService.getServerStats(req.user.id, id);
  }

  @Get(':id/docker')
  getDockerContainers(@Req() req: any, @Param('id') id: string) {
    return this.serversService.getDockerContainers(req.user.id, id);
  }

  @Post(':id/docker/:containerId/:action')
  handleDockerAction(
    @Req() req: any,
    @Param('id') id: string,
    @Param('containerId') containerId: string,
    @Param('action') action: string,
  ) {
    return this.serversService.handleDockerAction(
      req.user.id,
      id,
      containerId,
      action,
    );
  }

  @Post(':id/terminal')
  @ApiOperation({ summary: 'Execute a terminal command on the server via SSH' })
  executeTerminalCommand(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: TerminalCommandDto,
  ) {
    return this.serversService.executeTerminalCommand(
      req.user.id,
      id,
      dto.command,
    );
  }

  @Get(':id/pm2')
  getPm2Processes(@Req() req: any, @Param('id') id: string) {
    return this.serversService.getPm2Processes(req.user.id, id);
  }

  @Post(':id/pm2/:nameOrId/:action')
  handlePm2Action(
    @Req() req: any,
    @Param('id') id: string,
    @Param('nameOrId') nameOrId: string,
    @Param('action') action: string,
  ) {
    return this.serversService.handlePm2Action(
      req.user.id,
      id,
      nameOrId,
      action,
    );
  }

  @Post('register-agent')
  @Public()
  @ApiOperation({ summary: 'Register a server agent (internal)' })
  registerAgent(@Body() registerDto: RegisterAgentDto) {
    return this.serversService.registerAgent(registerDto);
  }
}
