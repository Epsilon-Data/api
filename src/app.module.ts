import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionRequestModule } from './connection_request/connection_request.module';
import { PrismaModule } from './prisma/prisma.module';
import { DatasourceModule } from './datasource/datasource.module';
import { AtlasModule } from './atlas/atlas.module';
import { DockerModule } from './docker/docker.module';
import { AdminModule } from './admin/admin.module';
import { BrowseDatasetModule } from './browse_dataset/browse_dataset.module';
import { AccessRequestModule } from './access_request/access_request.module';
import { DatasetModule } from './dataset/dataset.module';
import { DataProcessingModule } from './data_processing/data_processing.module';
import { DatabaseModule } from './database/database.module';
import { StandardAnalysisModule } from './standard_analysis/standard_analysis.module';
import { FileStorageModule } from './file_storage/file_storage.module';
import { QueueModule } from './queue/queue.module';
import { TemplateModule } from './template/template.module';
import { ScriptModule } from './script/script.module';
import { AnalysisModule } from './analysis/analysis.module';
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
    DatasourceModule,
    AtlasModule,
    DockerModule,
    AdminModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          issuerBaseURL: configService.get<string>('admin.issuerBaseURL'),
          realm: configService.get<string>('admin.realm'),
          audience: configService.get<string>('admin.audience'),
          scopePrefix: configService.get<string>('admin.scopePrefix'),
          clientId: configService.get<string>('admin.clientId'),
          clientSecret: configService.get<string>('admin.clientSecret'),
          cookiePrefix: configService.get<string>('admin.cookiePrefix'),
          encryptionKey: configService.get<string>('admin.encryptionKey'),
          trustedWebOrigins: configService.get<string[]>(
            'admin.trustedWebOrigins',
          ),
        };
      },
    }),
    BrowseDatasetModule,
    AccessRequestModule,
    DatasetModule,
    DataProcessingModule,
    DatabaseModule,
    StandardAnalysisModule,
    FileStorageModule,
    QueueModule,
    TemplateModule,
    ScriptModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
