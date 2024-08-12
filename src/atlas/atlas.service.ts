import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AtlasService {
  private baseUrl = 'http://localhost:21000/api/atlas/v2';
  private username = 'admin';
  private password = 'admin';
  private readonly logger = new Logger(AtlasService.name);

  constructor(private readonly httpService: HttpService) {}

  createAuthHeader(): string {
    const token = Buffer.from(`${this.username}:${this.password}`).toString(
      'base64',
    );
    return `Basic ${token}`;
  }

  async get(endpoint: string, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    const response = await lastValueFrom(
      this.httpService.get(url, {
        params,
        headers: { Authorization: authHeader },
      }),
    );

    return response.data;
  }

  async post(endpoint: string, body: any, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    const response = await lastValueFrom(
      this.httpService.post(url, body, {
        params,
        headers: { Authorization: authHeader },
      }),
    );

    return response.data;
  }

  async put(endpoint: string, body: any, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    const response = await lastValueFrom(
      this.httpService.put(url, body, {
        params,
        headers: { Authorization: authHeader },
      }),
    );
    return response.data;
  }

  async delete(endpoint: string, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    const response = await lastValueFrom(
      this.httpService.delete(url, {
        params,
        headers: { Authorization: authHeader },
      }),
    );
    return response.data;
  }

  getCurrentDate() {
    // YYYY-MM-DD
    return new Date().toISOString().slice(0, 10);
  }
}
