import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { GithubService } from './github.service';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth/github')
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('url')
  @UseGuards(AuthGuard('jwt'))
  getAuthUrl(@Req() req) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId)
      throw new BadRequestException('GITHUB_CLIENT_ID is not configured');
    const redirect = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/github-callback`;
    const state = req.user?.id || '';
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=repo&state=${state}`;
    return { url };
  }

  @Post('exchange')
  @UseGuards(AuthGuard('jwt'))
  async exchangeCode(@Req() req, @Body('code') code: string) {
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GitHub client credentials are not configured',
      );
    }
    const redirect = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/github-callback`;

    const accessToken = await this.githubService.exchangeCodeForToken(
      clientId,
      clientSecret,
      code,
      redirect,
    );

    // Persist to user record
    await this.prisma.user.update({
      where: { id: user.id },
      data: { githubAccessToken: accessToken },
    });

    return { accessToken };
  }

  @Get('repos')
  @UseGuards(AuthGuard('jwt'))
  async listRepos(@Req() req) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const token = user?.githubAccessToken;
    if (!token) return [];
    const repos = await this.githubService.listUserRepos(token);
    return repos.map((r) => ({
      id: r.id,
      name: r.full_name,
      clone_url: r.clone_url,
      ssh_url: r.ssh_url,
    }));
  }

  @Post('disconnect')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Req() req) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubAccessToken: null },
    });
    return { ok: true };
  }
}
