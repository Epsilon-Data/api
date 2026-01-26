import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums } from 'src/generated/prisma/client';
import {
  ALLOWED_TRANSITIONS,
  ArchetypeDto,
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodeType,
  ArchetypePermission,
  ArchetypeStatus,
  UpdateArchetypeAttributesDto,
} from './dto';
import {
  AtlasArchetypeEntityClassificationDto,
  AtlasArchetypeEntityDto,
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeTypeName,
  AtlasEntityResponseDto,
  AtlasPutEntityResponseDto,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';
import { AnalysisArchetypeResponseDto } from 'src/analysis/dto';
import { UploadService } from 'src/upload/upload.service';
import { JobsService } from 'src/jobs/jobs.service';

@Injectable()
export class ArchetypeService {
  private readonly logger = new Logger(ArchetypeService.name);
  constructor(
    private atlas: AtlasService,
    private readonly queue: QueueService,
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly jobService: JobsService,
  ) {}

  // Queries
  async fetchArchetypes(projectId: string, token?: string) {
    const body = {
      typeName: AtlasArchetypeTypeName.Template,
      excludeDeletedEntities: true,
      includeClassificationAttributes: false,
      includeSubTypes: false,
      includeSubClassifications: false,
      excludeHeaderAttributes: false,
      entityFilters: {
        attributeName: 'projectId',
        operator: 'eq',
        attributeValue: projectId,
      },
      attributes: [
        'name',
        'qualifiedName',
        'status',
        '__createdBy',
        '__timestamp',
        '__modificationTimestamp',
      ],
    };

    const res = await this.atlas.post<AtlasSearchBasicResponseDto>(
      '/search/basic',
      body,
      token,
    );
    const entities = res?.entities ?? [];
    return entities.map((entity) => ({
      // use nanoid as the archetypeID
      id: (entity.attributes!.qualifiedName as string).split('@').at(-1),
      name: entity.displayText,
      status: entity.attributes!.status,
      createdBy: entity.attributes!.owner,
      created: new Date(entity.attributes!.__timestamp as number),
      lastModified: new Date(
        entity.attributes!.__modificationTimestamp as number,
      ),
    }));
  }

  async getArchetypeDetails(
    projectId: string,
    archetypeId: string,
    token?: string,
  ) {
    const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
      `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
      {
        'attr:qualifiedName': `${projectId}@${archetypeId}`,
        ignoreRelationships: false, // default false
        minExtInfo: false, // default false
      },
      token,
    );

    const templateInfo: ArchetypeDto = {
      projectId: projectId,
      archetypeId: archetypeId,
      name: entityRes.entity?.attributes?.name,
      status: entityRes.entity?.attributes?.status as ArchetypeStatus,
      nodes: [],
      edges: [],
      permissions: [],
      lastModified: new Date(entityRes.entity?.updateTime),
    };

    // add all archetype_nodes if any exist
    if (entityRes?.referredEntities) {
      for (const key in entityRes?.referredEntities) {
        const entity = entityRes.referredEntities[key];
        // if entity is not ACTIVE or archetype_node
        if (
          entity.status !== 'ACTIVE' ||
          entity.typeName !== AtlasArchetypeTypeName.Node
        )
          continue;

        const nodeId = entity.attributes.qualifiedName.split('@').at(-1)!;

        // add node itself
        const node: ArchetypeNodeDto = {
          id: nodeId, // NOTE: Maybe use GUID
          data: {
            label: entity.attributes.label!,
            level: entity.attributes.level!,
          },
          position: entity.attributes.position!,
          type: (entity.attributes?.level === 0
            ? 'root'
            : 'category') as ArchetypeNodeType,
        };
        templateInfo.nodes!.push(node);

        // add edge if parent exists
        // skip if relationship is inactive (SHOULD always be active)
        if (
          entity.relationshipAttributes?.parent_node &&
          entity.relationshipAttributes?.parent_node?.relationshipStatus ===
            'ACTIVE'
        ) {
          const parentNodeId =
            entity.relationshipAttributes.parent_node.qualifiedName
              .split('@')
              .at(-1)!; // NOTE: Maybe use GUID
          const edge: ArchetypeEdgeDto = {
            id: `edge_${parentNodeId}_${nodeId}`, // NOTE: maybe use relationship GUID here
            source: parentNodeId,
            target: nodeId,
          };
          templateInfo.edges!.push(edge);
        }

        // add column node and edge
        // only if the relationship is active
        if (
          entity.relationshipAttributes?.column &&
          entity.relationshipAttributes?.column?.relationshipStatus === 'ACTIVE'
        ) {
          const columnNodeId = entity.relationshipAttributes?.column?.guid;
          const columName = entity.relationshipAttributes.column.qualifiedName
            .split('@')
            .at(-1)!;
          const node: ArchetypeNodeDto = {
            id: columnNodeId,
            data: {
              label: columName,
              level: entity.attributes.level! + 1,
            },
            position: {
              x: entity.attributes.position!.x,
              y: entity.attributes.position!.y + 200,
            },
            type: ArchetypeNodeType.Column,
          };
          templateInfo.nodes!.push(node);

          const edge: ArchetypeEdgeDto = {
            source: nodeId,
            target: columnNodeId,
            id: `edge_${nodeId}_${columnNodeId}`, // NOTE: maybe use relationship GUID here
          };
          templateInfo.edges!.push(edge);
        }

        // add permissions (skip root node)
        if (entity.attributes?.level !== 0) {
          const analysisPermission = (() => {
            const permission = entity.classifications?.find(
              (c) =>
                c.typeName === 'archetype_node_analysis_permissions' &&
                c.entityStatus === 'ACTIVE' &&
                entity.guid === c.entityGuid, // don't include propagated permissions
            );
            return permission
              ? {
                  id: nodeId,
                  permission: permission?.attributes
                    ?.access_level as ArchetypePermission,
                }
              : null;
          })();
          if (analysisPermission)
            templateInfo.permissions!.push(analysisPermission);
        }
      }
    }
    return templateInfo;
  }

  async getPublishedArchetype(projectId: string, token?: string) {
    // get ID of PUBLISHED archetype
    const body = {
      typeName: AtlasArchetypeTypeName.Template,
      excludeDeletedEntities: true,
      includeSubClassifications: false,
      excludeHeaderAttributes: true,
      includeSubTypes: false,
      entityFilters: {
        condition: 'AND',
        criterion: [
          {
            attributeName: 'projectId',
            operator: 'eq',
            attributeValue: `${projectId}`,
          },
          {
            attributeName: 'status',
            operator: 'eq',
            attributeValue: 'PUBLISHED', // should only be one PUBLISHED per project
          },
        ],
      },
      attributes: ['name', '__guid'],
    };

    const res = await this.atlas.post<AtlasSearchBasicHeadlessResponseDto>(
      '/search/basic',
      body,
      token,
    );
    const values = res.attributes.values ?? [];
    if (!values.length) {
      // this should not happen
      this.logger.warn(
        `No published archetype templates found for project ${projectId}`,
      );
      throw new NotFoundException(
        `No archetype templates found for project ${projectId}`,
      );
    }

    const templateGuid = values[0][1];
    const templateName = values[0][0];

    const entityRes = await this.atlas.get<AtlasArchetypeEntityResponseDto>(
      `/entity/guid/${templateGuid}`,
      undefined,
      token,
    );
    const templateInfo: ArchetypeDto = {
      projectId: projectId,
      archetypeId: entityRes.entity?.attributes.qualifiedName.split('@').at(-1),
      name: templateName,
      status: entityRes.entity?.attributes?.status as ArchetypeStatus,
      nodes: [],
      edges: [],
      lastModified: new Date(entityRes.entity?.updateTime),
    };

    // add all archetype_nodes, should always exist
    if (entityRes?.referredEntities) {
      for (const key in entityRes?.referredEntities) {
        const entity = entityRes.referredEntities[key];
        const isAllowedEntity =
          entity.status === 'ACTIVE' &&
          entity.typeName === AtlasArchetypeTypeName.Node &&
          this.isEntityAllowedByPermissions(entity);

        if (!isAllowedEntity) continue;

        const nodeId = entity.attributes.qualifiedName.split('@').at(-1)!;

        // add node itself
        const node: ArchetypeNodeDto = {
          id: nodeId, // NOTE: Maybe use GUID
          data: {
            label: entity.attributes.label!,
            level: entity.attributes.level!,
          },
          position: entity.attributes.position!,
          type: (entity.attributes?.level === 0
            ? 'root'
            : 'category') as ArchetypeNodeType,
        };
        templateInfo.nodes!.push(node);

        // add edge if parent exists
        if (entity.relationshipAttributes?.parent_node) {
          // skip if relationship is inactive
          if (
            entity.relationshipAttributes?.parent_node?.relationshipStatus !==
            'ACTIVE'
          )
            continue;

          const parentNodeId =
            entity.relationshipAttributes.parent_node.qualifiedName
              .split('@')
              .at(-1)!; // NOTE: Maybe use GUID
          const edge: ArchetypeEdgeDto = {
            id: `edge_${parentNodeId}_${nodeId}`, // NOTE: maybe use relationship GUID here
            source: parentNodeId,
            target: nodeId,
          };
          templateInfo.edges!.push(edge);
        }
      }
    }
    return templateInfo;
  }

  async getAnalysisArchetype(
    projectId: string,
    token?: string,
  ): Promise<AnalysisArchetypeResponseDto> {
    // get ID of PUBLISHED archetype
    const body = {
      typeName: AtlasArchetypeTypeName.Template,
      excludeDeletedEntities: true,
      includeSubClassifications: false,
      excludeHeaderAttributes: true,
      includeSubTypes: false,
      entityFilters: {
        condition: 'AND',
        criterion: [
          {
            attributeName: 'projectId',
            operator: 'eq',
            attributeValue: `${projectId}`,
          },
          {
            attributeName: 'status',
            operator: 'eq',
            attributeValue: 'PUBLISHED', // should only be one PUBLISHED per project
          },
        ],
      },
      attributes: ['name', '__guid'],
    };
    const res = await this.atlas.post<AtlasSearchBasicHeadlessResponseDto>(
      '/search/basic',
      body,
      token,
    );
    if (res.approximateCount) {
      const templateGuid = res.attributes?.values[0][1];
      const templateEntity =
        await this.atlas.get<AtlasArchetypeEntityResponseDto>(
          `/entity/guid/${templateGuid}`,
          undefined,
          token,
        );
      const properties: Record<string, object> = {};
      const archetypeId = templateEntity.entity.attributes.qualifiedName
        .split('@')
        .at(-1) as string;
      const schema = {
        $id: `${projectId}/${archetypeId}`,
        $schema: 'https://json-schema.org/draft/2020-12/schema#',
        title: res.attributes?.values[0][0],
        type: 'object',
        properties,
      };
      // TODO: handle errors
      for (const key in templateEntity?.referredEntities) {
        const node = templateEntity.referredEntities[key];

        // check if node is allowed in the archetype
        const isAllowedEntity =
          node.status === 'ACTIVE' &&
          node.typeName === AtlasArchetypeTypeName.Node &&
          this.isEntityAllowedByPermissions(node);

        if (!isAllowedEntity) continue;

        // TODO: check if this is the best thing to use
        const objectName = node.attributes
          .label!.replace(/\s+/g, '_')
          .toLowerCase();
        const description = node.attributes?.label;
        // check for node has children
        if (
          node.relationshipAttributes?.child_nodes?.length &&
          !schema.properties[objectName]
        ) {
          schema.properties[objectName] = this.initJsonObject();
        }
        // check if node has a column
        if (node.relationshipAttributes?.column) {
          const column = node.relationshipAttributes?.column;
          // skip if relationship inactive
          if (column.relationshipStatus !== 'ACTIVE') continue;
          const properties: Record<string, object> = {};
          // TODO: handle errors
          // TODO: this can be done parallel or with one bulk request
          const { entity } = await this.atlas.get<AtlasEntityResponseDto>(
            `/entity/guid/${column.guid}`,
            undefined,
            token,
          );
          const jsonType = this.atlasTypeToJSONType(
            entity.attributes?.data_type as string,
          );
          properties[objectName] = {
            type: jsonType,
            description,
          };

          // add nodes to parent
          if (node.relationshipAttributes?.parent_node) {
            // skip if relationship is inactive
            if (
              node.relationshipAttributes?.parent_node?.relationshipStatus !==
              'ACTIVE'
            )
              continue;
            const parentRef =
              node.relationshipAttributes?.parent_node.displayText
                .replace(/\s+/g, '_')
                .toLowerCase();
            if (!schema.properties[parentRef]) {
              schema.properties[parentRef] = this.initJsonObject();
            }
            schema.properties[parentRef]['properties'] = {
              ...(schema.properties[parentRef]['properties'] as Record<
                string,
                unknown
              >),
              ...properties,
            };
          } else {
            schema.properties = { ...schema.properties, ...properties };
          }
        }
      }
      return schema;
    }
    throw new NotFoundException(
      `No published archetypes found for project ${projectId}`,
    );
  }

  // Commands
  async updateArchetypeDetails(
    projectId: string,
    archetypeId: string,
    attributes: UpdateArchetypeAttributesDto,
    token?: string,
  ): Promise<void> {
    const qualifiedName = `${projectId}@${archetypeId}`;

    // no status change: just update attributes and return
    if (!attributes.status) {
      await this.updateAtlasTemplateAttributes(
        qualifiedName,
        attributes,
        token,
      );
      return;
    }

    const body = {
      typeName: AtlasArchetypeTypeName.Template,
      excludeDeletedEntities: true,
      includeSubClassifications: false,
      excludeHeaderAttributes: true,
      includeSubTypes: false,
      includeClassificationAttributes: false,
      entityFilters: {
        attributeName: 'projectId',
        operator: 'eq',
        attributeValue: projectId,
      },
      attributes: ['qualifiedName', 'status'], // keep this aligned with index usage below
    };

    // get all project archetypes
    const searchResult =
      await this.atlas.post<AtlasSearchBasicHeadlessResponseDto>(
        '/search/basic',
        body,
        token,
      );

    // check if any archetypes exist for project
    const values = searchResult.attributes.values;
    if (!values.length) {
      // this should not happen
      this.logger.warn(
        `No archetype templates found for project ${projectId} when updating ${qualifiedName}`,
      );
      throw new NotFoundException(
        `No archetype templates found for project ${projectId}`,
      );
    }

    // check for current status of this archetype
    const currentRow = values.find(
      (v) => Array.isArray(v) && v[0] === qualifiedName,
    );
    const currentStatus = currentRow?.[1] as ArchetypeStatus | undefined;
    if (!currentStatus) {
      // should not happen
      this.logger.warn(
        `Archetype ${qualifiedName} not found in Atlas when updating details`,
      );
      throw new NotFoundException(`Archetype ${qualifiedName} not found`);
    }

    // check for allowed status change
    const nextStatus = attributes.status;
    if (!this.canTransition(currentStatus, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition archetype from ${currentStatus} to ${nextStatus}`,
      );
    }
    // apply status + attribute change to this archetype
    await this.updateAtlasTemplateAttributes(qualifiedName, attributes, token);

    // check: if publishing, unpublish any previously published archetype
    const previouslyPublishedRow = values.find(
      (v) =>
        Array.isArray(v) &&
        v[1] === (ArchetypeStatus.PUBLISHED as string) &&
        v[0] !== qualifiedName, // make sure it's NOT this one
    );
    const previousPublishedQualifiedName = previouslyPublishedRow?.[0];
    if (
      nextStatus === ArchetypeStatus.PUBLISHED &&
      previousPublishedQualifiedName
    ) {
      // unpublish the previous one
      await this.updateAtlasTemplateAttributes(
        previousPublishedQualifiedName,
        { status: ArchetypeStatus.ACTIVE } as UpdateArchetypeAttributesDto,
        token,
      );
    }

    // update project status + lastModified based on new state
    // did the project end up with *any* published archetype after this change
    const hadOtherPublishedBefore =
      values.some(
        (v) =>
          Array.isArray(v) &&
          v[1] === (ArchetypeStatus.PUBLISHED as string) &&
          v[0] !== qualifiedName,
      ) && currentStatus !== ArchetypeStatus.PUBLISHED;

    const projectNowHasPublished =
      nextStatus === ArchetypeStatus.PUBLISHED || hadOtherPublishedBefore;

    const newProjectStatus = projectNowHasPublished
      ? $Enums.ProjectStatus.MAPPED
      : $Enums.ProjectStatus.READY;

    await this.prisma.project.update({
      where: { projectId },
      data: {
        lastModified: new Date(),
        status: newProjectStatus,
      },
    });
  }

  // methods implemented via queue service
  async deleteArchetype(projectId: string, archetypeId: string) {
    return await this.queue.deleteArchetypeJob(projectId, archetypeId);
  }

  async createArchetype(
    owner: string,
    projectId: string,
    archetype: ArchetypeDto,
  ) {
    if (projectId !== archetype.projectId)
      throw new BadRequestException(
        `ProjectId and Archetype projectId mismatch`,
      );
    return await this.queue.addArchetypeJob(owner, projectId, archetype);
  }

  async updateArchetype(
    userId: string,
    projectId: string,
    archetypeId: string,
    archetype: ArchetypeDto,
  ) {
    if (projectId !== archetype.projectId)
      throw new BadRequestException(
        `ProjectId and Archetype projectId mismatch`,
      );
    return await this.queue.updateArchetypeJob(
      userId,
      projectId,
      archetypeId,
      archetype,
    );
  }

  processCodebookUpload(projectId: string, file: Express.Multer.File): string {
    this.logger.log(`Processing codebook upload for project ${projectId}`);

    // Queue the PDF processing job
    const jobId = this.uploadService.processFile(
      file,
      `Project: ${projectId}`, // context for LLM
    );

    return jobId;
  }

  getUploadJobStatus(jobId: string) {
    return this.jobService.status(jobId);
  }

  // private methods
  private async updateAtlasTemplateAttributes(
    qualifiedName: string,
    attributes: UpdateArchetypeAttributesDto,
    token?: string,
  ): Promise<void> {
    await this.atlas.put<AtlasPutEntityResponseDto>(
      `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
      {
        entity: {
          typeName: AtlasArchetypeTypeName.Template,
          attributes,
        },
      },
      {
        'attr:qualifiedName': qualifiedName,
      },
      token,
    );
  }
  private canTransition(current: string, next: string): boolean {
    return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
  }

  private initJsonObject(): {
    type: 'object';
    properties: Record<string, unknown>;
  } {
    return {
      type: 'object',
      properties: {},
    };
  }

  private atlasTypeToJSONType(dataType: string): string {
    switch (dataType) {
      case 'string':
      case 'date':
        return 'string';
      case 'int':
      case 'integer':
        return 'integer';
      case 'long':
      case 'float':
      case 'double':
      case 'short':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array<string>':
      case 'list<string>':
        return 'array';
      // You can expand this for nested object types too
      default:
        return 'object'; // fallback for unknown types
    }
  }

  private isEntityAllowedByPermissions(entity: AtlasArchetypeEntityDto) {
    // Level-0 always allowed
    if (entity.attributes?.level === 0) return true;

    let isActiveBranchNode = false;
    const perms: AtlasArchetypeEntityClassificationDto[] = [];

    // classification scanning
    for (const c of entity.classifications ?? []) {
      if (c.entityStatus !== 'ACTIVE') continue;

      switch (c.typeName) {
        case 'branch_node':
          isActiveBranchNode = true;
          break;

        case 'archetype_node_analysis_permissions':
          perms.push(c);
          break;
      }
    }

    // always allow branches
    // TODO: check this logic
    if (isActiveBranchNode) return true;

    // No permission classifications, allow only for ACTIVE branch nodes
    if (perms.length === 0) {
      return isActiveBranchNode;
    }

    // split explicit and inherited permissions
    const { explicitPerms, inheritedPerms } = perms.reduce(
      (acc, c) => {
        if (c.entityGuid === entity.guid) {
          acc.explicitPerms.push(c);
        } else {
          acc.inheritedPerms.push(c);
        }
        return acc;
      },
      { explicitPerms: [] as typeof perms, inheritedPerms: [] as typeof perms },
    );

    const hasExplicitDeny = explicitPerms.some(
      (c) => c.attributes?.access_level === ArchetypePermission.NONE,
    );
    const hasExplicitGrant = explicitPerms.some(
      (c) => c.attributes?.access_level !== ArchetypePermission.NONE,
    );
    const hasInheritedDeny = inheritedPerms.some(
      (c) => c.attributes?.access_level === ArchetypePermission.NONE,
    );

    // explicit NONE on this node -  always deny
    if (hasExplicitDeny) {
      return false;
    }

    // explicit non-NONE permission - allow even if inherited is NONE
    if (hasExplicitGrant) {
      return true;
    }

    // no explicit perms, but inherited NONE exists - deny
    if (hasInheritedDeny) {
      return false;
    }

    // permissions exist, none are NONE -  allow
    return true;
  }
}
