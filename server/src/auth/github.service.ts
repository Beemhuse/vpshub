import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GithubService {
  private readonly tokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly apiUrl = 'https://api.github.com';
  private readonly http = axios.create({
    timeout: 5000,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'VPSHub',
    },
  });

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

    try {
      const res = await this.http.post(this.tokenUrl, params, {
        headers: { Accept: 'application/json' },
      });

      if (res.data?.error)
        throw new BadRequestException(
          res.data.error_description || res.data.error,
        );

      return res.data.access_token as string;
    } catch (error) {
      this.handleGithubError(error, 'exchanging the GitHub OAuth code');
    }
  }

  async listUserRepos(accessToken: string) {
    if (!accessToken)
      throw new BadRequestException('Missing GitHub access token');

    try {
      const res = await this.http.get(`${this.apiUrl}/user/repos`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: { per_page: 100 },
      });
      return res.data;
    } catch (error) {
      this.handleGithubError(error, 'loading GitHub repositories');
    }
  }

  private handleGithubError(error: unknown, action: string): never {
    if (!axios.isAxiosError(error)) {
      throw error;
    }

    const code = error.code;
    const status = error.response?.status;
    const message = this.extractGithubMessage(error.response?.data);

    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      throw new ServiceUnavailableException(
        'GitHub could not be reached from the VPSHub backend. Check DNS or internet access on the machine running the server.',
      );
    }

    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      throw new ServiceUnavailableException(
        'GitHub did not respond in time. Check the backend network connection and try again.',
      );
    }

    if (status === 401) {
      throw new BadRequestException(
        'The stored GitHub token is invalid or expired. Disconnect GitHub and connect it again.',
      );
    }

    if (status === 403) {
      throw new BadRequestException(
        message || 'GitHub denied the request or rate-limited it.',
      );
    }

    if (status === 404) {
      throw new BadRequestException(
        message || 'The requested GitHub resource was not found.',
      );
    }

    if (status === 422) {
      throw new BadRequestException(
        message || 'GitHub rejected the OAuth request.',
      );
    }

    throw new BadGatewayException(
      message || `GitHub API request failed while ${action}.`,
    );
  }

  private extractGithubMessage(data: unknown): string | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const payload = data as Record<string, unknown>;

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }

    if (
      typeof payload.error_description === 'string' &&
      payload.error_description.trim()
    ) {
      return payload.error_description;
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }

    return null;
  }
}
