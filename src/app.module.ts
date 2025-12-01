import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
// import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectionRequestModule } from './connection-request/connection-request.module';
import { PrismaModule } from './prisma/prisma.module';
import { DatabaseModule } from './database/database.module';
import { AtlasModule } from './atlas/atlas.module';
import { DockerModule } from './docker/docker.module';
import { AdminModule } from './admin/admin.module';
import { ProjectModule } from './project/project.module';
import { AnalysisRequestModule } from './analysis-request/analysis-request.module';
import { StandardAnalysisModule } from './standard-analysis/standard-analysis.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { QueueModule } from './queue/queue.module';
import { ArchetypeModule } from './archetype/archetype.module';
import { NotificationModule } from './notification/notification.module';
import configuration from './config/configuration';
import { AdminConfigService } from './config/admin.config.service';
import { AuthConfigService } from './config/auth.config.service';
import { AnalysisModule } from './analysis/analysis.module';

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
    DatabaseModule,
    AtlasModule,
    DockerModule,
    AdminModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useExisting: AdminConfigService,
    }),
    ProjectModule,
    AnalysisRequestModule,
    StandardAnalysisModule,
    FileStorageModule,
    QueueModule,
    ArchetypeModule,
    NotificationModule,
    AnalysisModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
