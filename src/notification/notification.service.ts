import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationDto } from './dto';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private url;

  constructor(config: ConfigService) {
    this.url = config.get<string>('notificationServiceUrl');
  }

  async sendNotification(notificationDto: NotificationDto) {
    try {
      const response = await axios.post(`${this.url}/send`, notificationDto);
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error sending notification',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getUserNotifications(userId: string) {
    try {
      const response = await axios.get(`${this.url}/user/${userId}`);
      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error fetching notifications',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
