import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DockerService } from 'src/docker/docker.service';

import {
  ArchetypeNodeDto,
  ArchetypeNodePermissionDto,
  ArchetypeEdgeDto,
  ArchetypeDto,
} from 'src/archetype/dto';
import {
  AtlasArchetypeAnalysisPermissionClassificationDto,
  AtlasArchetypeEntityDto,
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeNodeTypeName,
  AtlasArchetypeTypeName,
  AtlasPostEntityResponseDto,
  AtlasRelatedEntityRefDto,
  AtlasSimpleClassificationDto,
  AtlasSubmitArchetypeEntityDto,
} from 'src/atlas/dto';

import { customAlphabet } from 'nanoid';

type ArchetypeJobData = {
  owner: string;
  projectId: string;
  archetype: ArchetypeDto;
};
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
    const { ownerId, projectId, requestId, database } = job.data;
    this.logger.log(
      `Handling 'process-data-broker' for requestId ${requestId}...`,
    );
    return await this.docker.runDataBroker(
      ownerId,
      projectId,
      database,
      requestId,
    );
  }

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job) {
    const { owner, projectId, archetype }: ArchetypeJobData = job.data;
    this.logger.log(
      `Handling 'process-add-archetype' for projectId ${projectId}...`,
    );
    // archetype template already exists use update
    if (archetype.archetypeId) {
      this.logger.log(
        `Archetype already exists, handing handling over to 'process-add-archetype'...`,
      );
      this.handleUpdateArchetypeJob(job);
      return archetype.archetypeId;
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
          // TODO: is this needed?
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
        await this.atlas.post<AtlasPostEntityResponseDto>(
          '/entity',
          { entity: archetypeTemplateBody },
          undefined,
        );

      // 2. store real archetype template ref (Atlas GUID)
      const templateGuid = Object.values(templateResponse?.guidAssignments)[0];

      // check if any nodes are added
      if (archetype.nodes?.length) {
        // 3. create archetype_node entities
        const { columns, nodes } = this.separateColumnsNodes(archetype);
        const { entities } = this.archetypeTemplateToAtlasEntities(
          projectId,
          archetype,
          nodes,
          columns,
          {}, // no existing nodes should be present
          false,
          owner,
          templateGuid,
        );
        await this.atlas.post<AtlasPostEntityResponseDto>('/entity/bulk', {
          entities: entities,
        });
      }
      // 4. update project
      await this.prisma.project.update({
        where: { projectId: projectId },
        data: { lastModified: new Date() },
      });
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
    const { owner, projectId, archetype }: ArchetypeJobData = job.data;
    this.logger.log(
      `Handling 'process-update-archetype' for archetype ${archetype.archetypeId}...`,
    );
    try {
      const updateEntities: AtlasSubmitArchetypeEntityDto[] = [];

      const { columns, nodes } = archetype.nodes?.length
        ? this.separateColumnsNodes(archetype)
        : { columns: [], nodes: [] };

      // check relationships aka nodes
      const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${projectId}@${archetype.archetypeId}`,
          ignoreRelationships: false, // default false
          minExtInfo: true, // default false
        },
      );

      // get all the node ids
      const nodeIds = new Set(nodes.map((n) => n.id));

      // lookup for already existing nodes
      const existingNodes: Record<string, string> = Object.fromEntries(
        (entityRes.entity.relationshipAttributes?.nodes ?? [])
          .filter(
            (node) =>
              node.entityStatus !== 'DELETED' &&
              nodeIds.has(node.qualifiedName.split('@')[2]),
          )
          .map((node) => [node.qualifiedName, node.guid]),
      );

      // update existing nodes classifications with permissions
      // TODO: test if also need to update the node_type (e.g. leaf, root, branch)
      // TODO: improve so not flooding the API with requests
      // TODO: improve error handling
      if (archetype.permissions) {
        Object.entries(existingNodes).forEach(([qualifiedName, guid]) => {
          const nodeId = qualifiedName.split('@')[2];
          const permissions = this.getPermissionClassification(
            nodeId,
            archetype.permissions,
          );
          if (!permissions.length) return;

          this.atlas
            .put<AtlasArchetypeEntityResponseDto>(
              `/entity/guid/${guid}/classifications`,
              permissions,
            )
            .catch((err) =>
              this.logger.error(
                `Failed to set classifications for ${guid}: ${err?.message}`,
              ),
            );
        });
      }

      // Add archetype_template entity
      const archetypeTemplateBody: AtlasSubmitArchetypeEntityDto = {
        typeName: AtlasArchetypeTypeName.Template,
        attributes: {
          name: archetype.name,
          projectId: projectId,
          // using nanoid created in the beginning
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
          // NOTE: this deletes nodes that have been removed
          ...(Object.keys(existingNodes).length
            ? {
                nodes: Object.entries(existingNodes).map(([qualifiedName]) => ({
                  typeName: AtlasArchetypeTypeName.Node,
                  uniqueAttributes: {
                    qualifiedName: qualifiedName,
                  },
                })),
              }
            : {}),
        },
      };
      const { entities, guidAssignments } = nodes.length
        ? this.archetypeTemplateToAtlasEntities(
            projectId,
            archetype,
            nodes,
            columns,
            existingNodes,
            true,
            owner,
          )
        : { entities: [], guidAssignments: [] };

      // add new nodes that are assigned (neg guids)
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

      updateEntities.push(
        archetypeTemplateBody,
        ...(nodes.length ? entities : []),
      );

      await this.atlas.post<AtlasPostEntityResponseDto>('/entity/bulk', {
        entities: updateEntities,
      });

      await this.prisma.project.update({
        where: { projectId: projectId },
        data: { lastModified: new Date() },
      });
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
    const { archetypeId, projectId } = job.data;
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

      await this.prisma.project.update({
        where: {
          projectId: projectId,
        },
        data: {
          lastModified: new Date(),
        },
      });
      this.logger.log(
        `Handling 'process-delete-archetype' for archetype ${archetypeId} DONE!`,
      );
      return projectId;
    } catch (error) {
      this.logger.error(`Error deleting archetype ${archetypeId}: `, error);
    }
  }

  private archetypeTemplateToAtlasEntities(
    projectId: string,
    archetype: ArchetypeDto,
    nodes: ArchetypeNodeDto[],
    columns: ArchetypeNodeDto[],
    existingNodes: Record<string, string> = {},
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

    const columnEdges = archetype.edges.filter((edge: ArchetypeEdgeDto) =>
      columns.find((e) => e.id === edge.target),
    );
    const guidAssignments: string[] = [];

    return {
      entities: nodes.map((node: ArchetypeNodeDto) => {
        // get column if exists
        const columnGuid = columnEdges.find(
          (e) => e.source === node.id,
        )?.target;

        // find parent node
        const parentId = archetype.edges.find(
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

  private addParent(
    archetypeId: string,
    nodeId: string,
    edges: ArchetypeEdgeDto[],
  ) {
    const parent = edges.find((e) => e.target === nodeId)?.source;
    return parent
      ? {
          parent_node: {
            typeName: AtlasArchetypeTypeName.Node,
            uniqueAttributes: {
              qualifiedName: `${archetypeId}@${parent}`,
            },
          },
        }
      : {};
  }

  private addColumn(
    archetypeId: string,
    nodeId: string,
    columnEdges: ArchetypeEdgeDto[],
  ) {
    const columnGuid = columnEdges.find((e) => e.source === nodeId)?.target;
    return parent
      ? {
          column: {
            typeName: 'column',
            guid: columnGuid,
          },
        }
      : {};
  }

  private separateColumnsNodes(archetype: ArchetypeDto) {
    // separate columns from actual archetype_nodes
    const [columns, nodes] = archetype.nodes?.reduce<
      [ArchetypeNodeDto[], ArchetypeNodeDto[]]
    >(
      (acc, node) => {
        if (node.type === 'column') acc[0].push(node);
        else acc[1].push(node);
        return acc;
      },
      [[], []],
    );
    return { columns, nodes };
  }
}
