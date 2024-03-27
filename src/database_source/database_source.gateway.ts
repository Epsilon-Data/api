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

  @WebSocketServer() io: Server;

  afterInit() {
    this.logger.log('Initialized');
  }

  handleConnection(client: Socket) {
    const { sockets } = this.io.sockets;
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
      'SELECT name, status_msg, status_percent FROM sources WHERE status = 2';

    let result = await this.cassandra.executeQuery(query);
    this.io.emit('updateStatus', { results: result });

    // Poll the database for changes every 1 second
    const interval = setInterval(async () => {
      const updatedResult = await this.cassandra.executeQuery(query);

      if (updatedResult.length !== result.length) {
        this.io.emit('updateStatus', { results: updatedResult });
        // Update the result
        result = updatedResult;
      }
    }, 10000);

    if (result.length === 0) {
      clearInterval(interval);
    }

    client.on('close', () => {
      clearInterval(interval);
    });
  }
}
