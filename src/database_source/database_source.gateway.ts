import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';

import { Server, Socket } from 'socket.io';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { PrismaService } from 'src/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: true,
  },
})
export class DatabaseSourceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private cassandra: CassandraService,
    private prisma: PrismaService,
  ) {}
  private readonly logger = new Logger(DatabaseSourceGateway.name);

  @WebSocketServer() server: Server;

  afterInit() {
    this.logger.log('Initialized');
  }

  handleConnection(client: Socket) {
    const { sockets } = this.server.sockets;
    const requestOrigin = client.handshake.headers.origin;
    const trustedOrigins = this.configService.get<string[]>(
      'auth.trustedWebOrigins',
    );
    if (trustedOrigins.includes(requestOrigin)) {
      this.logger.log(`Connection established: ${client.id}`);
      this.logger.debug(`Number of connected clients: ${sockets.size}`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client id:${client.id} disconnected`);
  }

  @SubscribeMessage('listenToDatabaseStatuses')
  async listenToDatabaseStatuses(client: Socket) {
    const query =
      'SELECT id, status_msg, status_percent FROM sources WHERE status = 2 ALLOW FILTERING';

    // Poll the database for changes every second
    const interval = setInterval(async () => {
      const result = await this.cassandra.executeQuery(query);
      if (result.length > 0) {
        this.server.emit('updateStatus', { results: result });
      }

      if (result.length === 0) {
        clearInterval(interval);
        client.disconnect();
      }
    }, 2000);

    client.on('close', () => {
      clearInterval(interval);
    });
  }
}
