import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private connection;

  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private atlas: AtlasService,
    private prisma: PrismaService,
  ) {}

  async connect(sourceId: string) {
    const params = {
      ignoreRelationships: true,
    };
    const result = await this.atlas.get('/entity/guid/' + sourceId, params);

    const request = await this.prisma.connectionRequest.findUnique({
      where: { id: sourceId },
      select: {
        temp_username: true,
        temp_password: true,
      },
    });

    const dbDetails = {
      type: result.entity.attributes.rdbms_type,
      host:
        result.entity.attributes.hostname == 'host.docker.internal'
          ? 'localhost'
          : result.entity.attributes.hostname,
      port: result.entity.attributes.port,
      username: request.temp_username,
      password: request.temp_password,
      database: result.entity.attributes.name,
    };

    this.connection = new DataSource(dbDetails);

    return dbDetails;
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
