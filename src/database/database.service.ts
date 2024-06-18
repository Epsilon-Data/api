import { Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService {
  private connection;

  constructor(
    private cassandra: CassandraService,
    private prisma: PrismaService,
  ) {}

  async connect(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        id: true,
      },
    });

    const query = `SELECT type, host, port, username, password, name FROM sources WHERE id = ?`;
    const queryParams = [request.id];
    const result = await this.cassandra.query(query, queryParams);

    this.connection = new DataSource({
      type: result[0].type,
      host: result[0].host,
      port: result[0].port,
      username: result[0].username,
      password: result[0].password,
      database: result[0].name,
    });
  }

  async initialize() {
    this.connection
      .initialize()
      .then(() => console.log('Connected to user database'))
      .catch((err) => console.error(err));
  }

  async query(sql: string, parameters?: any[]): Promise<any> {
    return this.connection.query(sql, parameters);
  }
}
