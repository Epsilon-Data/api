import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationDto } from './dto';
import { Request } from 'express';

@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post()
  async sendNotification(@Body() dto: NotificationDto) {
    return this.notificationService.sendNotification(dto);
  }

  @Get()
  async getUserNotifications(@Req() request: Request) {
    const userId = request.auth.payload.sub.toString();
    return this.notificationService.getUserNotifications(userId);
  }
}
