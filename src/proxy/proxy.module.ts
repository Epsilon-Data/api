import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { RatholeConfigService } from './rathole-config.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [ProxyController],
  providers: [ProxyService, RatholeConfigService],
  exports: [ProxyService],
})
export class ProxyModule {}
