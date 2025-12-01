import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AtlasProcessor } from './atlas.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: 'atlas-queue',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueService, AtlasProcessor],
  exports: [QueueService],
})
export class QueueModule {}
