import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDeploymentDto {
  @ApiProperty({ example: 'server-id-123' })
  @IsNotEmpty()
  @IsString()
  serverId: string;

  @ApiProperty({ example: 'projectId-123', required: false })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({ example: 'My New Project', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'example.com', required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ example: 'git-repo-url', required: false })
  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @ApiProperty({ example: 'nginx:alpine', required: false })
  @IsOptional()
  @IsString()
  dockerImage?: string;

  @ApiProperty({ example: 'template-id-123', required: false })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ example: 'npm start', required: false })
  @IsOptional()
  @IsString()
  startCmd?: string;

  @ApiProperty({ example: 'npm run build', required: false })
  @IsOptional()
  @IsString()
  buildCmd?: string;

  @ApiProperty({ example: 'npm install', required: false })
  @IsOptional()
  @IsString()
  installCmd?: string;

  @ApiProperty({ example: 'apps/web', required: false })
  @IsOptional()
  @IsString()
  rootDir?: string;

  @ApiProperty({ example: 8080, required: false })
  @IsOptional()
  exposedPort?: number;

  @ApiProperty({ example: { NODE_ENV: 'production' }, required: false })
  @IsOptional()
  env?: Record<string, string>;
}
