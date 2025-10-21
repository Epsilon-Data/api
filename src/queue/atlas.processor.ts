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
  AtlasArchetypeNodeTypeName,
  AtlasArchetypeTypeName,
  AtlasEntityResponseDto,
  AtlasPostEntityResponseDto,
  AtlasSearchDslResponseDto,
  AtlasSimpleClassificationDto,
  AtlasSubmitArchetypeEntityDto,
} from 'src/atlas/dto';

type ArchetypeJobData = {
  owner: string;
  projectId: string;
  archetype: ArchetypeDto;
};

@Injectable()
@Processor('atlas-queue')
export class AtlasProcessor {
  private readonly logger = new Logger(AtlasProcessor.name);
  constructor(
    private readonly docker: DockerService,
    private readonly atlas: AtlasService,
    private prisma: PrismaService,
  ) {}

  @Process('process-data-broker')
  async handleDataBrokerJob(job: Job) {
    const { ownerId, projectId, requestId, database } = job.data;
    this.logger.log(
      `Handling 'process-data-broker' job for requestId: ${requestId}...`,
    );

    return await this.docker.runDataBroker(
      ownerId,
      projectId,
      database,
      requestId,
    );
  }

  @Process('process-add-archetype')
  async handleAddArchetypeJob(job: Job): Promise<string> {
    const { owner, projectId, archetype }: ArchetypeJobData = job.data;
    this.logger.log(
      `Handling 'process-add-archetype' job for projectId: ${projectId}...`,
    );

    // init negative guid
    let negativeGuid = -2;

    // nextGuid function
    const nextGuid = () => String(negativeGuid--);

    // Accumulators for entities and relationships
    const entities: AtlasSubmitArchetypeEntityDto[] = [];
    const parentLookup: Record<string, string> = {};

    // Add archetype_template entity
    const archetypeTemplateBody: AtlasSubmitArchetypeEntityDto = {
      typeName: AtlasArchetypeTypeName.Template,
      attributes: {
        owner: owner,
        name: archetype.name,
        // TODO: is this needed?
        projectId: projectId,
        // TODO: decide what is best to have as the name here
        qualifiedName: `${projectId}@${archetype.name.replace(/\s+/g, '_').toLowerCase()}`,
        status: 'DRAFT',
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
    // this.logger.debug(
    //   `Submitting new template:\n ${JSON.stringify(archetypeTemplateBody, null, 2)}`,
    // );

    // TODO: Proper error handling
    const templateResponse = await this.atlas.post<AtlasPostEntityResponseDto>(
      '/entity',
      { entity: archetypeTemplateBody },
      undefined,
    );

    // this.logger.debug(
    //   `POST template response:\n ${JSON.stringify(templateResponse, null, 2)}`,
    // );

    // store real archetypeId ref (Atlas GUID)
    archetype.archetypeId = Object.values(templateResponse?.guidAssignments)[0];

    const [columns, nodes] = archetype.nodes.reduce<
      [ArchetypeNodeDto[], ArchetypeNodeDto[]]
    >(
      (acc, node) => {
        if (node.type === 'column') acc[0].push(node);
        else acc[1].push(node);
        return acc;
      },
      [[], []],
    );
    const columnEdges = archetype.edges.filter((edge: ArchetypeEdgeDto) =>
      columns.find((e) => e.id === edge.target),
    );
    const archetypeNodes = nodes.map((node: ArchetypeNodeDto) => {
      const columnGuid = columnEdges.find((e) => e.source === node.id)?.target;
      const parentId = archetype.edges.find(
        (e) => e.target === node.id,
      )?.source;
      const currentGuid = nextGuid(); // increase neg guid
      parentLookup[node.id] = currentGuid;
      return {
        guid: currentGuid,
        typeName: AtlasArchetypeTypeName.Node,
        status: 'ACTIVE',
        attributes: {
          label: node.data.label,
          name: `${archetype.name} ${node.id}`,
          owner: owner,
          level: node.data.level,
          qualifiedName: `${projectId}@${archetype.archetypeId}@${node.id}`,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
        },
        classifications: mergeClassifications(
          columnGuid ? true : false, // isLeaf node
          node.id,
          node.type,
          archetype.permissions,
        ),
        relationshipAttributes: {
          template: {
            guid: archetype.archetypeId,
            typeName: 'archetype_template',
          },
          ...(parentId
            ? {
                parent_node: {
                  typeName: 'archetype_node',
                  guid: parentLookup[parentId],
                },
              }
            : {}),
          ...(columnGuid
            ? { column: { guid: columnGuid, typeName: 'rdbms_column' } }
            : {}),
        },
      };
    });

    entities.push(...archetypeNodes);

    // this.logger.debug(
    //   `Submitting entities:\n ${JSON.stringify(entities, null, 2)}`,
    // );

    // TODO: Proper error handling
    await this.atlas.post<AtlasPostEntityResponseDto>('/entity/bulk', {
      entities: entities,
    });

    await this.prisma.project.update({
      where: { projectId: projectId },
      data: { lastModified: new Date() },
    });
    this.logger.log(
      `Handling 'process-add-archetype' job for projectId ${projectId} done!`,
    );
    return archetype.archetypeId;
  }

  @Process('process-delete-archetype')
  async handleDeleteTemplateJob(job: Job) {
    const { archetypeId, projectId } = job.data;

    await this.atlas.delete('/entity/guid/' + archetypeId);
    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        lastModified: new Date(),
      },
    });
  }

  // TODO: remove redundant function as using classifiers for permissions now
  @Process('process-add-permissions')
  async handleAddPermissionsJob(job: Job) {
    const { projectId, permissions } = job.data;

    for (const p of permissions) {
      const templateGuid = p.templateId;

      const templateEntity = await this.atlas.get<AtlasEntityResponseDto>(
        `/entity/guid/${templateGuid}`,
      );

      const templateNodesGuid = [];

      for (const key in templateEntity.referredEntities) {
        const entity = templateEntity.referredEntities[key];

        if (entity.typeName.includes('archetype_')) {
          templateNodesGuid.push(key);
        }
      }

      // FIXME: change this
      // const getGuid = (name: string) => {
      //   for (const key in templateEntity.referredEntities) {
      //     if (
      //       templateEntity.referredEntities[key].attributes.qualifiedName ==
      //       name
      //     ) {
      //       return key;
      //     }
      //   }
      // };

      const params = { name: 'is_active' };
      await this.atlas.put(
        `/entity/guid/${templateGuid}`,
        JSON.stringify(p.active ? 'true' : 'false'),
        params,
      );

      if (p.active) {
        const activeParams = {
          query: `from permission where __state = "ACTIVE"`,
        };

        const activeResult = await this.atlas.get<AtlasSearchDslResponseDto>(
          '/search/dsl',
          activeParams,
        );
        this.logger.debug(activeResult);
        // FIXME: change this
        // if (activeResult.entities) {
        //   let guidList = [];
        //   for (const entity of activeResult.entities) {
        //     const params = {
        //       minExtInfo: true,
        //     };

        //     const permissionEntity =
        //       await this.atlas.get<AtlasEntityResponseDto>(
        //         `/entity/guid/${entity.guid}`,
        //         params,
        //         token,
        //       );

        //     const objects =
        //       permissionEntity.entity.relationshipAttributes.object.filter(
        //         (o) =>
        //           templateNodesGuid.includes(o.guid) &&
        //           o.relationshipStatus === 'ACTIVE',
        //       );

        //     const categories =
        //       permissionEntity.entity.relationshipAttributes.category.filter(
        //         (s) =>
        //           templateNodesGuid.includes(s.guid) &&
        //           s.relationshipStatus === 'ACTIVE',
        //       );
        //     const subcategories =
        //       permissionEntity.entity.relationshipAttributes.subcategory.filter(
        //         (c) =>
        //           templateNodesGuid.includes(c.guid) &&
        //           c.relationshipStatus === 'ACTIVE',
        //       );

        //     const combined = [...objects, ...categories, ...subcategories];
        //     guidList = [
        //       ...guidList,
        //       ...combined.map((c) => c.relationshipGuid),
        //     ];
        //   }

        //   guidList = Array.from(new Set(guidList));

        //   for (const guid of guidList) {
        //     await this.atlas.delete(
        //       `/relationship/guid/${guid}`,
        //       undefined,
        //       token,
        //     );
        //   }
        // }

        // for (const setting of p.settings) {
        //   const role = setting.role;

        //   for (const node of setting.access) {
        //     const nodeType = `archetype_${node.nodeType}`;
        //     const nodeGuid = await getGuid(
        //       `${templateGuid}@${node.nodeName.replace(' ', '_')}@${node.nodeId}`,
        //     );

        //     const uniquePermissions = [...new Set(node.permissions)];

        //     for (const permission of uniquePermissions) {
        //       const permissionName = `permission_${permission}@${role}`;
        //       const permissionParams = {
        //         query: `from permission where qualifiedName = "${permissionName}" and __state = "ACTIVE" limit 1`,
        //       };

        //       const permissionResult =
        //         await this.atlas.get<AtlasSearchDslResponseDto>(
        //           '/search/dsl',
        //           permissionParams,
        //           token,
        //         );

        //       if (permissionResult.entities) {
        //         const permissionGuid = permissionResult.entities[0].guid;

        //         const permissionEntity =
        //           await this.atlas.get<AtlasEntityResponseDto>(
        //             `/entity/guid/${permissionGuid}`,
        //             undefined,
        //             token,
        //           );

        //         const hasRelationship = false;
        //         // FIXME: needs attention
        //         // permissionEntity.entity.relationshipAttributes[
        //         //   `${node.nodeType}`
        //         // ].some(
        //         //   (p: any) =>
        //         //     p.guid === nodeGuid && p.relationshipStatus === 'ACTIVE',
        //         // );

        //         if (!hasRelationship) {
        //           const relationshipBody = {
        //             typeName: `${nodeType}_permissions`,
        //             end1: {
        //               guid: nodeGuid,
        //             },
        //             end2: {
        //               guid: permissionGuid,
        //             },
        //             status: 'ACTIVE',
        //           };

        //           await this.atlas.post(
        //             '/relationship',
        //             relationshipBody,
        //             token,
        //           );
        //         }
        //       } else {
        //         const permissionBody = {
        //           entity: {
        //             typeName: 'permission',
        //             status: 'ACTIVE',
        //             attributes: {
        //               owner: 'user',
        //               qualifiedName: `permission_${permission}@${role}`,
        //               name: permission,
        //             },
        //             relationshipAttributes: {
        //               object: [],
        //               category: [],
        //               subcategory: [],
        //             },
        //           },
        //         };

        //         const relationship = await this.atlas.get(
        //           `/types/relationshipdef/name/${nodeType}_permissions`,
        //           undefined,
        //           token,
        //         );
        //         const relationshipInfo = {
        //           guid: nodeGuid,
        //           typeName: nodeType,
        //           entityStatus: 'ACTIVE',
        //           relationshipType: `${nodeType}_permissions`,
        //           // FIME: change this
        //           // relationshipGuid: relationship.guid,
        //           relationshipStatus: 'ACTIVE',
        //         };

        //         permissionBody.entity.relationshipAttributes[
        //           node.nodeType
        //         ].push(relationshipInfo);

        //         await this.atlas.post('/entity', permissionBody, token);
        //       }
        //     }
        //   }
        // }
      }
    }

    await this.prisma.project.update({
      where: {
        projectId: projectId,
      },
      data: {
        lastModified: new Date(),
      },
    });
  }
}

function mergeClassifications(
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

// function addParent(
//   archetypeId: string,
//   nodeId: string,
//   edges: ArchetypeEdgeDto[],
// ) {
//   const parent = edges.find((e) => e.target === nodeId)?.source;
//   return parent
//     ? {
//         parent_node: {
//           typeName: 'archetype_node',
//           uniqueAttributes: {
//             qualifiedName: `${archetypeId}@${parent}`,
//           },
//         },
//       }
//     : {};
// }

// function addColumn(
//   archetypeId: string,
//   nodeId: string,
//   columnEdges: ArchetypeEdgeDto[],
// ) {
//   const columnGuid = columnEdges.find((e) => e.source === nodeId)?.target;
//   return parent
//     ? {
//         column: {
//           typeName: 'column',
//           guid: columnGuid,
//         },
//       }
//     : {};
// }
