import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
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
  DecisionStrategy,
  Logic,
  UserRepresentation,
} from '@epsilon-data/keycloak-admin-client';
import { AddResourceJobDataDto } from './dto';
import { ConfigService } from '@nestjs/config';
import { JobService } from 'src/job/job.service';

// TODO: we need properly handle failed request for all these processors
@Injectable()
@Processor('keycloak-queue')
export class KeycloakProcessor {
  private readonly logger = new Logger(KeycloakProcessor.name);

  constructor(
    private readonly keycloak: KeycloakAdminService,
    private readonly configService: ConfigService,
    private readonly jobService: JobService,
  ) {}

  @Process('process-add-resource')
  async handleAddResource(job: Job) {
    const { jobId, id, ownerId, collaborators, custodian } =
      job.data as AddResourceJobDataDto;
    this.logger.log(`Handling 'process-add-resource' for resource id ${id}...`);
    await this.jobService.markActive(jobId);
    try {
      // TODO: better error handling
      // reauth with keycloak client
      await this.keycloak.auth();

      // get owner username
      const owner = await this.keycloak.getUserById(ownerId);
      if (!owner)
        throw new Error(
          `Owner with id ${ownerId} doesn't exists. This should not happen!`,
        );
      if (!owner.username)
        throw new Error(`Owner ${ownerId} has no username in Keycloak`);
      const ownerUsername = owner.username;

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
            await Promise.all(
              users
                .filter(
                  (user): user is UserRepresentation & { id: string } =>
                    !!user.id,
                )
                .map((user) =>
                  this.keycloak.addUserToGroup(user.id, createGroup.id),
                ),
            );
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
          if (!user.id)
            throw new Error(`Custodian user ${custodian} has no ID`);
          custodianUserName = user.username ?? custodian;
          await this.keycloak.addUserToGroup(user.id, createGroup.id);
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
      await this.jobService.markCompleted(jobId);
    } catch (error) {
      this.logger.error(`Error creating resource`, error);
      await this.jobService.markFailed(jobId, String(error));
      throw error;
    }
  }
}
