import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats(@Req() req) {
    return this.dashboardService.getStats(req.user.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activities' })
  async getActivity(@Req() req) {
    return this.dashboardService.getActivities(req.user.id);
  }
}
