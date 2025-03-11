import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionRequestModule } from './connection_request/connection_request.module';
import { PrismaModule } from './prisma/prisma.module';
import { DatasourceModule } from './datasource/datasource.module';
import { AtlasModule } from './atlas/atlas.module';
import { DockerModule } from './docker/docker.module';
import { AdminModule } from './admin/admin.module';
import { ProjectModule } from './project/project.module';
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
import { AdminConfigService } from './config/admin.config.service';
import { AuthConfigService } from './config/auth.config.service';
// import {
//   AuthGuard,
//   KeycloakConnectModule,
//   ResourceGuard,
//   RoleGuard,
// } from 'nest-keycloak-connect';
// import { KeycloakConfigService } from './config/keycloak-config.service';
// import { KeycloakModule } from './config/keycloak.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    AuthModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useExisting: AuthConfigService,
    }),
    ConnectionRequestModule,
    PrismaModule,
    DatasourceModule,
    AtlasModule,
    DockerModule,
    AdminModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useExisting: AdminConfigService,
    }),
    ProjectModule,
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
