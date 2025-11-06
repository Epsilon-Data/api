import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class AtlasService {
  private baseUrl: string;
  private password: string;
  private readonly logger = new Logger(AtlasService.name);
  private basicAuth = true;

  constructor(config: ConfigService) {
    this.baseUrl = `${config.get<string>('atlas.uri')}/api/atlas/v2`;
    this.password = config.get<string>('atlas.adminPassword')!;
  }

  createBasicAuthHeader(): string {
    const token = Buffer.from(`admin:${this.password}`).toString('base64');
    return `Basic ${token}`;
  }

  createBearerAuthHeader(token: string): string {
    const tokenString = Buffer.from(token).toString('base64');
    return `Bearer ${tokenString}`;
  }

  async get<T>(endpoint: string, params?: unknown, token?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader =
      token && !this.basicAuth
        ? this.createBearerAuthHeader(token)
        : this.createBasicAuthHeader();

    try {
      const response: AxiosResponse<T> = await axios.get(url, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`GET request to ${url} failed: ${error}`);
      throw error;
    }
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    token?: string,
    params?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader =
      token && !this.basicAuth
        ? this.createBearerAuthHeader(token)
        : this.createBasicAuthHeader();

    try {
      const response: AxiosResponse<T> = await axios.post(url, body, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`POST request to ${url} failed: ${error}`);
      throw error;
    }
  }

  async put<T>(
    endpoint: string,
    body: unknown,
    params?: unknown,
    token?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader =
      token && !this.basicAuth
        ? this.createBearerAuthHeader(token)
        : this.createBasicAuthHeader();
    try {
      const response: AxiosResponse<T> = await axios.put(url, body, {
        params,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`PUT request to ${url} failed: ${error}`);
      throw error;
    }
  }

  async delete<T>(
    endpoint: string,
    params?: unknown,
    token?: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader =
      token && !this.basicAuth
        ? this.createBearerAuthHeader(token)
        : this.createBasicAuthHeader();

    try {
      const response: AxiosResponse<T> = await axios.delete(url, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`DELETE request to ${url} failed: ${error}`);
      throw error;
    }
  }
}
