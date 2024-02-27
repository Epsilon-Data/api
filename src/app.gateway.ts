import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { CassandraService } from './cassandra/cassandra.service';
import { PrismaService } from './prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: true,
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly configService: ConfigService,
    private cassandra: CassandraService,
    private prisma: PrismaService,
  ) {}

  @WebSocketServer() server: Server;

  afterInit(server: Server) {
    console.log(server);
  }

  @SubscribeMessage('listenToDatabaseStatuses')
  async listenToDatabaseStatuses(client: Socket) {
    const query =
      'SELECT name, status_msg, status_percent FROM sources WHERE status = 2';

    let result = await this.cassandra.executeQuery(query);
    console.log(result);

    client.emit('updateStatus', { results: result });

    // Poll the database for changes every 1 second
    const interval = setInterval(async () => {
      const updatedResult = await this.cassandra.executeQuery(query);

      if (updatedResult.length !== result.length) {
        // Send updated data to client
        console.log(updatedResult);
        client.emit('updateStatus', { results: updatedResult });
        const crawlDoneArr = result.filter(
          (res) =>
            !updatedResult.some((updated_res) => res.name === updated_res.name),
        );

        for (const doneDb of crawlDoneArr) {
          const idQuery = 'SELECT id FROM sources WHERE name = ? LIMIT 1';
          const idQueryParams = [doneDb.name];
          const result = await this.cassandra.executeQuery(
            idQuery,
            idQueryParams,
          );
          await this.prisma.connectionRequest.update({
            where: {
              dbName: doneDb.name,
            },
            data: {
              dbId: result[0].id,
            },
          });
        }

        // Update the result
        result = updatedResult;
      }
    }, 1000);

    if (result.length === 0) {
      clearInterval(interval);
    }

    client.on('close', () => {
      clearInterval(interval);
    });
  }

  handleConnection(client: Socket) {
    const requestOrigin = client.handshake.headers.origin;
    const trustedOrigins = this.configService.get<string[]>(
      'auth.trustedWebOrigins',
    );
    if (trustedOrigins.includes(requestOrigin)) {
      console.log(`Connection established: ${client.id}`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Disconnected: ${client.id}`);
  }
}
