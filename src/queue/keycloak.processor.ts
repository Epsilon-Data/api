import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';
import {
  resourcePrefix,
  projectScopes,
  ownerPolicyPrefix,
  ownerPermissionPrefix,
  ownerPermissions,
  groupPrefix,
  groupPolicyPrefix,
  groupPermissionPrefix,
  groupPermissions,
  analysisPolicyPrefix,
  analysisPermissionPrefix,
  analysisPermissions,
  custodianPolicyPrefix,
  custodianPermissionPrefix,
  custodianPermissions,
} from 'src/utils/options.util';
import {
  Credentials,
  DecisionStrategy,
  Logic,
  UserRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import { AddResourceJobDataDto } from './dto';
import {
  ADMIN_CONFIG,
  type AdminModuleConfig,
} from 'src/admin/admin-config.interface';
import { ConfigService } from '@nestjs/config';

// TODO: we need properly handle failed request for all these processors
@Injectable()
@Processor('keycloak-queue')
export class KeycloakProcessor {
  private readonly logger = new Logger(KeycloakProcessor.name);

  constructor(
    @Inject(ADMIN_CONFIG) private config: AdminModuleConfig,
    private readonly keycloak: KeycloakAdminService,
    private readonly configService: ConfigService,
  ) {}

  @Process('process-add-resource')
  async handleAddResource(job: Job) {
    const { id, ownerId, collaborators, custodian } =
      job.data as AddResourceJobDataDto;
    this.logger.log(`Handling 'process-add-resource' for resource id ${id}...`);
    try {
      // TODO: better error handling
      const credentials: Credentials = {
        grantType: 'client_credentials',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };
      await this.keycloak.auth(credentials);

      // get owner username
      const owner = await this.keycloak.getUserById(ownerId);
      if (!owner)
        throw new Error(
          `Owner with id ${ownerId} doesn't exists. This should not happen!`,
        );
      const ownerUsername = owner.username!;

      // get authorisationservice client
      const authClient = this.configService.get<string>('auth.clientId');
      const client = await this.keycloak.getClientById(authClient);

      // create resource
      await this.keycloak.createResource(client, {
        name: `${resourcePrefix}${id}`,
        type: 'project',
        displayName: `${resourcePrefix}${id}`,
        // TODO: make this URL same as frontend
        uris: [`project/${id}`],
        scopes: projectScopes,
      });

      // create owner policy
      await this.keycloak.createPolicy(client, 'user', {
        name: `${ownerPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        users: [ownerUsername],
      });

      // create owner permission
      await this.keycloak.createPermission(client, 'scope', {
        name: `${ownerPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        scopes: custodian ? ownerPermissions : [...ownerPermissions, 'connect'],
        policies: [`${ownerPolicyPrefix}${id}`],
      });

      // create group
      const createGroup = await this.keycloak.createGroup({
        name: `${groupPrefix}${id}`,
      });

      // add owner to group
      await this.keycloak.addUserToGroup(ownerId, createGroup.id);

      // create group policy
      await this.keycloak.createPolicy(client, 'group', {
        name: `${groupPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        groups: [createGroup.id],
      });

      // create group permission
      await this.keycloak.createPermission(client, 'scope', {
        name: `${groupPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        scopes: groupPermissions,
        policies: [`${groupPolicyPrefix}${id}`],
      });

      // create analysis policy
      await this.keycloak.createPolicy(client, 'user', {
        name: `${analysisPolicyPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
      });

      // create analysis permission
      await this.keycloak.createPermission(client, 'scope', {
        name: `${analysisPermissionPrefix}${id}`,
        decisionStrategy: DecisionStrategy.UNANIMOUS,
        logic: Logic.POSITIVE,
        resources: [`${resourcePrefix}${id}`],
        scopes: analysisPermissions,
        policies: [`${analysisPolicyPrefix}${id}`],
      });

      // invite collaborators and add them to the group
      if (collaborators) {
        const collabQueries = collaborators.map(async (email) => {
          const users = (await this.keycloak.checkUser({ email })) || [];
          if (!users.length) {
            const user = await this.keycloak.createUser({
              email,
              enabled: true,
              groups: [`${groupPrefix}${id}`],
            });
            return await this.keycloak.setUserActions(user.id);
          } else {
            return users.map(async (user: UserRepresentation) => {
              await this.keycloak.addUserToGroup(user.id!, createGroup.id);
            });
          }
        });
        await Promise.all(collabQueries);
      }
      if (custodian) {
        // temp username
        let custodianUserName = custodian;
        const users =
          (await this.keycloak.checkUser({ email: custodian })) || [];
        if (!users.length) {
          const user = await this.keycloak.createUser({
            email: custodian,
            enabled: true,
            groups: [`${groupPrefix}${id}`],
          });
          await this.keycloak.setUserActions(user.id);
        } else {
          const user = users[0];
          custodianUserName = user.username!;
          await this.keycloak.addUserToGroup(user.id!, createGroup.id);
        }
        // create custodian policy
        await this.keycloak.createPolicy(client, 'user', {
          name: `${custodianPolicyPrefix}${id}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          users: [custodianUserName],
        });

        // create custodian permission
        await this.keycloak.createPermission(client, 'scope', {
          name: `${custodianPermissionPrefix}${id}`,
          decisionStrategy: DecisionStrategy.UNANIMOUS,
          logic: Logic.POSITIVE,
          resources: [`${resourcePrefix}${id}`],
          scopes: custodianPermissions,
          policies: [`${custodianPolicyPrefix}${id}`],
        });
      }
    } catch (error) {
      this.logger.error(`Error creating resource`, error);
    }
  }
}
