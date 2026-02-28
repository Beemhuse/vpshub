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
}
