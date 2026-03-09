import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AtlasProcessor } from './atlas.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { DockerModule } from 'src/docker/docker.module';
import { KeycloakProcessor } from './keycloak.processor';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'atlas-queue',
        settings: { maxStalledCount: 5 },
      },
      {
        name: 'keycloak-queue',
        settings: { maxStalledCount: 5 },
      },
    ),
    DockerModule,
  ],
  providers: [QueueService, AtlasProcessor, KeycloakProcessor],
  exports: [QueueService],
})
export class QueueModule {}
