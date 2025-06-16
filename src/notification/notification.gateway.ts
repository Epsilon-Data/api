import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationService } from './notification.service';
import { NotificationDto } from './dto';

@WebSocketGateway({ namespace: '/notification', cors: { origin: true } })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly notificationService: NotificationService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendNotification')
  async handleNotification(client: Socket, payload: NotificationDto) {
    await this.notificationService.sendNotification(payload);
    this.server.emit('newNotification', payload);
  }

  @SubscribeMessage('fetchNotifications')
  async handleFetchNotifications(client: Socket, payload: { userId: string }) {
    const notifications = await this.notificationService.getNotifications(
      payload.userId,
    );
    client.emit('notificationsList', notifications);
  }
}
