import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AtlasService {
  private baseUrl: string;
  private password: string;
  private readonly logger = new Logger(AtlasService.name);

  constructor(config: ConfigService) {
    this.baseUrl = `${config.get('ATLAS_URI')}/api/atlas/v2`;
    this.password = config.get('ATLAS_ADMIN_PASSWORD');
  }

  createAuthHeader(): string {
    const token = Buffer.from(`admin:${this.password}`).toString('base64');
    return `Basic ${token}`;
  }

  async get(endpoint: string, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    try {
      const response = await axios.get(url, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`GET request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  async post(endpoint: string, body: any, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    try {
      const response = await axios.post(url, body, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`POST request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  async put(endpoint: string, body: any, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    try {
      const response = await axios.put(url, body, {
        params,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`PUT request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  async delete(endpoint: string, params?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.createAuthHeader();
    try {
      const response = await axios.delete(url, {
        params,
        headers: { Authorization: authHeader },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`DELETE request to ${url} failed: ${error.message}`);
      throw error;
    }
  }

  getCurrentDate() {
    // YYYY-MM-DD
    return new Date().toISOString().slice(0, 10);
  }
}
