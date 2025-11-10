import { Injectable, Logger } from '@nestjs/common';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import {
  ArchetypeDto,
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodeType,
  ArchetypePermission,
  ArchetypeStatus,
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
    try {
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
    } catch (error) {
      this.logger.error(`Error fetching archetypes for project`, error);
      throw error;
    }
  }

  async getArchetypeDetails(
    projectId: string,
    archetypeId: string,
    token?: string,
  ) {
    try {
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

      // add all archetype_nodes
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
    } catch (error) {
      this.logger.error(`Error getting archetype details`, error);
      throw error;
    }
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
    try {
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
    } catch (error) {
      this.logger.error(`Error getting Analysis Archetype structure`, error);
      throw error;
    }
    return {};
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

  // Commands
  async updateArchetypeDetails(
    projectId: string,
    archetypeId: string,
    attributes: unknown,
    token?: string,
  ) {
    try {
      await this.atlas.put<AtlasPutEntityResponseDto>(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          entity: {
            typeName: AtlasArchetypeTypeName.Template,
            attributes, // updated attributes
          },
        },
        {
          'attr:qualifiedName': `${projectId}@${archetypeId}`,
        },
        token,
      );
      return;
    } catch (error) {
      this.logger.error(`Error updating archetype details`, error);
      throw error;
    }
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
}
