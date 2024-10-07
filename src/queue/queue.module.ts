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
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [QueueService, AtlasProcessor],
  exports: [QueueService],
})
export class QueueModule {}
