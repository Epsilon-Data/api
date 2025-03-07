import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AuthModuleConfig,
  AUTH_CONFIG,
  KEYCLOAK_INSTANCE,
} from '../config.interface';

@Injectable()
export class KeycloakAuthService {
  private readonly logger = new Logger('KeycloakService');

  constructor(
    @Inject(AUTH_CONFIG) private config: AuthModuleConfig,
    @Inject(KEYCLOAK_INSTANCE)
    private kcAdminClient: any,
  ) {}
}
