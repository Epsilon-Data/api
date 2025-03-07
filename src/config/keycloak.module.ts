import { Module } from '@nestjs/common';
import { AdminConfigService } from './keycloak-config.service';

@Module({
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminModule {}
