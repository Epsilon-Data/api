import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(config: ConfigService) {
    process.env.DATABASE_URL = config.get<string>('databaseUrl');
    super({
      datasources: {
        db: {
          url: config.get<string>('databaseUrl'),
        },
      },
    });
  }
}
