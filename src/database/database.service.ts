import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private connection;

  private readonly logger = new Logger(DatabaseService.name);

  constructor(private atlas: AtlasService) {}

  async connect(sourceId: string) {
    const params = {
      ignoreRelationships: true,
    };
    const result = await this.atlas.get('/entity/guid/' + sourceId, params);

    this.connection = new DataSource({
      type: result.type,
      host:
        result.entity.attributes.hostname == 'host.docker.internal'
          ? 'localhost'
          : result.entity.attributes.hostname,
      port: result.entity.attributes.port,
      username: result.entity.attributes.username,
      password: result.entity.attributes.password,
      database: result.entity.attributes.name,
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
