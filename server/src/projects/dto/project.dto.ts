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
}
