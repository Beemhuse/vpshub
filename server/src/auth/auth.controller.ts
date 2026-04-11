import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AntlerGuard } from './guards/antler-guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('antler')
  @ApiOperation({ summary: 'Verify an Antler proof and create a session' })
  async antlerAuth(@Body() body: { proof?: any; context?: string }) {
    return this.authService.antlerAuth(body?.proof, body?.context);
  }

  @Post('register-session')
  @ApiOperation({ summary: 'Register an Antler client session' })
  async registerAntlerSession(
    @Body()
    body: {
      proof?: any;
      session_public_key?: any;
      presence_proof?: any;
      context?: string;
    },
  ) {
    return this.authService.registerAntlerSession(body);
  }

  @Post('antler/access')
  @UseGuards(AntlerGuard)
  @ApiOperation({ summary: 'Exchange an Antler session for app access' })
  async exchangeAntlerSession(@Req() req) {
    const header = req.headers['x-antler-session'];
    const sessionId = Array.isArray(header) ? header[0] : header;
    return this.authService.exchangeAntlerSession(sessionId);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google login' })
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google login callback' })
  async googleAuthRedirect(@Req() req) {
    return this.authService.validateGoogleUser(req.user);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req) {
    return req.user;
  }
}
