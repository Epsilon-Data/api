import { Injectable, Logger } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { DataSource } from 'typeorm';
import { createObjectCsvWriter } from 'csv-writer';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class DatabaseService {
  private connection;
  private sourceId;

  private readonly logger = new Logger(DatabaseService.name);

  constructor(private cassandra: CassandraService) {}

  async connect(sourceId: string) {
    this.sourceId = sourceId;
    const query = `SELECT type, host, port, username, password, name FROM sources WHERE id = ?`;
    const queryParams = [sourceId];
    const result = await this.cassandra.query(query, queryParams);

    this.connection = new DataSource({
      type: result[0].type,
      host:
        result[0].host == 'host.docker.internal' ? 'localhost' : result[0].host,
      port: result[0].port,
      username: result[0].username,
      password: result[0].password,
      database: result[0].name,
    });
  }

  async initialize() {
    await this.connection
      .initialize()
      .then(() => this.logger.log('Connected to user database'))
      .catch((err) => this.logger.error(err));
  }

  async query(sql: string, parameters?: any[]): Promise<any> {
    return await this.connection.query(sql, parameters);
  }

  async disconnect() {
    await this.connection
      .destroy()
      .then(() => this.logger.log('Destroyed user database'))
      .catch((err) => this.logger.error(err));
  }

  async exportAllTablesToCsv(exportingTables: string[]) {
    const tables = exportingTables || (await this.getTables());
    let success = false;
    for (const table of tables) {
      const data = await this.query(`SELECT * FROM ${table}`);
      success = await this.writeCsv(table, data, this.sourceId);
    }

    if (success) {
      this.logger.log(
        `Successfully exported ${tables.length} tables from user database`,
      );
      return this.sourceId;
    }

    return null;
  }

  private async getTables(): Promise<string[]> {
    const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const result = await this.query(query);
    return result.map((row) => row.table_name);
  }

  private async writeCsv(tableName: string, data: any[], folder: string) {
    if (data.length === 0) {
      console.log(`No data found for table ${tableName}`);
      return;
    }

    const directoryPath = join(process.cwd(), 'csv', folder);
    await fs.mkdir(directoryPath, { recursive: true });

    const csvWriter = createObjectCsvWriter({
      path: join(directoryPath, `${tableName}.csv`),
      header: Object.keys(data[0]).map((key) => ({ id: key, title: key })),
    });

    let success = false;

    await csvWriter
      .writeRecords(data)
      .then(() => {
        success = true;
      })
      .catch((err) =>
        console.error(`Error writing CSV file for ${tableName}:`, err),
      );

    return success;
  }
}
