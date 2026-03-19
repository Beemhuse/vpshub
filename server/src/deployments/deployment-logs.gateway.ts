import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
}

@WebSocketGateway({
  namespace: '/deployments',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class DeploymentLogsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private roomFor(deploymentId: string) {
    return `deployment:${deploymentId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return null;
  }

  private getJwtSecret(): string {
    return this.config.get('JWT_SECRET') || 'secret';
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret(),
      }) as JwtPayload;
      client.data.userId = payload.sub;
    } catch (error) {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // no-op
  }

  @SubscribeMessage('deployment:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deploymentId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    const deploymentId = payload?.deploymentId;

    if (!userId || !deploymentId) {
      client.emit('deployment:error', {
        message: 'Unauthorized or missing deploymentId',
      });
      return;
    }

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { server: true },
    });

    if (!deployment || deployment.server.userId !== userId) {
      client.emit('deployment:error', {
        message: 'Deployment not found',
      });
      return;
    }

    await client.join(this.roomFor(deploymentId));
    client.emit('deployment:subscribed', { deploymentId });
  }

  @SubscribeMessage('deployment:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deploymentId?: string },
  ) {
    const deploymentId = payload?.deploymentId;
    if (!deploymentId) return;
    await client.leave(this.roomFor(deploymentId));
    client.emit('deployment:unsubscribed', { deploymentId });
  }

  emitLog(
    deploymentId: string,
    message: string,
    source?: 'stdout' | 'stderr',
  ) {
    this.server.to(this.roomFor(deploymentId)).emit('deployment:log', {
      deploymentId,
      message,
      source,
      ts: new Date().toISOString(),
    });
  }
}
