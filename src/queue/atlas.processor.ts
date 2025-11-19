import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DockerService } from 'src/docker/docker.service';
import { customAlphabet } from 'nanoid';

import {
  ArchetypeNodeDto,
  ArchetypeNodePermissionDto,
  ArchetypeEdgeDto,
  ArchetypeDto,
  ArchetypeNodeType,
} from 'src/archetype/dto';

import {
  AtlasArchetypeAnalysisPermissionClassificationDto,
  AtlasArchetypeEntityDto,
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeNodeTypeName,
  AtlasArchetypeTypeName,
  AtlasExistingNode,
  AtlasPostEntityResponseDto,
  AtlasRelatedEntityRefDto,
  AtlasSimpleClassificationDto,
  AtlasSubmitArchetypeEntityDto,
} from 'src/atlas/dto';

import { ArchetypeJobDataDto, DataBrokerJobDataDto } from './dto';

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
  ) {}

  @Process('process-data-broker')
  async handleDataBrokerJob(job: Job) {
    const { owner, projectId, requestId, database } =
      job.data as DataBrokerJobDataDto;
    this.logger.log(
      `Handling 'process-data-broker' for requestId ${requestId}...`,
    );
    return await this.docker.runDataBroker(
      owner,
      projectId,
      requestId,
      database,
    );
  }

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job) {
    const { owner, projectId, archetype } = job.data as ArchetypeJobDataDto;
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
        const { columns, nodes } = this.separateColumnsNodes(archetype);
        const { entities } = this.archetypeTemplateToAtlasEntities(
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
      return archetype.archetypeId;
    } catch (error) {
      this.logger.error(
        `Error creating archetype for project ${archetype.projectId}: `,
        error,
      );
    }
  }

  @Process('process-update-archetype')
  async handleUpdateArchetypeJob(job: Job) {
    const { owner, projectId, archetype } = job.data as ArchetypeJobDataDto;
    this.logger.log(
      `Handling 'process-update-archetype' for archetype ${archetype.archetypeId}...`,
    );
    try {
      const updateEntities: AtlasSubmitArchetypeEntityDto[] = [];
      // separate columns from archetype_nodes
      const { columns, nodes } = this.separateColumnsNodes(archetype);
      // get all the node ids in update
      const nodeIds = new Set(nodes.map((n) => n.id));

      // check for relationships (e.g. archetype_nodes) using archetype_template qualifiedName
      const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${projectId}@${archetype.archetypeId}`,
          ignoreRelationships: false, // default false
          minExtInfo: true, // default false
        },
      );

      // lookup for existing entities
      const existingNodes: Record<string, AtlasExistingNode> = {};

      // check if there is any existing linked entities
      if (Object.keys(entityRes?.referredEntities).length) {
        for (const key in entityRes?.referredEntities) {
          const entity = entityRes?.referredEntities[key];
          // skip anything not a Node, not ACTIVE, or not in nodeIds (updated set of archetype_nodes)
          const qualifiedName = entity.attributes.qualifiedName;
          if (
            entity.typeName !== AtlasArchetypeTypeName.Node ||
            entity.status !== 'ACTIVE' ||
            !nodeIds.has(qualifiedName.split('@').at(-1)!)
          )
            continue;

          // add all existing nodes and their classifications
          existingNodes[qualifiedName] = {
            guid: entity.guid,
            classifications: entity.classifications ?? [],
          };
        }
      }
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
        ? this.archetypeTemplateToAtlasEntities(
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

      return archetype.archetypeId;
    } catch (error) {
      this.logger.error(
        `Error updating archetype ${archetype.archetypeId}: `,
        error,
      );
    }
  }

  @Process('process-delete-archetype')
  async handleDeleteArchetypeJob(job: Job) {
    const { archetypeId, projectId } = job.data as {
      archetypeId: string;
      projectId: string;
    };
    this.logger.log(
      `Handling 'process-delete-archetype' for archetype ${archetypeId}...`,
    );
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
      return projectId;
    } catch (error) {
      this.logger.error(`Error deleting archetype ${archetypeId}: `, error);
    }
  }

  // private methods
  private archetypeTemplateToAtlasEntities(
    projectId: string,
    archetype: ArchetypeDto,
    nodes: ArchetypeNodeDto[],
    columns: ArchetypeNodeDto[],
    existingNodes: Record<
      string,
      {
        guid: string;
        classifications: AtlasArchetypeEntityDto['classifications'];
      }
    > = {},
    isUpdate: boolean = false,
    owner?: string,
    templateGuid?: string,
  ): { entities: AtlasSubmitArchetypeEntityDto[]; guidAssignments: string[] } {
    // init negative guid
    let negativeGuid = -2;

    // nextGuid function
    const nextGuid = () => String(negativeGuid--);

    // Lookup for parent entities
    const parentLookup: Record<string, string> = {};

    // sort nodes by Id (needed for parent lookup)
    nodes.sort((a, b) => a.id.localeCompare(b.id));

    // get column edges if exists
    const columnEdges =
      archetype.edges?.filter((edge: ArchetypeEdgeDto) =>
        columns.find((e) => e.id === edge.target),
      ) || [];

    const guidAssignments: string[] = [];

    return {
      entities: nodes.map((node: ArchetypeNodeDto) => {
        // get column if exists
        const columnGuid = columnEdges.find(
          (e) => e.source === node.id,
        )?.target;

        // find parent node
        const parentId = archetype.edges?.find(
          (e) => e.target === node.id,
        )?.source;

        const parentIdQualifiedName = `${projectId}@${archetype.archetypeId}@${parentId}`;

        const currentGuid = nextGuid(); // decrease neg guid

        const qualifiedName = `${projectId}@${archetype.archetypeId}@${node.id}`;

        // update lookup for parent-child relationship
        // use qualifiedName if already existing node or negative guid if not
        parentLookup[node.id] =
          isUpdate && existingNodes[qualifiedName]
            ? qualifiedName
            : currentGuid;

        if (isUpdate && !existingNodes[qualifiedName])
          guidAssignments.push(currentGuid);
        return {
          // add GUID if new entity
          ...(isUpdate && existingNodes[qualifiedName]
            ? {}
            : { guid: currentGuid }),
          typeName: AtlasArchetypeTypeName.Node,
          status: 'ACTIVE',
          attributes: {
            label: node.data.label,
            // NOTE: needed for analysis SDK JSONSchema
            name: node.data.label,
            ...(isUpdate && existingNodes[qualifiedName] ? {} : { owner }),
            level: node.data.level,
            qualifiedName,
            position: {
              x: node.position.x,
              y: node.position.y,
            },
          },
          ...(isUpdate && existingNodes[qualifiedName] // existing classifications don't update
            ? {}
            : {
                classifications: this.mergeClassifications(
                  columnGuid ? true : false, // isLeaf node
                  node.id,
                  node.type,
                  archetype.permissions || [],
                ),
              }),
          relationshipAttributes: {
            template: {
              typeName: AtlasArchetypeTypeName.Template,
              ...(templateGuid
                ? {
                    guid: templateGuid,
                  }
                : {
                    uniqueAttributes: {
                      qualifiedName: `${projectId}@${archetype.archetypeId}`,
                    },
                  }),
            },
            ...(parentId
              ? {
                  parent_node: {
                    typeName: AtlasArchetypeTypeName.Node,
                    ...(isUpdate && existingNodes[parentIdQualifiedName]
                      ? {
                          uniqueAttributes: {
                            qualifiedName: parentLookup[parentId],
                          },
                        }
                      : { guid: parentLookup[parentId] }),
                  },
                }
              : {}),
            ...(columnGuid
              ? { column: { guid: columnGuid, typeName: 'rdbms_column' } }
              : {}),
          },
        };
      }),
      guidAssignments,
    };
  }

  private mergeClassifications(
    isLeaf: boolean,
    nodeId: string,
    type: string,
    permissions: ArchetypeNodePermissionDto[],
  ): AtlasArchetypeEntityDto['classifications'] {
    const classifications: AtlasArchetypeEntityDto['classifications'] = [];
    classifications.push({
      typeName: (isLeaf
        ? 'leaf_node'
        : type === 'root'
          ? 'root_node'
          : 'branch_node') as AtlasArchetypeNodeTypeName,
      propagate: false,
    } as AtlasSimpleClassificationDto);
    const permission = permissions?.find((p) => p.id === nodeId)?.permission;
    if (permission) {
      classifications.push({
        typeName: 'archetype_node_analysis_permissions',
        propagate: true,
        removePropagationsOnEntityDelete: true,
        attributes: { access_level: permission },
      } as AtlasArchetypeAnalysisPermissionClassificationDto);
    }
    return classifications;
  }

  private getPermissionClassification(
    nodeId: string,
    permissions: ArchetypeNodePermissionDto[],
  ): AtlasArchetypeEntityDto['classifications'] {
    const classifications: AtlasArchetypeEntityDto['classifications'] = [];
    const permission = permissions.find((p) => p.id === nodeId)?.permission;
    if (permission) {
      classifications.push({
        typeName: 'archetype_node_analysis_permissions',
        propagate: true,
        removePropagationsOnEntityDelete: true,
        attributes: { access_level: permission },
      } as AtlasArchetypeAnalysisPermissionClassificationDto);
    }
    return classifications;
  }

  private separateColumnsNodes(archetype: ArchetypeDto) {
    // separate columns from actual archetype_nodes
    if (archetype.nodes) {
      const [columns, nodes] = archetype.nodes.reduce<
        [ArchetypeNodeDto[], ArchetypeNodeDto[]]
      >(
        (acc, node) => {
          if (node.type === ArchetypeNodeType.Column) acc[0].push(node);
          else acc[1].push(node);
          return acc;
        },
        [[], []],
      );
      return { columns, nodes };
    }
    return { columns: [], nodes: [] };
  }

  private hasAnalysisPermClassification(
    guid: string,
    classifications: AtlasArchetypeEntityDto['classifications'] | undefined,
  ): boolean {
    if (!guid || !classifications?.length) return false;
    return classifications.some(
      (c) =>
        c.typeName === 'archetype_node_analysis_permissions' &&
        c.entityGuid === guid &&
        c.entityStatus === 'ACTIVE',
    );
  }

  private updateClassifications(
    archetypePermissions: ArchetypeNodePermissionDto[],
    existingNodes: Record<string, AtlasExistingNode>,
  ) {
    Object.entries(existingNodes).forEach(
      ([qualifiedName, { guid, classifications }]) => {
        const nodeId = qualifiedName.split('@').at(-1)!;
        const permissions =
          this.getPermissionClassification(
            nodeId,
            archetypePermissions || [],
          ) || [];
        if (!permissions.length) return;

        try {
          // check if classification already exists for the entity
          if (this.hasAnalysisPermClassification(guid, classifications)) {
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
