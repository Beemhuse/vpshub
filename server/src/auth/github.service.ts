import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GithubService {
  private tokenUrl = 'https://github.com/login/oauth/access_token';
  private apiUrl = 'https://api.github.com';

  async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri?: string,
  ) {
    if (!clientId || !clientSecret)
      throw new BadRequestException('GitHub client credentials not configured');

    const params: any = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };
    if (redirectUri) params.redirect_uri = redirectUri;

    const res = await axios.post(this.tokenUrl, params, {
      headers: { Accept: 'application/json' },
    });

    if (res.data?.error)
      throw new BadRequestException(
        res.data.error_description || res.data.error,
      );

    return res.data.access_token as string;
  }

  async listUserRepos(accessToken: string) {
    if (!accessToken)
      throw new BadRequestException('Missing GitHub access token');
    const res = await axios.get(`${this.apiUrl}/user/repos`, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: { per_page: 100 },
    });
    return res.data;
  }
}
