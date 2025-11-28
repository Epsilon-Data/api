import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AtlasProcessor } from './atlas.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { DockerModule } from 'src/docker/docker.module';

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
      { name: 'atlas-queue' },
      { name: 'keycloak-queue' },
    ),
    DockerModule,
  ],
  providers: [QueueService, AtlasProcessor],
  exports: [QueueService],
})
export class QueueModule {}
