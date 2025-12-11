import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AuthModuleConfig,
  AuthModuleConfigFactory,
} from 'src/auth/config.interface';

@Injectable()
export class AuthConfigService implements AuthModuleConfigFactory {
  constructor(private readonly configService: ConfigService) {}
  createKeycloakConnectOptions(): AuthModuleConfig {
    return this.configService.getOrThrow('auth');
  }
}
