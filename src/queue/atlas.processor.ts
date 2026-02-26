import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DockerService } from 'src/docker/docker.service';
import { customAlphabet } from 'nanoid';

import { ArchetypeNodePermissionDto } from 'src/archetype/dto';

import {
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeTypeName,
  AtlasExistingNode,
  AtlasPostEntityResponseDto,
  AtlasRelatedEntityRefDto,
  AtlasSubmitArchetypeEntityDto,
} from 'src/atlas/dto';

import { ArchetypeJobDataDto, DataBrokerJobDataDto } from './dto';
import { JobService } from 'src/job/job.service';
import {
  archetypeTemplateToAtlasEntities,
  getDesiredChildNodeIdsForSource,
  getDesiredColumnGuidForSource,
  getPermissionClassification,
  hasAnalysisPermClassification,
  separateColumnsNodes,
} from 'src/atlas/atlas-utils';

// TODO: we need properly handle failed request for all these processors
@Injectable()
@Processor('atlas-queue')
export class AtlasProcessor {
  private readonly logger = new Logger(AtlasProcessor.name);
  private readonly customNanoidAlphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  constructor(
    private readonly docker: DockerService,
    private readonly atlas: AtlasService,
    private prisma: PrismaService,
    private readonly jobService: JobService,
  ) {}

  @Process('process-data-broker')
  async handleDataBrokerJob(job: Job) {
    const { jobId, owner, projectId, requestId, database } =
      job.data as DataBrokerJobDataDto;
    this.logger.log(
      `Handling 'process-data-broker' for requestId ${requestId}...`,
    );
    await this.jobService.markActive(jobId);
    try {
      const result = await this.docker.runDataBroker(
        owner,
        projectId,
        requestId,
        database,
      );
      await this.jobService.markCompleted(jobId, result);
      return result;
    } catch (error) {
      await this.jobService.markFailed(jobId, String(error));
      throw error;
    }
  }

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job) {
    const { jobId, owner, projectId, archetype } =
      job.data as ArchetypeJobDataDto;
    this.logger.log(
      `Handling 'process-add-archetype' for projectId ${projectId}...`,
    );
    // archetype template already exists use update
    if (archetype.archetypeId) {
      this.logger.log(
        `Archetype already exists, handing handling over to 'process-add-archetype'...`,
      );
      return await this.handleUpdateArchetypeJob(job);
    }
    await this.jobService.markActive(jobId);
    try {
      //  1. create archetype_template entity
      // generate new unique archetypeId (nanoid)
      archetype.archetypeId = customAlphabet(this.customNanoidAlphabet, 12)();
      const archetypeTemplateBody: AtlasSubmitArchetypeEntityDto = {
        typeName: AtlasArchetypeTypeName.Template,
        attributes: {
          owner: owner,
          name: archetype.name,
          projectId: projectId,
          // nanoid is used later as archetypeId in frontend
          qualifiedName: `${projectId}@${archetype.archetypeId}`,
          status: archetype.status,
        },
        relationshipAttributes: {
          instance: {
            typeName: 'rdbms_instance',
            uniqueAttributes: {
              projectId,
            },
          },
        },
      };
      const templateResponse =
        await this.atlas.post<AtlasPostEntityResponseDto>('/entity', {
          entity: archetypeTemplateBody,
        });

      // 2. store real archetype template ref (Atlas GUID)
      const templateGuid = Object.values(
        templateResponse?.guidAssignments || {},
      )[0];

      // check if any nodes are added
      if (archetype.nodes?.length) {
        // 3. create archetype_node entities
        const { columns, nodes } = separateColumnsNodes(archetype);
        const { entities } = archetypeTemplateToAtlasEntities(
          projectId,
          archetype,
          nodes,
          columns,
          {}, // no existing nodes are present as this is Add
          false, // not update
          owner,
          templateGuid,
        );
        await this.atlas.post<AtlasPostEntityResponseDto>('/entity/bulk', {
          entities: entities,
        });
      }
      // 4. update project
      await this.updateProject(projectId);
      this.logger.log(
        `Handling 'process-add-archetype' for projectId ${projectId} DONE!`,
        `Created archetype ${archetype.archetypeId} with status ${archetype.status}`,
      );
      await this.jobService.markCompleted(jobId, archetype.archetypeId);
      return archetype.archetypeId;
    } catch (error) {
      this.logger.error(
        `Error creating archetype for project ${archetype.projectId}: `,
        error,
      );
      await this.jobService.markFailed(jobId, String(error));
      throw error;
    }
  }

  @Process('process-update-archetype')
  async handleUpdateArchetypeJob(job: Job) {
    const { jobId, owner, projectId, archetype } =
      job.data as ArchetypeJobDataDto;
    this.logger.log(
      `Handling 'process-update-archetype' for archetype ${archetype.archetypeId}...`,
    );
    await this.jobService.markActive(jobId);
    try {
      const updateEntities: AtlasSubmitArchetypeEntityDto[] = [];
      // separate columns from archetype_nodes
      const { columns, nodes } = separateColumnsNodes(archetype);

      // get all the node ids in update
      const nodeIds = new Set(nodes.map((n) => n.id));

      // check for relationships (e.g. archetype_nodes) using archetype_template qualifiedName
      const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${projectId}@${archetype.archetypeId}`,
          ignoreRelationships: false, // default false
          minExtInfo: false, // default false (needed for relationship updates)
        },
      );

      // lookup for existing entities
      const existingNodes: Record<string, AtlasExistingNode> = {};
      const relationshipsToDelete: AtlasRelatedEntityRefDto[] = [];

      // iterate referredEntities
      if (Object.keys(entityRes?.referredEntities).length) {
        for (const key in entityRes.referredEntities) {
          const entity = entityRes.referredEntities[key];
          const qualifiedName = entity.attributes.qualifiedName;
          const sourceNodeId = qualifiedName.split('@').at(-1)!;

          // skip anything not a archetype_node, not ACTIVE, or not in nodeIds (updated set of archetype_nodes)
          if (
            entity.typeName !== AtlasArchetypeTypeName.Node ||
            entity.status !== 'ACTIVE' ||
            !nodeIds.has(sourceNodeId)
          ) {
            continue;
          }

          existingNodes[qualifiedName] = {
            guid: entity.guid,
            classifications: entity.classifications ?? [],
          };

          // check existing child_nodes relationships
          const relationshipMeta = entity.relationshipAttributes;
          const existingChildRefs = relationshipMeta?.child_nodes ?? [];
          const existingChildByNodeId = new Map<
            string,
            AtlasRelatedEntityRefDto
          >();

          for (const ref of existingChildRefs) {
            if (ref.relationshipStatus === 'DELETED') continue;

            const childQualifiedName = ref.qualifiedName;
            const childNodeId = childQualifiedName.split('@').at(-1)!;
            existingChildByNodeId.set(childNodeId, ref);
          }

          const desiredChildNodeIds = getDesiredChildNodeIdsForSource(
            sourceNodeId,
            archetype.edges,
            nodeIds,
          );
          // check if there are child_nodes that shouldn't exist anymore
          for (const [childNodeId, ref] of existingChildByNodeId.entries()) {
            if (!desiredChildNodeIds.has(childNodeId)) {
              relationshipsToDelete.push(ref);
            }
          }

          const existingColumnRef = relationshipMeta?.column;
          if (
            existingColumnRef &&
            existingColumnRef.relationshipStatus !== 'DELETED'
          ) {
            const desiredColumnGuid = getDesiredColumnGuidForSource(
              sourceNodeId,
              archetype.edges,
              nodeIds,
            );

            // only delete if node does't have a column anymore
            // if new column is added it will override with update
            if (!desiredColumnGuid) {
              relationshipsToDelete.push(existingColumnRef);
            }
          }
        }
      }

      // cleanup relationships (child_nodes and columns)
      // TODO: improve so not flooding the API with requests
      // TODO: improve error handling
      await Promise.all(
        relationshipsToDelete.map((rel) =>
          this.atlas.delete(`/relationship/guid/${rel.relationshipGuid}`),
        ),
      );

      // update existing nodes classifications with permissions
      // TODO: improve so not flooding the API with requests
      // TODO: improve error handling
      if (archetype.permissions)
        this.updateClassifications(archetype.permissions, existingNodes);

      // create archetype_template entity body
      const archetypeTemplateBody: AtlasSubmitArchetypeEntityDto = {
        typeName: AtlasArchetypeTypeName.Template,
        attributes: {
          name: archetype.name,
          projectId: projectId,
          // using the nanoid i.e. archetypeId as reference
          qualifiedName: `${projectId}@${archetype.archetypeId}`,
          status: archetype.status,
        },
        relationshipAttributes: {
          instance: {
            typeName: 'rdbms_instance',
            uniqueAttributes: {
              projectId,
            },
          },
          // NOTE: this deletes archetype_nodes that have been removed with the archetype update
          ...(Object.keys(existingNodes).length
            ? {
                nodes: Object.entries(existingNodes).map(([qualifiedName]) => ({
                  typeName: AtlasArchetypeTypeName.Node,
                  uniqueAttributes: {
                    qualifiedName: qualifiedName,
                  },
                })),
              }
            : { nodes: [] }),
        },
      };
      const { entities, guidAssignments } = nodes.length
        ? archetypeTemplateToAtlasEntities(
            projectId,
            archetype,
            nodes,
            columns,
            existingNodes,
            true, // isUpdate
            owner,
          )
        : { entities: [], guidAssignments: [] };

      // add any new nodes to archetype_template (neg GUIDs)
      if (guidAssignments.length) {
        const newNodeRefs = guidAssignments.map((guid) => ({
          guid,
          typeName: AtlasArchetypeTypeName.Node,
        }));
        archetypeTemplateBody.relationshipAttributes ??= {};
        archetypeTemplateBody.relationshipAttributes.nodes ??= [];
        archetypeTemplateBody.relationshipAttributes.nodes = [
          ...(archetypeTemplateBody.relationshipAttributes
            .nodes as AtlasRelatedEntityRefDto[]),
          ...newNodeRefs,
        ];
      }

      updateEntities.push(archetypeTemplateBody, ...entities);

      await this.atlas.post<AtlasPostEntityResponseDto>('/entity/bulk', {
        entities: updateEntities,
      });

      await this.updateProject(projectId);
      this.logger.log(
        `Handling 'process-update-archetype' for archetype ${archetype.archetypeId} DONE!`,
        `Updated archetype ${archetype.archetypeId} with status ${archetype.status}`,
      );

      await this.jobService.markCompleted(jobId, archetype.archetypeId);
      return archetype.archetypeId;
    } catch (error) {
      this.logger.error(
        `Error updating archetype ${archetype.archetypeId}: `,
        error,
      );
      await this.jobService.markFailed(jobId, String(error));
      throw error;
    }
  }

  @Process('process-delete-archetype')
  async handleDeleteArchetypeJob(job: Job) {
    const { jobId, archetypeId, projectId } = job.data as {
      jobId: string;
      archetypeId: string;
      projectId: string;
    };
    this.logger.log(
      `Handling 'process-delete-archetype' for archetype ${archetypeId}...`,
    );
    await this.jobService.markActive(jobId);
    try {
      await this.atlas.delete(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${projectId}@${archetypeId}`,
        },
      );

      await this.updateProject(projectId);
      this.logger.log(
        `Handling 'process-delete-archetype' for archetype ${archetypeId} DONE!`,
      );
      await this.jobService.markCompleted(jobId, projectId);
      return projectId;
    } catch (error) {
      this.logger.error(`Error deleting archetype ${archetypeId}: `, error);
      await this.jobService.markFailed(jobId, String(error));
      throw error;
    }
  }

  // private methods
  private updateClassifications(
    archetypePermissions: ArchetypeNodePermissionDto[],
    existingNodes: Record<string, AtlasExistingNode>,
  ) {
    Object.entries(existingNodes).forEach(
      ([qualifiedName, { guid, classifications }]) => {
        const nodeId = qualifiedName.split('@').at(-1)!;
        const permissions =
          getPermissionClassification(nodeId, archetypePermissions || []) || [];
        if (!permissions.length) return;

        try {
          // check if classification already exists for this entity
          if (hasAnalysisPermClassification(guid, classifications)) {
            void this.atlas.put<AtlasArchetypeEntityResponseDto>(
              `/entity/guid/${guid}/classifications`,
              permissions,
            );
          } else {
            // create classification for existing entity
            void this.atlas.post<AtlasArchetypeEntityResponseDto>(
              `/entity/guid/${guid}/classifications`,
              permissions,
            );
          }
        } catch (err) {
          this.logger.error(
            `Failed to set classifications for ${guid}: ${err}`,
          );
        }
      },
    );
  }

  private async updateProject(projectId: string) {
    return await this.prisma.project.update({
      where: { projectId: projectId },
      data: { lastModified: new Date() },
    });
  }
}
