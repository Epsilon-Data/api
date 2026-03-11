import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
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
import { AdminConfigService } from './config/admin-config.service';
import { AuthConfigService } from './config/auth-config.service';
import { AnalysisModule } from './analysis/analysis.module';
import { CoordinatorModule } from './coordinator/coordinator.module';
import { JobModule } from './job/job.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [configuration], isGlobal: true }),
    AuthModule.forRootAsync({
      imports: [ConfigModule],
      useExisting: AuthConfigService,
    }),
    AdminModule.forRootAsync({
      imports: [ConfigModule],
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
    ConnectionRequestModule,
    PrismaModule,
    DatabaseModule,
    AtlasModule,
    DockerModule,
    CoordinatorModule,
    JobModule,
    ProxyModule,
  ],
  controllers: [AppController],
  providers: [AdminConfigService, AuthConfigService],
})
export class AppModule {}
