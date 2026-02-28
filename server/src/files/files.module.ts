import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ServersModule } from '../servers/servers.module';

@Module({
  imports: [ServersModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
