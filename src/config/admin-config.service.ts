import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AdminModuleConfig,
  AdminModuleConfigFactory,
} from 'src/admin/admin-config.interface';

@Injectable()
export class AdminConfigService implements AdminModuleConfigFactory {
  constructor(private readonly configService: ConfigService) {}
  createKeycloakAdminConnectOptions(): AdminModuleConfig {
    return this.configService.getOrThrow('admin');
  }
}
