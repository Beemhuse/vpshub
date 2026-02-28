import { Injectable, BadRequestException } from '@nestjs/common';
import { ServersService } from '../servers/servers.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileActionDto, LsFilesDto } from './dto/file.dto';

@Injectable()
export class FilesService {
  constructor(
    private serversService: ServersService,
    private prisma: PrismaService,
  ) {}

  async ls(userId: string, dto: LsFilesDto) {
    const server = await this.prisma.server.findUnique({
      where: { id: dto.serverId },
    });

    if (!server || server.userId !== userId) {
      throw new BadRequestException('Server not found');
    }

    // ls -F adds identifiers (/ for dirs, * for executables, etc.)
    // ls -l gives more details
    const command = `ls -p --group-directories-first "${dto.path}"`;
    const output = await this.serversService.executeSshCommand(server, command);

    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((name) => ({
        name: name.replace(/\/$/, ''),
        isDirectory: name.endsWith('/'),
        path: `${dto.path.endsWith('/') ? dto.path : dto.path + '/'}${name.replace(/\/$/, '')}`,
      }));
  }

  async performAction(userId: string, dto: FileActionDto) {
    const server = await this.prisma.server.findUnique({
      where: { id: dto.serverId },
    });

    if (!server || server.userId !== userId) {
      throw new BadRequestException('Server not found');
    }

    let command = '';
    switch (dto.action) {
      case 'cat':
        command = `cat "${dto.path}"`;
        break;
      case 'rm':
        command = `rm -rf "${dto.path}"`;
        break;
      case 'mkdir':
        command = `mkdir -p "${dto.path}"`;
        break;
      case 'mv':
        if (!dto.destination)
          throw new BadRequestException('Destination required');

        // Protection: Don't allow moving/renaming system files
        const systemPaths = [
          '/etc',
          '/usr',
          '/bin',
          '/sbin',
          '/boot',
          '/var/log',
          '/root',
        ];
        if (
          systemPaths.some(
            (p) =>
              dto.path.startsWith(p) ||
              (dto.destination && dto.destination.startsWith(p)),
          )
        ) {
          throw new BadRequestException(
            'Action denied: Touching system paths is restricted to terminal.',
          );
        }

        command = `mv "${dto.path}" "${dto.destination}"`;
        break;
      case 'write':
        if (dto.content === undefined)
          throw new BadRequestException('Content required');
        // Use base64 to avoid shell escaping issues
        const base64Content = Buffer.from(dto.content).toString('base64');
        command = `echo "${base64Content}" | base64 -d | sudo tee "${dto.path}" > /dev/null`;
        break;
      default:
        throw new BadRequestException('Invalid action');
    }

    const output = await this.serversService.executeSshCommand(server, command);
    return { output, success: true };
  }
}
