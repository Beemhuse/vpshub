import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LsFilesDto {
  @ApiProperty({ example: '/var/www' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serverId: string;
}

export class FileActionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serverId: string;

  @ApiProperty({ example: '/var/www/test.txt' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({ example: 'cat', enum: ['cat', 'rm', 'mkdir', 'mv', 'write'] })
  @IsString()
  @IsNotEmpty()
  action: 'cat' | 'rm' | 'mkdir' | 'mv' | 'write';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content?: string;
}
