import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private connection;

  private readonly logger = new Logger(DatabaseService.name);

  constructor(private atlas: AtlasService) {}

  async connect(sourceId: string) {
    const result = await this.atlas.get('/entity/guid/' + sourceId);
    //TODO: get type, host, port, username, password, name
    result[0].host = 'host.docker.internal' ? 'localhost' : result[0].host;

    this.connection = new DataSource({
      type: result[0].type,
      host:
        result[0].host == 'host.docker.internal' ? 'localhost' : result[0].host,
      port: result[0].port,
      username: result[0].username,
      password: result[0].password,
      database: result[0].name,
    });

    return result[0];
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
}
