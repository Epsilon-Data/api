import { Injectable } from '@nestjs/common';
import { Client } from 'cassandra-driver';

@Injectable()
export class CassandraService {
  private client: Client;

  constructor() {
    this.client = new Client({
      contactPoints: ['localhost:9042'],
      keyspace: 'source',
      localDataCenter: 'datacenter1',
    });

    this.client
      .connect()
      .then(() => console.log('Connected to Cassandra'))
      .catch((err) => console.error('Cassandra connection error', err));
  }

  async query(query: string, params?: any[]): Promise<any> {
    try {
      const result = await this.client.execute(query, params, {
        prepare: true,
      });
      return result.rows;
    } catch (err) {
      console.error('Error executing query', err);
      throw err;
    }
  }

  async disconnect() {
    await this.client.shutdown();
  }

  getCurrentDate() {
    // YYYY-MM-DD
    return new Date().toISOString().slice(0, 10);
  }
}
