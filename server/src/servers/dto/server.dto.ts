import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServerDto {
  @ApiProperty({ example: 'Production Web' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Ubuntu 22.04' })
  @IsNotEmpty()
  @IsString()
  os: string;

  @ApiProperty({ example: 'us-east-1' })
  @IsNotEmpty()
  @IsString()
  region: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  cpu: number;

  @ApiProperty({ example: 4096 })
  @IsInt()
  @Min(512)
  memory: number;

  @ApiProperty({ example: 80 })
  @IsInt()
  @Min(10)
  disk: number;
}

export class UpdateServerDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class ServerActionDto {
  @ApiProperty({ enum: ['start', 'stop', 'restart', 'rebuild'] })
  @IsNotEmpty()
  @IsString()
  action: 'start' | 'stop' | 'restart' | 'rebuild';
}

export class ConnectServerDto {
  @ApiProperty({ example: 'My VPS' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '1.2.3.4' })
  @IsNotEmpty()
  @IsString()
  ip: string;

  @ApiProperty({ example: 'us-east-1' })
  @IsNotEmpty()
  @IsString()
  region: string;

  @ApiProperty({ example: 'root' })
  @IsNotEmpty()
  @IsString()
  sshUser: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsOptional()
  @IsString()
  sshPassword?: string;

  @ApiProperty({
    example: '-----BEGIN RSA PRIVATE KEY-----...',
    required: false,
  })
  @IsOptional()
  @IsString()
  sshKey?: string;

  @ApiProperty({ example: 22 })
  @IsOptional()
  @IsInt()
  sshPort?: number = 22;

  @ApiProperty({ example: 'Ubuntu 22.04' })
  @IsNotEmpty()
  @IsString()
  os: string;
}

export class RegisterAgentDto {
  @ApiProperty({ example: 'server-uuid' })
  @IsNotEmpty()
  @IsString()
  serverId: string;

  @ApiProperty({ example: 'token' })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({ example: 4, required: false })
  @IsOptional()
  @IsInt()
  cpu?: number;

  @ApiProperty({ example: 8192, required: false })
  @IsOptional()
  @IsInt()
  memory?: number;
}

export class ServerStatsDto {
  cpu: number;
  memory: number;
  disk: number;
  services: Array<{ name: string; status: string; port: number | null }>;
  ports: Array<{ port: number; service: string; type: string }>;
}

export class TerminalCommandDto {
  @IsNotEmpty()
  @IsString()
  command: string;
}
