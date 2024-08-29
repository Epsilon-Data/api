import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AtlasService {
  private baseUrl = 'http://localhost:21000/api/atlas/v2';
  private username = 'admin';
  private password = 'admin';
  private readonly logger = new Logger(AtlasService.name);

  constructor() {}

  createAuthHeader(): string {
    const token = Buffer.from(`${this.username}:${this.password}`).toString(
      'base64',
    );
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
        headers: { Authorization: authHeader },
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
