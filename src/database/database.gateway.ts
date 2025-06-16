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
import { AtlasService } from 'src/atlas/atlas.service';

@WebSocketGateway({ namespace: '/datasource', cors: { origin: true } })
export class DatabaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private atlas: AtlasService,
  ) {}
  private readonly logger = new Logger(DatabaseGateway.name);

  @WebSocketServer() server: Server;

  afterInit() {
    this.logger.log('DatabaseSourceGateway initialised');
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

  async generateStatusList(output: any, token?: string) {
    if (!output.entities) return [];

    const modResult = await Promise.all(
      output.entities.map(async (entity) => {
        const details = await this.atlas.get(
          '/entity/guid/' + entity.guid,
          undefined,
          token,
        );

        return {
          id: entity.guid,
          crawlStatus: details.entity.attributes.crawl_status,
          statusMsg: details.entity.attributes.status_msg,
          statusPercent: details.entity.attributes.status_percent,
        };
      }),
    );

    return modResult;
  }

  @SubscribeMessage('listenToDatabaseStatuses')
  async listenToDatabaseStatuses(client: Socket, token?: string) {
    const interval = setInterval(async () => {
      let params = {
        query: 'from rdbms_instance where crawl_status = 1 or crawl_status = 2',
      };

      let result = await this.atlas.get('/search/dsl', params, token);

      if (result.entities) {
        const modResult = await this.generateStatusList(result);
        this.server.emit('updateStatus', { results: modResult });
      } else {
        params = {
          query: 'from rdbms_instance where crawl_status = 3',
        };
        result = await this.atlas.get('/search/dsl', params, token);

        const modResult = await this.generateStatusList(result);

        this.server.emit('updateStatus', { results: modResult });

        clearInterval(interval);
        client.disconnect();
      }
    }, 10000);

    client.on('close', () => {
      clearInterval(interval);
    });
  }
}
