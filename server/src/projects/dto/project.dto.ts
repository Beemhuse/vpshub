import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Awesome Project' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'A brief description of the project',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'static', enum: ['static', 'docker'] })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: 'https://github.com/user/repo.git', required: false })
  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @ApiProperty({ example: 'nginx:alpine', required: false })
  @IsOptional()
  @IsString()
  dockerImage?: string;

  @ApiProperty({ example: 'server-id-123' })
  @IsNotEmpty()
  @IsString()
  serverId: string;

  @ApiProperty({
    example: { NODE_ENV: 'production', PORT: '3000' },
    required: false,
  })
  @IsOptional()
  env?: Record<string, string>;

  @ApiProperty({ example: 'app.example.com', required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ example: 'src', required: false })
  @IsOptional()
  @IsString()
  rootDir?: string;

  @ApiProperty({ example: 3000, required: false })
  @IsOptional()
  exposedPort?: number;

  @ApiProperty({
    example: { frontend: 'app.example.com', admin_server: 'api.example.com' },
    required: false,
  })
  @IsOptional()
  serviceDomains?: Record<string, string>;
}
