import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AntlerGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-antler-session'];
    const sessionId = Array.isArray(header) ? header[0] : header;

    if (!sessionId) {
      throw new UnauthorizedException('Missing Antler session');
    }

    const session = this.authService.getAntlerSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.antlerSession = session;
    return true;
  }
}
