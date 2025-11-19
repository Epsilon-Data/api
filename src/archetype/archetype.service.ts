import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums } from '@prisma/client';
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
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeTypeName,
  AtlasEntityResponseDto,
  AtlasPutEntityResponseDto,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';

@Injectable()
export class ArchetypeService {
  private readonly logger = new Logger(ArchetypeService.name);
  constructor(
    private atlas: AtlasService,
    private readonly queue: QueueService,
    private prisma: PrismaService,
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

        // add column node and edge
        if (entity.relationshipAttributes?.column) {
          // skip if relationship is inactive
          if (
            entity.relationshipAttributes?.column?.relationshipStatus !==
            'ACTIVE'
          )
            continue;
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
          // check if active and node
          entity.status === 'ACTIVE' &&
          entity.typeName === AtlasArchetypeTypeName.Node &&
          // Level-0 nodes are always allowed
          (entity.attributes?.level === 0 ||
            // Otherwise, require a valid permission classification
            (entity.classifications?.some(
              (c) =>
                c.typeName === 'archetype_node_analysis_permissions' &&
                c.entityStatus === 'ACTIVE' &&
                c.attributes?.access_level !== ArchetypePermission.NONE &&
                c.entityGuid === entity.guid,
            ) ??
              false));

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

  async getAnalysisArchetype(projectId: string, token?: string) {
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
      const properties: Record<string, object> = {};
      const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema#',
        title: res.attributes?.values[0][0],
        type: 'object',
        properties,
      };

      const templateGuid = res.attributes?.values[0][1];
      const templateEntity =
        await this.atlas.get<AtlasArchetypeEntityResponseDto>(
          `/entity/guid/${templateGuid}`,
          undefined,
          token,
        );

      // TODO: handle errors
      for (const key in templateEntity?.referredEntities) {
        const node = templateEntity.referredEntities[key];
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
    return {};
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
    const rows = searchResult.attributes.values;
    if (!rows.length) {
      // this should not happen
      this.logger.warn(
        `No archetype templates found for project ${projectId} when updating ${qualifiedName}`,
      );
      throw new NotFoundException(
        `No archetype templates found for project ${projectId}`,
      );
    }

    // check for current status of this archetype
    const currentRow = rows.find(
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
    const previouslyPublishedRow = rows.find(
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
      rows.some(
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
    username: string,
    projectId: string,
    archetype: ArchetypeDto,
  ) {
    return await this.queue.addArchetypeJob(username, projectId, archetype);
  }

  async updateArchetype(
    username: string,
    projectId: string,
    archetypeId: string,
    archetype: ArchetypeDto,
  ) {
    return await this.queue.updateArchetypeJob(
      username,
      projectId,
      archetypeId,
      archetype,
    );
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

  private initJsonObject() {
    const type = 'object';
    const properties: Record<string, object> = {};
    return { type, properties };
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
}
