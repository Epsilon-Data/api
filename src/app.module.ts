import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionRequestModule } from './connection_request/connection_request.module';
import { PrismaModule } from './prisma/prisma.module';
import { DatabaseSourceModule } from './database_source/database_source.module';
import { CassandraModule } from './cassandra/cassandra.module';

import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    AuthModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          issuerBaseURL: configService.get<string>('auth.issuerBaseURL'),
          audience: configService.get<string>('auth.audience'),
          scopePrefix: configService.get<string>('auth.scopePrefix'),
          cookiePrefix: configService.get<string>('auth.cookiePrefix'),
          encryptionKey: configService.get<string>('auth.encryptionKey'),
          trustedWebOrigins: configService.get<string[]>(
            'auth.trustedWebOrigins',
          ),
          allowTokenAuth:
            configService.get<boolean>('auth.allowTokenAuth') || true,
        };
      },
    }),
    ConnectionRequestModule,
    PrismaModule,
    DatabaseSourceModule,
    CassandraModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
