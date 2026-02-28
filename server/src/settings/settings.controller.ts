import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateProfileDto } from './dto/settings.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  getProfile(@Req() req) {
    return this.settingsService.getProfile(req.user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.settingsService.updateProfile(req.user.id, updateProfileDto);
  }
}
